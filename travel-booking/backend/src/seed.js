// Demo data. Run: npm run seed   (WARNING: wipes all collections)
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('./config');
const { User, Package, Flight, Train, Hotel, Booking, Payment, Review, AuditLog, EmergencyAlert, RoomNight } = require('./models');

const CITIES = [
  { name: 'Goa', lat: 15.4989, lng: 73.8278, base: 3500, pkg: 'Goa Beach Escape' },
  { name: 'Jaipur', lat: 26.9124, lng: 75.7873, base: 2800, pkg: 'Royal Rajasthan Weekend' },
  { name: 'Manali', lat: 32.2396, lng: 77.1887, base: 3000, pkg: 'Manali Snow Retreat' },
  { name: 'Kochi', lat: 9.9312, lng: 76.2673, base: 3200, pkg: 'Kerala Backwater Break' },
  { name: 'Varanasi', lat: 25.3176, lng: 82.9739, base: 2200, pkg: 'Spiritual Varanasi Trail' },
  { name: 'Mumbai', lat: 19.076, lng: 72.8777, base: 4500, pkg: 'Mumbai City Highlights' },
];
const AIRLINES = [['IndiGo', '6E'], ['Air India', 'AI'], ['SpiceJet', 'SG']];
const TRAIN_CLASSES = [['SL', 'Sleeper', 450, 120], ['3A', 'AC 3 Tier', 1150, 60], ['2A', 'AC 2 Tier', 1650, 40]];
const day = n => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + n); return d; };

(async () => {
  await mongoose.connect(config.mongoUri);
  await Promise.all([User, Package, Flight, Train, Hotel, Booking, Payment, Review, AuditLog, EmergencyAlert, RoomNight].map(m => m.deleteMany({})));

  const hash = p => bcrypt.hash(p, 10);
  const users = await User.create([
    { name: 'Admin', email: 'admin@demo.com', passwordHash: await hash('Admin@1234'), role: 'admin' },
    { name: 'Demo Traveler', email: 'demo@demo.com', passwordHash: await hash('Demo@1234') },
    { name: 'Dr Asha Verma', email: 'doctor@demo.com', passwordHash: await hash('Doctor@1234'), licenseNo: 'MCI-DEMO-1001', doctorVerified: true },
  ]);
  const doctor = users[2];

  const flights = [], hotels = [], packages = [], trains = [];
  CITIES.forEach((c, ci) => {
    [5, 12, 20, 30, 45].forEach((offset, i) => {
      const [airline, code] = AIRLINES[(ci + i) % 3];
      flights.push({ from: i % 2 ? 'Delhi' : 'Patna', to: c.name, airline, flightNo: `${code}${100 + ci * 10 + i}`, date: day(offset),
        departTime: `${6 + i * 3}:30`, arriveTime: `${8 + i * 3}:45`, price: 3500 + ci * 400 + i * 250, seatsAvailable: 60 });
    });
    // fictional train numbers (TBxxxx) so we never misrepresent real railway services
    [4, 11, 19, 28, 40].forEach((offset, i) => {
      const date = day(offset); const number = `TB${1200 + ci * 10 + i}`; const tripKey = `${number}-${date.toISOString().slice(0, 10)}`;
      const origin = ['Gaya', 'Patna', 'Delhi'][(ci + i) % 3];
      TRAIN_CLASSES.forEach(([classCode, className, base, seats]) => trains.push({
        name: `${c.name} Express`, number, from: origin, to: c.name, date, departTime: `${18 + (i % 3)}:15`, arriveTime: `${6 + (i % 4)}:40`,
        classCode, className, price: base + ci * 40, seatsAvailable: seats, tripKey }));
    });
    ['Grand Residency', 'Heritage Stay', 'Budget Inn'].forEach((n, i) => hotels.push({
      name: `${c.name} ${n}`, city: c.name, pricePerNight: Math.round(c.base * [1.3, 1, 0.45][i]), roomsAvailable: 10, rating: [4.6, 4.3, 3.9][i],
      amenities: [['Pool', 'Spa', 'WiFi'], ['Breakfast', 'WiFi'], ['WiFi']][i], lat: c.lat + (i - 1) * 0.008, lng: c.lng + (i - 1) * 0.008 }));
    packages.push({ title: c.pkg, destination: c.name, price: Math.round(c.base * 3.2), durationDays: 3, rating: 4.5, slotsAvailable: 20,
      description: `3 days / 2 nights in ${c.name}: stay, sightseeing and local transfers.`, lat: c.lat, lng: c.lng });
  });
  const [, trainDocs] = await Promise.all([Flight.insertMany(flights), Train.insertMany(trains), Hotel.insertMany(hotels), Package.insertMany(packages)]).then(r => [r, r[1]]);

  // Demo: verified Dr Asha is travelling (opted in) on the first train of every city -> "doctor on board" badge + emergency demo works instantly
  for (const [ci, c] of CITIES.entries()) {
    const t = trainDocs.find(x => x.to === c.name && x.classCode === 'SL' && +x.date === +day(4));
    if (!t) continue;
    await Booking.create({ bookingId: `TB-DEMO-${ci + 1}`, user: doctor._id, itemType: 'train', itemId: t._id, tripKey: t.tripKey,
      title: `${t.name} (${t.number}) ${t.classCode}: ${t.from} → ${t.to}`, travelers: 1, units: 1, nights: 1, startDate: t.date,
      total: Math.round(t.price * 1.05), status: 'CONFIRMED', coach: 'S1', seat: 1, doctorOptIn: true });
    await Train.updateOne({ _id: t._id }, { $inc: { seatsAvailable: -1 } });
  }
  console.log('Seeded.\n admin@demo.com / Admin@1234\n demo@demo.com / Demo@1234\n doctor@demo.com / Doctor@1234 (verified doctor, already on first train of each city)');
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
