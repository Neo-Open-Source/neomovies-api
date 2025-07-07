const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || process.env.gmail_user,
    pass: process.env.GMAIL_APP_PASSWORD || process.env.gmail_app_password
  }
});

async function sendVerificationEmail(to, code) {
  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER || process.env.gmail_user,
      to,
      subject: 'Подтверждение регистрации Neo Movies',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2196f3;">Neo Movies</h1>
          <p>Здравствуйте!</p>
          <p>Для завершения регистрации введите этот код:</p>
          <div style="
            background: #f5f5f5;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            font-size: 24px;
            letter-spacing: 4px;
            margin: 20px 0;
          ">
            ${code}
          </div>
          <p>Код действителен в течение 10 минут.</p>
          <p>Если вы не регистрировались на нашем сайте, просто проигнорируйте это письмо.</p>
        </div>
      `
    });
    return { success: true };
  } catch (err) {
    console.error('Error sending verification email:', err);
    return { error: 'Failed to send email' };
  }
}

module.exports = { sendVerificationEmail };
