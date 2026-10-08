// PUBLIC: what the QR code opens. Shares only the minimum (first name, trip, status) - no email/phone/amount.
const router = require('express').Router();
const { Booking, User } = require('../models');
const { wrap, httpError } = require('../utils/http');

router.get('/:bookingId', wrap(async (req, res) => {
  const b = await Booking.findOne({ bookingId: String(req.params.bookingId).toUpperCase() });
  if (!b) throw httpError(404, 'Booking not found');
  const u = await User.findById(b.user).select('name');
  res.json({ valid: b.status === 'CONFIRMED', status: b.status, bookingId: b.bookingId, title: b.title, travelers: b.travelers,
    startDate: b.startDate, coach: b.coach, seat: b.seat, name: u ? u.name.split(' ')[0] : '' });
}));
module.exports = router;
