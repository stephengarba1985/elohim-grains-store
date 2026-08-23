const axios = require("axios");

/* =========================
   BREVO HTTPS EMAIL API
========================= */

const sendEmail = async ({ to, subject, htmlContent }) => {
  try {
    console.log("📧 Sending email via Brevo API...");

    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "Elohim Grains Store",
          email: process.env.EMAIL_FROM,
        },
        to: [{ email: to }],
        subject,
        htmlContent,
      },
      {
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json",
        },
        timeout: 15000,
      }
    );

    console.log("✅ EMAIL SENT:", response.data.messageId);

    return response.data;
  } catch (error) {
    console.error("❌ EMAIL ERROR:");

    if (error.response) {
      console.error("Brevo status:", error.response.status);
      console.error("Brevo response:", error.response.data);
    } else {
      console.error(error.message);
    }

    throw error;
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