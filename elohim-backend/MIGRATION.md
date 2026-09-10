# Image Migration to S3

This document describes how to migrate existing catalog and product images from the local filesystem to Railway's S3-compatible bucket storage.

## Background

Previously, images were uploaded to the local container filesystem. However, this has two critical problems:

1. **Images are lost on deployment** — The ephemeral filesystem is wiped when the container is replaced
2. **Images don't scale** — If you run multiple replicas, only one container has the files

The new system uploads all images directly to an S3-compatible bucket (`elohim-catalog`), which persists across deployments and is shared across all replicas.

## Migration Script

A migration script is provided to move existing local images to S3.

### Prerequisites

Ensure your service has S3 credentials set as environment variables:

```bash
AWS_BUCKET_NAME=elohim-catalog
AWS_REGION=auto
AWS_ENDPOINT=[your S3 endpoint]
AWS_ACCESS_KEY_ID=[your access key]
AWS_SECRET_ACCESS_KEY=[your secret key]
```

These are auto-added to the `elohim-grains-store` service on Railway.

### Running the Script

#### 1. Dry Run (Preview)

First, see what will be migrated without uploading:

```bash
cd elohim-backend
node scripts/migrate-images-to-s3.js --dry-run
```

Output:
```
Found 15 image(s) to migrate

DRY RUN - No files will be uploaded
========================================

1. catalog/tropical-fruits-1788816758324-601221.jpg
   Local: /root/repo/elohim-backend/uploads/catalog/tropical-fruits-1788816758324-601221.jpg
   S3 Key: catalog/tropical-fruits-1788816758324-601221.jpg

2. catalog/stone-fruits-1788816802351-365373.jpg
   ...

Total files to upload: 15

Run without --dry-run to upload these files.
```

#### 2. Migrate All Images

```bash
cd elohim-backend
node scripts/migrate-images-to-s3.js
```

This will:
- Scan local upload directories (`uploads/catalog`, `uploads/products`)
- Read each image file
- Upload to S3 with the same folder structure and filename
- Log success/failure for each file

#### 3. Migrate Only Catalog or Products

```bash
node scripts/migrate-images-to-s3.js --folder catalog
# or
node scripts/migrate-images-to-s3.js --folder products
```

### Example Output

```
======================================================================
IMAGE MIGRATION SCRIPT: Local Filesystem → S3
======================================================================
Dry Run: NO
Folders: catalog, products

✓ S3 Bucket: elohim-catalog
✓ S3 Region: auto
✓ S3 Endpoint: [...]
✓ S3 client initialized

📂 Scanning: /root/repo/uploads/catalog
  ✓ Found 10 file(s)
📂 Scanning: /root/repo/uploads/products
  ✓ Found 5 file(s)

Found 15 image(s) to migrate

======================================================================
UPLOADING TO S3
======================================================================

[1/15] Uploading catalog/tropical-fruits-1788816758324-601221.jpg... ✓
[2/15] Uploading catalog/stone-fruits-1788816802351-365373.jpg... ✓
[3/15] Uploading catalog/berry-1788696492485-912810.jpg... ✓
...
[15/15] Uploading products/product-123.jpg... ✓

======================================================================
MIGRATION COMPLETE
======================================================================
✓ Successful: 15
❌ Failed: 0

```

## On Railway

To run the migration on your Railway service:

### Option 1: SSH into the running container

```bash
railway shell

# Inside the container
cd elohim-backend
node scripts/migrate-images-to-s3.js
```

### Option 2: Run as a one-time task

Add a pre-deploy command to your service:

```bash
cd elohim-backend && node scripts/migrate-images-to-s3.js
```

Then redeploy. The script will run before your app starts.

### Option 3: Create a manual deployment task

You can also set up a separate cron-job or one-time service to run the migration.

## After Migration

Once the script completes successfully:

1. ✓ All images are now in S3
2. ✓ Image requests (`/uploads/catalog/{filename}`) will serve from S3
3. ✓ Local files can be deleted to save space (optional)
4. ✓ New uploads automatically go to S3 via the updated `uploadRoutes.js`

## Troubleshooting

### Script fails with "AWS_BUCKET_NAME not set"

Ensure your service environment variables are set in Railway:

```bash
railway variables
```

Should show:
```
AWS_BUCKET_NAME=elohim-catalog
AWS_ACCESS_KEY_ID=***
AWS_SECRET_ACCESS_KEY=***
...
```

### Some images fail to upload

Check the error message. Common reasons:

- **Permission error** — Verify AWS credentials have write access to the bucket
- **File not found** — Local file was deleted or moved
- **S3 service error** — Temporary issue; retry the script

Failed files are listed at the end. You can:
1. Fix the issue and re-run the script (it's safe to re-run)
2. Manually upload those files via the admin panel

### No images found

Local images may not exist in the expected directories. Check:

```bash
ls -la uploads/catalog/
ls -la uploads/products/
```

If empty, new images are already going to S3. No migration needed.

## Rollback

If needed, you can revert to serving local files by removing the S3 logic from `app.js`. However, this is not recommended as local files are ephemeral.

## Further Reading

- [Railway S3 Documentation](https://docs.railway.com/guides/databases)
- [AWS SDK S3 Documentation](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/)

