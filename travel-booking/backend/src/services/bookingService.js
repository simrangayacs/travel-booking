const { Booking, Flight, Train, Hotel, Package, RoomNight } = require('../models');
const { canTransition } = require('../utils/bookingState');
const { httpError } = require('../utils/http');
const { seatFor, trainSeatFor } = require('../utils/seat');

const INVENTORY = { flight: { model: Flight }, train: { model: Train }, hotel: { model: Hotel }, package: { model: Package } };
const trainBased = b => b.itemType === 'train' || (b.itemType === 'bundle' && b.transport === 'train');
const DAY = 86400000;
const utcDay = d => { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); return x; };
const nightsList = (start, n) => Array.from({ length: n }, (_, i) => new Date(utcDay(start).getTime() + i * DAY));

// Validated + atomic state change: only succeeds if booking is still in one of the `from` states
async function transition(bookingId, from, to, extra = {}) {
  const froms = [].concat(from);
  froms.forEach(f => { if (!canTransition(f, to)) throw httpError(409, `Invalid transition ${f} -> ${to}`); });
  const updated = await Booking.findOneAndUpdate({ _id: bookingId, status: { $in: froms } }, { $set: { status: to, ...extra } }, { new: true });
  if (!updated) throw httpError(409, `Booking is not in ${froms.join('/')} state`);
  return updated;
}

// A booking can hold up to 2 inventory parts (bundle = flight seats + hotel rooms)
function parts(b) {
  const p = [];
  if (['flight', 'train', 'bundle'].includes(b.itemType)) p.push({ kind: 'stock', model: trainBased(b) ? Train : Flight, field: 'seatsAvailable', id: b.itemId, units: b.units });
  if (b.itemType === 'package') p.push({ kind: 'stock', model: Package, field: 'slotsAvailable', id: b.itemId, units: b.units });
  if (b.itemType === 'hotel') p.push({ kind: 'rooms', id: b.itemId, units: b.units, start: b.startDate, nights: b.nights });
  if (b.itemType === 'bundle') p.push({ kind: 'rooms', id: b.hotelId, units: b.hotelUnits, start: b.startDate, nights: b.nights });
  return p;
}

const takeStock = p => p.model.findOneAndUpdate({ _id: p.id, active: true, [p.field]: { $gte: p.units } }, { $inc: { [p.field]: -p.units } }, { new: true });
const giveStock = p => p.model.updateOne({ _id: p.id }, { $inc: { [p.field]: p.units } });

// Atomic per-night counter: the upsert fails with duplicate-key if that night is already full
async function takeRooms(p) {
  const hotel = await Hotel.findOne({ _id: p.id, active: true });
  if (!hotel || hotel.roomsAvailable < p.units) return false;
  const taken = [];
  for (const date of nightsList(p.start, p.nights)) {
    try {
      await RoomNight.findOneAndUpdate({ hotel: p.id, date, booked: { $lte: hotel.roomsAvailable - p.units } }, { $inc: { booked: p.units } }, { upsert: true, new: true });
      taken.push(date);
    } catch (e) {
      if (e.code !== 11000) throw e;
      for (const d of taken) await RoomNight.updateOne({ hotel: p.id, date: d }, { $inc: { booked: -p.units } });
      return false;
    }
  }
  return true;
}
const giveRooms = async p => { for (const date of nightsList(p.start, p.nights)) await RoomNight.updateOne({ hotel: p.id, date }, { $inc: { booked: -p.units } }); };
const take = p => (p.kind === 'rooms' ? takeRooms(p) : takeStock(p));
const give = p => (p.kind === 'rooms' ? giveRooms(p) : giveStock(p));

// All-or-nothing reservation (no overselling, bundle never half-booked)
async function reserve(b) {
  const done = [];
  for (const p of parts(b)) {
    if (!(await take(p))) { for (const d of done) await give(d); return null; }
    done.push(p);
  }
  return true;
}
const release = async b => { for (const p of parts(b)) await give(p); };

async function roomsLeft(hotelId, start, nights) {
  const hotel = await Hotel.findOne({ _id: hotelId, active: true });
  if (!hotel) return 0;
  const from = utcDay(start);
  const rows = await RoomNight.find({ hotel: hotelId, date: { $gte: from, $lt: new Date(from.getTime() + nights * DAY) } }).lean();
  return hotel.roomsAvailable - rows.reduce((m, r) => Math.max(m, r.booked), 0);
}
// Soft availability check (hard check happens atomically in reserve())
async function available(b) {
  for (const p of parts(b)) {
    if (p.kind === 'rooms') { if ((await roomsLeft(p.id, p.start, p.nights)) < p.units) return false; }
    else { const it = await p.model.findOne({ _id: p.id, active: true }); if (!it || it[p.field] < p.units) return false; }
  }
  return true;
}

async function assignSeat(b) {
  if (!['flight', 'train', 'bundle'].includes(b.itemType)) return {};
  // seats already taken on this vehicle (sum of travelers) -> family members get consecutive seats
  const [row] = await Booking.aggregate([
    { $match: { itemId: b.itemId, status: 'CONFIRMED', itemType: { $in: ['flight', 'train', 'bundle'] } } },
    { $group: { _id: null, used: { $sum: '$units' } } },
  ]);
  const used = row ? row.used : 0;
  if (trainBased(b)) { const t = await Train.findById(b.itemId); return trainSeatFor(t ? t.classCode : 'SL', used); }
  return seatFor(used);
}
module.exports = { INVENTORY, transition, reserve, release, available, assignSeat, nightsList };
