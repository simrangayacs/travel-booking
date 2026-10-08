const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const config = require('../config');
const { MEALS } = require('../utils/meals');

const verifyUrl = id => `${config.frontendUrl.replace(/\/$/, '')}/verify/${id}`;
const qrDataUrl = id => QRCode.toDataURL(verifyUrl(id), { margin: 1, width: 240 });
const ascii = s => String(s || '').replace(/→/g, 'to').replace(/[^\x20-\x7E]/g, ''); // built-in PDF font = ASCII only
const day = d => (d ? new Date(d).toISOString().slice(0, 10) : '-');

async function ticketPdf(b, travelerName) {
  const qr = await QRCode.toBuffer(verifyUrl(b.bookingId), { margin: 1, width: 240 });
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', c => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    doc.rect(0, 0, 595, 90).fill('#0f6fb5');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(26).text('TravelBook E-Ticket', 50, 32);
    doc.fillColor('#12395c').fontSize(12);
    let y = 125;
    const row = (k, v) => {
      const text = ascii(v);
      doc.font('Helvetica-Bold').text(k, 50, y, { width: 140 });
      doc.font('Helvetica').text(text, 200, y, { width: 340 });
      y += Math.max(26, doc.heightOfString(text, { width: 340 }) + 10);
    };
    row('Booking ID', b.bookingId); row('Traveler', travelerName); row('Booking', b.title);
    row('Travelers', String(b.travelers)); row('Date', `${day(b.startDate)}${b.endDate ? ' to ' + day(b.endDate) : ''}`);
    if (b.coach) row('Coach / Seat', `${b.coach} / ${b.seat}`);
    if (b.meal) row('Meal', (MEALS[b.meal] || {}).label || b.meal);
    if (b.couponCode) row('Coupon', b.couponCode);
    row('Amount paid', `INR ${b.total}`); row('Status', b.status);
    doc.image(qr, 50, y + 10, { width: 140 });
    doc.font('Helvetica').fontSize(10).text('Scan this QR code to verify the booking.', 210, y + 70, { width: 300 });
    doc.end();
  });
}
module.exports = { verifyUrl, qrDataUrl, ticketPdf };
