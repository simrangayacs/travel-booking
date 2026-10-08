const nodemailer = require('nodemailer');
const config = require('../config');
const { User } = require('../models');
const { ticketPdf, verifyUrl } = require('./ticketService');

let tx;
const transport = () => {
  if (!config.smtp.host) return null;
  if (!tx) tx = nodemailer.createTransport({ host: config.smtp.host, port: Number(config.smtp.port) || 587, secure: Number(config.smtp.port) === 465, auth: { user: config.smtp.user, pass: config.smtp.pass } });
  return tx;
};
async function send(to, subject, text, attachments) {
  const t = transport();
  if (!t) return console.log(`[email skipped - SMTP not configured] to=${to} | ${subject}`);
  await t.sendMail({ from: config.smtp.from || config.smtp.user, to, subject, text, attachments });
}

async function sendConfirmation(b) {
  const u = await User.findById(b.user);
  const pdf = await ticketPdf(b, u.name);
  await send(u.email, `Booking confirmed: ${b.bookingId}`,
    `Hi ${u.name},\n\nYour booking ${b.bookingId} (${b.title}) is confirmed. Your e-ticket is attached.\nVerify online: ${verifyUrl(b.bookingId)}\n\nHappy travels!\nTravelBook`,
    [{ filename: `ticket-${b.bookingId}.pdf`, content: pdf }]);
}
async function sendCancellation(b, refund) {
  const u = await User.findById(b.user);
  await send(u.email, `Booking cancelled: ${b.bookingId}`,
    `Hi ${u.name},\n\nYour booking ${b.bookingId} (${b.title}) has been cancelled.${refund ? ` A refund of INR ${refund} is being processed.` : ''}\n\nTravelBook`);
}
module.exports = { sendConfirmation, sendCancellation };
