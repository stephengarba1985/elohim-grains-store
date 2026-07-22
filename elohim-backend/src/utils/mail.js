const nodemailer = require("nodemailer");

// Debug - remove after testing
console.log("EMAIL_HOST =", process.env.EMAIL_HOST);
console.log("EMAIL_PORT =", process.env.EMAIL_PORT);
console.log("EMAIL_USER =", process.env.EMAIL_USER);

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false, // STARTTLS on port 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const dns = require("dns");

dns.lookup(process.env.EMAIL_HOST, (err, address, family) => {
  if (err) {
    console.error("DNS lookup failed:", err);
  } else {
    console.log(`SMTP resolves to ${address} (IPv${family})`);
  }
});
transporter.verify(function (error, success) {
  if (error) {
    console.error("SMTP VERIFY FAILED:");
    console.error(error);
  } else {
    console.log("SMTP SERVER IS READY");
  }
});

const sendPasswordResetEmail = async (email, resetLink) => {
  try {
    console.log("==================================");
    console.log("Sending reset email...");
    console.log("To:", email);
    console.log("From:", process.env.EMAIL_USER);
    console.log("Link:", resetLink);

    const info = await transporter.sendMail({
      from: `"Elohim Grains Store" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset Your Elohim Grains Password",
      html: `
        <h2>Password Reset Request</h2>

        <p>You requested to reset your password.</p>

        <p>Click the button below to create a new password:</p>

        <p>
          <a href="${resetLink}"
             style="
               background:#15803d;
               color:white;
               padding:12px 20px;
               text-decoration:none;
               border-radius:6px;
               display:inline-block;
             ">
             Reset Password
          </a>
        </p>

        <p>If the button doesn't work, copy this link:</p>

        <p>${resetLink}</p>

        <p>This link expires in 1 hour.</p>

        <hr/>

        <small>Elohim Grains Store</small>
      `,
    });

    console.log("Email sent successfully!");
    console.log("Message ID:", info.messageId);
    console.log("==================================");

    return info;
  } catch (err) {
    console.error("==================================");
    console.error("EMAIL SEND FAILED");
    console.error(err);
    console.error("==================================");
    throw err;
  }
};

module.exports = {
  sendPasswordResetEmail,
};