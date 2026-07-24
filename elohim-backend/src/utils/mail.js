const axios = require("axios");

/* =========================
   PASSWORD RESET EMAIL
========================= */
const sendPasswordResetEmail = async (email, resetLink) => {
  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "Elohim Grains Store",
          email: process.env.EMAIL_FROM,
        },
        to: [{ email }],
        subject: "Reset Your Elohim Grains Password",
        htmlContent: `
          <h2>Password Reset Request</h2>

          <p>You requested to reset your password.</p>

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

          <hr>

          <small>Elohim Grains Store</small>
        `,
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Password reset email sent.");
    return response.data;
  } catch (error) {
    console.error("Password reset email failed.");

    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }

    throw error;
  }
};

/* =========================
   EMAIL VERIFICATION
========================= */
const sendVerificationEmail = async (email, verifyLink) => {
  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "Elohim Grains Store",
          email: process.env.EMAIL_FROM,
        },
        to: [{ email }],
        subject: "Verify Your Elohim Grains Account",
        htmlContent: `
          <h2>Welcome to Elohim Grains Store 🎉</h2>

          <p>Thank you for creating an account.</p>

          <p>Please verify your email address by clicking the button below.</p>

          <p>
            <a href="${verifyLink}"
               style="
                 background:#16a34a;
                 color:white;
                 padding:12px 20px;
                 text-decoration:none;
                 border-radius:6px;
                 display:inline-block;
               ">
               Verify Email
            </a>
          </p>

          <p>If the button doesn't work, copy this link:</p>

          <p>${verifyLink}</p>

          <hr>

          <small>Elohim Grains Store</small>
        `,
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Verification email sent.");
    return response.data;
  } catch (error) {
    console.error("Verification email failed.");

    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }

    throw error;
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendVerificationEmail,
};