const router = require('express').Router();
const { z } = require('zod');
const { Flight, Train, Hotel, Package, RoomNight, Booking } = require('../models');
const { wrap, escapeRegex } = require('../utils/http');
const { computeTotal, nightsBetween, unitsNeeded } = require('../utils/pricing');

const schema = z.object({
  destination: z.string().trim().min(2).max(60),
  from: z.string().trim().max(60).optional(),
  checkIn: z.string().optional(), checkOut: z.string().optional(),
  travelers: z.coerce.number().int().min(1).max(9).default(1),
  budget: z.coerce.number().positive().optional(),
});

router.get('/', wrap(async (req, res) => {
  const q = schema.parse(req.query);
  const rx = new RegExp(escapeRegex(q.destination), 'i');
  const origin = q.from ? { from: new RegExp(escapeRegex(q.from), 'i') } : {};
  const nights = q.checkIn && q.checkOut ? Math.max(1, nightsBetween(q.checkIn, q.checkOut) || 1) : 1;
  const rooms = unitsNeeded('hotel', q.travelers);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);

  let [flights, trains, hotels, packages] = await Promise.all([
    Flight.find({ to: rx, ...origin, active: true, seatsAvailable: { $gte: q.travelers }, date: { $gte: today } }).sort({ date: 1 }).limit(30).lean(),
    Train.find({ to: rx, ...origin, active: true, seatsAvailable: { $gte: q.travelers }, date: { $gte: today } }).sort({ date: 1, departTime: 1 }).limit(90).lean(),
    Hotel.find({ city: rx, active: true }).limit(30).lean(),
    Package.find({ destination: rx, active: true, slotsAvailable: { $gte: q.travelers } }).limit(30).lean(),
  ]);

  // date-wise availability: rooms per night minus the busiest booked night in the stay
  const ci = q.checkIn ? new Date(q.checkIn) : null;
  if (ci && !isNaN(ci) && hotels.length) {
    const rows = await RoomNight.find({ hotel: { $in: hotels.map(h => h._id) }, date: { $gte: ci, $lt: new Date(ci.getTime() + nights * 86400000) } }).lean();
    const booked = {};
    rows.forEach(r => { booked[String(r.hotel)] = Math.max(booked[String(r.hotel)] || 0, r.booked); });
    hotels = hotels.map(h => ({ ...h, roomsAvailable: h.roomsAvailable - (booked[String(h._id)] || 0) }));
  }
  hotels = hotels.filter(h => h.roomsAvailable >= rooms);

  const tag = (list, type) => list.map(item => ({ ...item, estimatedTotal: computeTotal({ type, item, travelers: q.travelers, nights }).total }));
  const budget = list => (q.budget ? list.filter(i => i.estimatedTotal <= q.budget) : list);
  flights = budget(tag(flights, 'flight'));
  if (q.checkIn) flights.sort((a, b) => Math.abs(new Date(a.date) - new Date(q.checkIn)) - Math.abs(new Date(b.date) - new Date(q.checkIn)));
  trains = budget(tag(trains, 'train'));
  if (q.checkIn) trains.sort((a, b) => Math.abs(new Date(a.date) - new Date(q.checkIn)) - Math.abs(new Date(b.date) - new Date(q.checkIn)) || a.price - b.price);
  hotels = budget(tag(hotels, 'hotel')); packages = budget(tag(packages, 'package'));

  // "Doctors on board": only a COUNT of verified, opted-in doctors travelling on the same flight/train (no identities)
  const keys = [...new Set([...flights.map(f => String(f._id)), ...trains.map(t => t.tripKey)])];
  const docBookings = keys.length ? await Booking.find({ tripKey: { $in: keys }, doctorOptIn: true, status: 'CONFIRMED' }).populate('user', 'doctorVerified').lean() : [];
  const docs = {}; const seen = new Set();
  docBookings.forEach(b => {
    const k = b.tripKey + ':' + (b.user && b.user._id);
    if (b.user && b.user.doctorVerified && !seen.has(k)) { seen.add(k); docs[b.tripKey] = (docs[b.tripKey] || 0) + 1; }
  });
  flights.forEach(f => { f.doctorsOnBoard = docs[String(f._id)] || 0; });
  trains.forEach(t => { t.doctorsOnBoard = docs[t.tripKey] || 0; });

  const spot = hotels.find(h => h.lat) || packages.find(p => p.lat);
  res.json({ flights, trains, hotels, packages, nights, map: spot ? { lat: spot.lat, lng: spot.lng } : null });
}));
module.exports = router;
