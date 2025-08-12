// utils/mailer.js
const nodemailer = require('nodemailer');

function makeTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

  if (!host) {
    console.warn('⚠️  SMTP_HOST not set — email sending disabled.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  });
}

async function sendEmail({ to, from, subject, text }) {
  const transporter = makeTransport();
  if (!transporter) return;
  const fromAddr = from || process.env.MAIL_FROM || process.env.SMTP_USER;
  const toAddr = to || process.env.MAIL_TO || process.env.SMTP_USER;
  if (!toAddr) {
    console.warn('⚠️  MAIL_TO not set — skipping email send.');
    return;
  }
  await transporter.sendMail({ to: toAddr, from: fromAddr, subject, text });
}

module.exports = { sendEmail };
