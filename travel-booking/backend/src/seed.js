const mongoose = require('mongoose');

// Seed Data
const sampleFlights = [
  { flightNumber: 'AI-101', airline: 'Air India', from: 'Patna', to: 'Goa', price: 5000, seats: 50, date: '2026-10-26' },
  { flightNumber: 'IND-202', airline: 'IndiGo', from: 'Delhi', to: 'Patna', price: 3500, seats: 60, date: '2026-10-26' }
];

const sampleTrains = [
  { trainNumber: '12301', name: 'Rajdhani Express', from: 'Gaya', to: 'Patna', price: 800, seats: 100, date: '2026-10-26' },
  { trainNumber: '12302', name: 'Vande Bharat', from: 'Patna', to: 'Delhi', price: 1500, seats: 80, date: '2026-10-26' }
];

async function seedDatabase() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (mongoose.connection.readyState === 0 && mongoUri) {
      await mongoose.connect(mongoUri);
    }

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection not ready!");
    }

    // Insert directly into collections
    await db.collection('flights').deleteMany({});
    await db.collection('flights').insertMany(sampleFlights);

    await db.collection('trains').deleteMany({});
    await db.collection('trains').insertMany(sampleTrains);

    console.log("Database successfully seeded!");
    return true;
  } catch (err) {
    console.error("Seed error:", err);
    throw err;
  }
}

module.exports = seedDatabase;