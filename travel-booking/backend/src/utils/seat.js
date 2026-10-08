// Server assigns coach + seat when a booking is CONFIRMED (needed for the emergency feature)
function seatFor(used) { // flights
  return { coach: ['A', 'B', 'C', 'D'][Math.floor(used / 30) % 4], seat: (used % 30) + 1 };
}
const PREFIX = { SL: 'S', '3A': 'B', '2A': 'A', '1A': 'H', CC: 'C' };
function trainSeatFor(classCode, used) { // trains: coach S1, S2.. (sleeper has 72 berths, AC coaches fewer)
  const perCoach = classCode === 'SL' ? 72 : 54;
  return { coach: `${PREFIX[classCode] || 'S'}${Math.floor(used / perCoach) + 1}`, seat: (used % perCoach) + 1 };
}
// Only a coarse area is ever shown to doctors (privacy): e.g. "Coach B2, seats 6-10"
function seatArea(coach, seat) {
  const s = Number(seat); const lo = Math.floor((s - 1) / 5) * 5 + 1;
  return `Coach ${coach}, seats ${lo}-${lo + 4}`;
}
module.exports = { seatFor, trainSeatFor, seatArea };
