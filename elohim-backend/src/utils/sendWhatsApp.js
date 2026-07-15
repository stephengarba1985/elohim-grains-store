const axios = require("axios");

const sendWhatsApp = async (phone, message) => {
  try {
    await axios.post(
      "https://api.ultramsg.com/YOUR_INSTANCE/messages/chat",
      {
        token: "YOUR_TOKEN",
        to: phone,
        body: message,
      }
    );

    console.log("✅ WhatsApp sent to", phone);

  } catch (err) {
    console.error("❌ WhatsApp error:", err.message);
  }
};

module.exports = sendWhatsApp;