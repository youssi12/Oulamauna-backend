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
    const verificationUrl = `${process.env.BASE_URL}/api/auth/verify-email?token=${token}`;
  //  const verificationUrl = `http://localhost:5173/verify-email?token=${token}`;
 console.log("email",email);
  await transporter.sendMail({
    from: `"App Name" <${process.env.EMAIL_USER}>`,
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
 
   const resetURL = `${process.env.BASE_URL}/api/auth/reset-password?token=${token}`;

  await transporter.sendMail({
    from :`"Oulamauna" <${process.env.EMAIL_USER}>`,
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