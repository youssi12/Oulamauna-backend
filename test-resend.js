
require("dotenv").config();
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmail() {
  try {
    const result = await resend.emails.send({
      from: "Oulamauna <onboarding@resend.dev>",
      to: ["oulamauna.official@gmail.com"],
      subject: "Oulamauna email test",
      html: "<p>Your email service is working!</p>",
    });

    console.log("Resend response:", result);
  } catch (error) {
    console.error("Email error:", error);
  }
}

testEmail();
