const brevo = require("@getbrevo/brevo");

const apiInstance = new brevo.TransactionalEmailsApi();

apiInstance.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

const sendPasswordResetEmail = async (email, resetLink) => {
  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();

    sendSmtpEmail.subject = "Reset Your Elohim Grains Password";

    sendSmtpEmail.sender = {
      name: "Elohim Grains Store",
      email: process.env.EMAIL_FROM,
    };

    sendSmtpEmail.to = [
      {
        email,
      },
    ];

    sendSmtpEmail.htmlContent = `
      <h2>Password Reset Request</h2>

      <p>You requested to reset your password.</p>

      <p>
        <a href="${resetLink}"
           style="background:#15803d;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;">
          Reset Password
        </a>
      </p>

      <p>Or copy this link:</p>

      <p>${resetLink}</p>

      <p>This link expires in 1 hour.</p>
    `;

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);

    console.log("Email sent successfully");
    console.log(result.body);

    return result;
  } catch (error) {
    console.error("BREVO API ERROR");
    console.error(error);
    throw error;
  }
};

module.exports = {
  sendPasswordResetEmail,
};