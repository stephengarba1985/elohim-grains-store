const axios = require("axios");

const sendPasswordResetEmail = async (email, resetLink) => {
  try {
    console.log("==================================");
    console.log("Sending reset email...");
    console.log("To:", email);
    console.log("From:", process.env.EMAIL_FROM);

    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "Elohim Grains Store",
          email: process.env.EMAIL_FROM,
        },
        to: [
          {
            email,
          },
        ],
        subject: "Reset Your Elohim Grains Password",
        htmlContent: `
          <h2>Password Reset Request</h2>

          <p>You requested to reset your password.</p>

          <p>
            <a href="${resetLink}"
               style="
                 background:#15803d;
                 color:#ffffff;
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
          Accept: "application/json",
        },
      }
    );

    console.log("==================================");
    console.log("Email sent successfully!");
    console.log(response.data);
    console.log("==================================");

    return response.data;
  } catch (error) {
    console.error("==================================");
    console.error("BREVO API ERROR");

    if (error.response) {
      console.error(error.response.status);
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }

    console.error("==================================");

    throw error;
  }
};

module.exports = {
  sendPasswordResetEmail,
};