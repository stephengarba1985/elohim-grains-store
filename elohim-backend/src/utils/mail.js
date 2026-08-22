const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  // Port 587 uses STARTTLS, not implicit SSL, so this must be false.
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Truehost's SMTP server can be slow to respond, so we give it more
  // time before giving up on the connection/socket.
  connectionTimeout: 15000, // 15s
  socketTimeout: 15000, // 15s
  // Reuse SMTP connections instead of opening a new one per email.
  pool: true,
  maxConnections: 5,
  tls: {
    // Truehost uses a certificate chain that doesn't always validate
    // cleanly, so we relax certificate checking for compatibility.
    rejectUnauthorized: false,
  },
});

// Errors that are safe to retry - transient network/connection issues.
// Anything else (e.g. auth failures) should fail fast.
const RETRYABLE_ERROR_CODES = [
  "ETIMEDOUT",
  "ECONNECTION",
  "ECONNREFUSED",
  "ESOCKET",
  "ECONNRESET",
  "EDNS",
];

const isRetryableError = (error) => {
  if (!error) return false;
  if (RETRYABLE_ERROR_CODES.includes(error.code)) return true;

  const message = (error.message || "").toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("connection")
  );
};

const RETRY_DELAYS_MS = [2000, 4000, 8000];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sendEmail = async ({ to, subject, htmlContent }) => {
  const maxAttempts = RETRY_DELAYS_MS.length + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`📧 Sending email (attempt ${attempt}/${maxAttempts})...`);

      const info = await transporter.sendMail({
        from: `"Elohim Grains Store" <${process.env.EMAIL_FROM}>`,
        to,
        subject,
        html: htmlContent,
      });

      console.log("EMAIL SENT:", info.messageId);
      return info;
    } catch (error) {
      console.error(
        `EMAIL ERROR (attempt ${attempt}/${maxAttempts}):`,
        error
      );

      const canRetry = attempt < maxAttempts && isRetryableError(error);

      if (!canRetry) {
        throw error;
      }

      const delay = RETRY_DELAYS_MS[attempt - 1];
      console.log(`⏳ Retrying in ${delay}ms...`);
      await wait(delay);
    }
  }
};

/* =========================
   PASSWORD RESET EMAIL
========================= */
const sendPasswordResetEmail = async (email, resetLink) => {
  const html = `
    <h2>Password Reset Request</h2>

    <p>You requested to reset your password.</p>

    <p>
      <a href="${resetLink}"
         style="
            background:#15803d;
            color:#fff;
            padding:12px 20px;
            text-decoration:none;
            border-radius:6px;
            display:inline-block;
         ">
         Reset Password
      </a>
    </p>

    <p>If the button doesn't work:</p>
    <p>${resetLink}</p>

    <p>This link expires in 1 hour.</p>

    <hr>

    <small>Elohim Grains Store</small>
  `;

  await sendEmail({
    to: email,
    subject: "Reset Your Elohim Grains Password",
    htmlContent: html,
  });

  console.log("Password reset email sent.");
};

/* =========================
   EMAIL VERIFICATION
========================= */
const sendVerificationEmail = async (email, verifyLink) => {
  const html = `
    <h2>Welcome to Elohim Grains Store 🎉</h2>

    <p>Thank you for creating your account.</p>

    <p>Please verify your email address.</p>

    <p>
      <a href="${verifyLink}"
         style="
            background:#16a34a;
            color:#fff;
            padding:12px 20px;
            text-decoration:none;
            border-radius:6px;
            display:inline-block;
         ">
         Verify Email
      </a>
    </p>

    <p>If the button doesn't work:</p>

    <p>${verifyLink}</p>

    <hr>

    <small>Elohim Grains Store</small>
  `;

  await sendEmail({
    to: email,
    subject: "Verify Your Elohim Grains Account",
    htmlContent: html,
  });

  console.log("Verification email sent.");
};

/* =========================
   ORDER CONFIRMATION EMAIL
========================= */
const sendOrderConfirmationEmail = async (email, order) => {
  const rows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">${item.name}</td>
        <td style="padding:8px;border:1px solid #ddd;">${item.weight || "-"}</td>
        <td style="padding:8px;border:1px solid #ddd;">${item.quantity}</td>
        <td style="padding:8px;border:1px solid #ddd;">₦${Number(item.price).toLocaleString()}</td>
      </tr>
    `
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:auto">

      <h2 style="color:#15803d;">
        Order Confirmation
      </h2>

      <p>Hello <strong>${order.customerName}</strong>,</p>

      <p>
        Thank you for shopping with
        <strong>Elohim Grains Store</strong>.
      </p>

      <p>Your order has been received successfully.</p>

      <h3>Order Details</h3>

      <p><strong>Order Number:</strong> #${order.orderId}</p>

      <table
        style="
          width:100%;
          border-collapse:collapse;
          margin-top:15px;
        "
      >
        <thead>
          <tr style="background:#15803d;color:white;">
            <th style="padding:10px;border:1px solid #ddd;">Product</th>
            <th style="padding:10px;border:1px solid #ddd;">Weight</th>
            <th style="padding:10px;border:1px solid #ddd;">Qty</th>
            <th style="padding:10px;border:1px solid #ddd;">Price</th>
          </tr>
        </thead>

        <tbody>
          ${rows}
        </tbody>
      </table>

      <h3 style="margin-top:20px;">
        Total: ₦${Number(order.totalAmount).toLocaleString()}
      </h3>

      <p>
        We are preparing your order and will notify you again once it has been dispatched.
      </p>

      <hr>

      <p>
        Thank you for choosing
        <strong>Elohim Grains Store.</strong>
      </p>

    </div>
  `;

  await sendEmail({
    to: email,
    subject: `Order Confirmation #${order.orderId}`,
    htmlContent: html,
  });

  console.log("Order confirmation email sent.");
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendOrderConfirmationEmail,
};