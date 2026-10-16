require("dotenv").config();

async function testEmail() {
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Oulamauna", email: process.env.USER_EMAIL },
        to: [{ email: "oulamauna.official@gmail.com" }],
        subject: "Oulamauna email test",
        htmlContent: "<p>Your email service is working!</p>",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Brevo error:", res.status, data);
      return;
    }
    console.log("Email sent:", data);
  } catch (error) {
    console.error("Email error:", error);
  }
}

testEmail();