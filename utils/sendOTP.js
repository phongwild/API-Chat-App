const nodemailer = require('nodemailer');

async function sendOtp(email, username, otp) {
    try {
        // Configure the transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL,
                pass: process.env.PASSWORD
            }
        });

        // Custom HTML email content
        const emailBody = `
            <div style="font-family: 'Comic Sans MS', cursive, sans-serif; text-align: center; background-color: #FFF0F5; padding: 20px; border-radius: 10px; border: 1px solid #FFB6C1;">
                <h2 style="color: #FF69B4;">✨ Hello, ${username}! ✨</h2>
                <p style="font-size: 18px;">Here's your one-time password:</p>
                <p style="font-size: 28px; color: #FF1493; font-weight: bold;">${otp}</p>
                <p style="font-size: 16px; color: #696969;">This OTP will expire in 5 minutes. Keep it safe! 💕</p>
                <p style="font-size: 14px; color: #A9A9A9;">🐾 Thank you for choosing us! 🐾</p>
            </div>
        `;

        const message = {
            from: process.env.EMAIL,
            to: email,
            subject: '🐱 Your OTP Code 🐱',
            html: emailBody
        };

        // Send email
        await transporter.sendMail(message);
        return { success: true, message: 'OTP sent successfully' };
    } catch (error) {
        console.error('Error sending OTP:', error);
        return { success: false, message: 'Failed to send OTP', error };
    }
}

module.exports = sendOtp;
