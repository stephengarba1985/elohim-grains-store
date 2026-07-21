const nodemailer = require("nodemailer");

    // Debug - remove after testing
console.log("EMAIL_HOST =", process.env.EMAIL_HOST);
console.log("EMAIL_PORT =", process.env.EMAIL_PORT);
console.log("EMAIL_USER =", process.env.EMAIL_USER);

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendPasswordResetEmail = async (email, resetLink) => {
  await transporter.sendMail({
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
};

module.exports = {
  sendPasswordResetEmail,
};