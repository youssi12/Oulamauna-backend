
require("dotenv").config();
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail(message) {
  const { data, error } = await resend.emails.send(message);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

exports.sendVerificationEmail = async (email, token) => {
  const verificationUrl =
    `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  await sendEmail({
    from: "Oulamauna <onboarding@resend.dev>",
    to: [email],
    subject: "Verify your email",
    html: `
      <h2>Email Verification</h2>
      <p>Click the link below to verify your email. It expires in <b>24 hours</b>.</p>
      <a href="${verificationUrl}" style="
        display: inline-block;
        padding: 10px 20px;
        background-color: #4CAF50;
        color: white;
        text-decoration: none;
        border-radius: 5px;
      ">Verify Email</a>
      <p>If you didn't create an account, ignore this email.</p>
    `,
  });
};

exports.sendResetPasswordEmail = async (email, token) => {
  const resetURL =
    `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  await sendEmail({
    from: "Oulamauna <onboarding@resend.dev>",
    to: [email],
    subject: "Password Reset Request",
    html: `
      <h2>Reset Your Password</h2>
      <p>Click the link below to reset your password. It expires in <b>1 hour</b>.</p>
      <a href="${resetURL}" style="
        display: inline-block;
        padding: 10px 20px;
        background-color: #4CAF50;
        color: white;
        text-decoration: none;
        border-radius: 5px;
      ">Reset Password</a>
      <p style="margin-top: 15px;">
        If you did not request a password reset, you can safely ignore this email.
      </p>
    `,
  });
};

exports.sendContactReplyEmail = async (
  userEmail,
  originalSubject,
  replyText
) => {
  await sendEmail({
    from: "Oulamauna Support <onboarding@resend.dev>",
    to: [userEmail],
    subject: `Re: ${originalSubject || "Contact Us Message"}`,
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f4f4f7; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #0b4335; height: 6px;"></div>
          <div style="padding: 40px 30px;">
            <h1 style="font-size: 22px; color: #111827;">Hello,</h1>
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
              Thank you for reaching out to Oulamauna. Our team has reviewed
              your message, and here is our response:
            </p>
            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 24px 0;">
              <p style="font-size: 15px; color: #1f2937; line-height: 1.6; white-space: pre-wrap;">${replyText}</p>
            </div>
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
              If you have any further questions, please feel free to reply directly to this email.
            </p>
            <p style="margin-top: 30px; color: #111827;">
              Best regards,<br>
              <strong style="color: #0b4335;">The Oulamauna Team</strong>
            </p>
          </div>
          <div style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #9ca3af;">
              © ${new Date().getFullYear()} Oulamauna. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `,
  });
};
