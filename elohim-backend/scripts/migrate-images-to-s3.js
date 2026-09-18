#!/usr/bin/env node

/**
 * Migration script: Move catalog and product images from local filesystem to S3
 * 
 * Usage:
 *   node scripts/migrate-images-to-s3.js [--dry-run] [--folder catalog|products]
 * 
 * Examples:
 *   node scripts/migrate-images-to-s3.js                    # Migrate all images
 *   node scripts/migrate-images-to-s3.js --dry-run           # Preview without uploading
 *   node scripts/migrate-images-to-s3.js --folder catalog    # Migrate only catalog images
 */

const fs = require("fs");
const path = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
require("dotenv").config();

/* =========================================================
   CONFIGURATION
========================================================= */

const S3_BUCKET = process.env.AWS_BUCKET_NAME;
const S3_REGION = process.env.AWS_REGION || "auto";
const S3_ENDPOINT = process.env.AWS_ENDPOINT;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

// Local upload directories to scan
const UPLOAD_ROOTS = [
  path.resolve(process.cwd(), "uploads"),
  path.resolve(__dirname, "..", "uploads"),
  process.env.RAILWAY_VOLUME_MOUNT_PATH ? path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH, "uploads") : null,
  path.resolve("/data/uploads"),
].filter(Boolean);

const FOLDERS_TO_MIGRATE = ["catalog", "products"];

/* =========================================================
   PARSE ARGUMENTS
========================================================= */

const dryRun = process.argv.includes("--dry-run");
const folderFilter = process.argv.find((arg) => arg.startsWith("--folder="))?.split("=")[1];

const foldersToProcess = folderFilter
  ? [folderFilter]
  : FOLDERS_TO_MIGRATE;

console.log("=".repeat(70));
console.log("IMAGE MIGRATION SCRIPT: Local Filesystem → S3");
console.log("=".repeat(70));
console.log(`Dry Run: ${dryRun ? "YES" : "NO"}`);
console.log(`Folders: ${foldersToProcess.join(", ")}`);
console.log("");

/* =========================================================
   VALIDATION
========================================================= */

if (!S3_BUCKET) {
  console.error("❌ ERROR: AWS_BUCKET_NAME environment variable not set");
  process.exit(1);
}

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.error("❌ ERROR: AWS credentials not set (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)");
  process.exit(1);
}

console.log(`✓ S3 Bucket: ${S3_BUCKET}`);
console.log(`✓ S3 Region: ${S3_REGION}`);
if (S3_ENDPOINT) {
  console.log(`✓ S3 Endpoint: ${S3_ENDPOINT}`);
}
console.log("");

/* =========================================================
   S3 CLIENT SETUP
========================================================= */

let s3Client;
try {
  s3Client = new S3Client({
    region: S3_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
    endpoint: S3_ENDPOINT,
  });
  console.log("✓ S3 client initialized\n");
} catch (err) {
  console.error("❌ Failed to initialize S3 client:", err.message);
  process.exit(1);
}

/* =========================================================
   FIND LOCAL IMAGES
========================================================= */

const findLocalImages = () => {
  const images = [];

  for (const root of UPLOAD_ROOTS) {
    if (!fs.existsSync(root)) {
      console.warn(`⚠ Upload root not found: ${root}`);
      continue;
    }

    for (const folder of foldersToProcess) {
      const folderPath = path.join(root, folder);

      if (!fs.existsSync(folderPath)) {
        console.warn(`⚠ Folder not found: ${folderPath}`);
        continue;
      }

      console.log(`📂 Scanning: ${folderPath}`);

      try {
        const files = fs.readdirSync(folderPath);

        for (const file of files) {
          const fullPath = path.join(folderPath, file);

          try {
            if (fs.statSync(fullPath).isFile()) {
              images.push({
                folder,
                filename: file,
                localPath: fullPath,
              });
            }
          } catch (err) {
            console.warn(`  ⚠ Failed to stat ${file}:`, err.message);
          }
        }

        console.log(`  ✓ Found ${files.length} file(s)`);
      } catch (err) {
        console.warn(`  ❌ Error reading directory:`, err.message);
      }
    }
  }

  return images;
};

/* =========================================================
   UPLOAD TO S3
========================================================= */

const uploadFileToS3 = async (localPath, s3Key, mimetype) => {
  try {
    const fileBuffer = fs.readFileSync(localPath);

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: mimetype,
    });

    await s3Client.send(command);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

/* =========================================================
   DETERMINE MIME TYPE
========================================================= */

const getMimeType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  return mimeTypes[ext] || "application/octet-stream";
};

/* =========================================================
   MAIN MIGRATION
========================================================= */

const migrate = async () => {
  const images = findLocalImages();

  if (images.length === 0) {
    console.log("ℹ No images found to migrate.\n");
    process.exit(0);
  }

  console.log(`\nFound ${images.length} image(s) to migrate\n`);

  if (dryRun) {
    console.log("=".repeat(70));
    console.log("DRY RUN - No files will be uploaded");
    console.log("=".repeat(70) + "\n");

    images.forEach((img, idx) => {
      console.log(`${idx + 1}. ${img.folder}/${img.filename}`);
      console.log(`   Local: ${img.localPath}`);
      console.log(`   S3 Key: ${img.folder}/${img.filename}`);
      console.log("");
    });

    console.log(`Total files to upload: ${images.length}`);
    console.log("\nRun without --dry-run to upload these files.\n");
    process.exit(0);
  }

  console.log("=".repeat(70));
  console.log("UPLOADING TO S3");
  console.log("=".repeat(70) + "\n");

  let successCount = 0;
  let failureCount = 0;
  const failures = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const s3Key = `${img.folder}/${img.filename}`;
    const mimetype = getMimeType(img.filename);

    process.stdout.write(`[${i + 1}/${images.length}] Uploading ${s3Key}... `);

    try {
      const result = await uploadFileToS3(img.localPath, s3Key, mimetype);

      if (result.success) {
        console.log("✓");
        successCount++;
      } else {
        console.log("❌");
        console.log(`      Error: ${result.error}`);
        failureCount++;
        failures.push({ img, error: result.error });
      }
    } catch (err) {
      console.log("❌");
      console.log(`      Error: ${err.message}`);
      failureCount++;
      failures.push({ img, error: err.message });
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("MIGRATION COMPLETE");
  console.log("=".repeat(70));
  console.log(`✓ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);

  if (failures.length > 0) {
    console.log("\nFailed uploads:");
    failures.forEach((f) => {
      console.log(`  - ${f.img.folder}/${f.img.filename}`);
      console.log(`    ${f.error}`);
    });
  }

  console.log("");

  process.exit(failureCount > 0 ? 1 : 0);
};

/* =========================================================
   RUN MIGRATION
========================================================= */

migrate().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});

