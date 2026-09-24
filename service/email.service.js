const nodemailer = require("nodemailer");
require("dotenv").config();
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.USER_EMAIL,
    pass: process.env.USER_PASS,
  },
});

exports.sendVerificationEmail = async (email, token) => {
  //change the URL to your frontend verification page
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  //  const verificationUrl = `http://localhost:5173/verify-email?token=${token}`;
 console.log("email",email);
  await transporter.sendMail({
    from: `"Oulamauna" <${process.env.USER_EMAIL}>`,
    to: email,
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
      ">
        Verify Email
      </a> 
      <p>If you didn't create an account, ignore this email.</p>
    `,
  });
};


exports.sendResetPasswordEmail = async(email,token) =>{
 
   const resetURL = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  await transporter.sendMail({
    from :`"Oulamauna" <${process.env.USER_EMAIL}>`,
    to:email,
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
      ">
        Reset Password
      </a>
      <p style="margin-top: 15px;">If you did not request a password reset, you can safely ignore this email.</p>
    `
  })
}

exports.sendContactReplyEmail = async (userEmail, originalSubject, replyText) => {
  await transporter.sendMail({
    from: `"Oulamauna Support" <${process.env.USER_EMAIL}>`,
    to: userEmail,
    subject: `Re: ${originalSubject || 'Contact Us Message'}`,
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f4f4f7; padding: 40px 20px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          
          <!-- Top Brand Accent Line -->
          <div style="background-color: #0b4335; height: 6px;"></div>
          
          <!-- Main Content -->
          <div style="padding: 40px 30px;">
            <h1 style="margin: 0 0 20px 0; font-size: 22px; color: #111827; font-weight: 600;">Hello,</h1>
            <p style="margin: 0 0 20px 0; font-size: 15px; color: #4b5563; line-height: 1.6;">
              Thank you for reaching out to Oulamauna. Our team has reviewed your message, and here is our response:
            </p>
            
            <!-- Clean Reply Box -->
            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 24px 0;">
              <p style="margin: 0; font-size: 15px; color: #1f2937; line-height: 1.6; white-space: pre-wrap;">${replyText}</p>
            </div>

            <p style="margin: 24px 0 0 0; font-size: 15px; color: #4b5563; line-height: 1.6;">
              If you have any further questions, please feel free to reply directly to this email.
            </p>
            
            <p style="margin: 30px 0 0 0; font-size: 15px; color: #111827; line-height: 1.6;">
              Best regards,<br>
              <strong style="color: #0b4335;">The Oulamauna Team</strong>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #9ca3af;">
              © ${new Date().getFullYear()} Oulamauna. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `,
  });
};