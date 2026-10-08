const mongoose = require('mongoose');
const { Schema } = mongoose;
const T = { timestamps: true };
const oid = (ref, extra = {}) => ({ type: Schema.Types.ObjectId, ref, ...extra });

const BOOKING_STATES = ['DRAFT', 'PAYMENT_PENDING', 'CONFIRMED', 'PAYMENT_FAILED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED'];

const User = mongoose.model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  licenseNo: { type: String, trim: true },            // medical licence (voluntary)
  doctorVerified: { type: Boolean, default: false },  // admin verifies -> badge
}, T));

const Package = mongoose.model('Package', new Schema({
  title: { type: String, required: true }, destination: { type: String, required: true, index: true },
  price: { type: Number, required: true, min: 0 }, durationDays: { type: Number, default: 3, min: 1 },
  rating: { type: Number, default: 4, min: 0, max: 5 }, description: String,
  lat: Number, lng: Number, slotsAvailable: { type: Number, default: 20, min: 0 }, active: { type: Boolean, default: true },
}, T));

const Flight = mongoose.model('Flight', new Schema({
  from: { type: String, required: true }, to: { type: String, required: true, index: true },
  airline: String, flightNo: String, date: { type: Date, required: true },
  departTime: String, arriveTime: String,
  price: { type: Number, required: true, min: 0 }, seatsAvailable: { type: Number, default: 60, min: 0 }, active: { type: Boolean, default: true },
}, T));

const Hotel = mongoose.model('Hotel', new Schema({
  name: { type: String, required: true }, city: { type: String, required: true, index: true },
  pricePerNight: { type: Number, required: true, min: 0 }, roomsAvailable: { type: Number, default: 10, min: 0 },
  rating: { type: Number, default: 4, min: 0, max: 5 }, amenities: [String],
  lat: Number, lng: Number, active: { type: Boolean, default: true },
}, T));

// One document per train + class (SL / 3A / 2A ...). tripKey groups all classes of the same train on the same date.
const trainSchema = new Schema({
  name: { type: String, required: true }, number: { type: String, required: true },
  from: { type: String, required: true }, to: { type: String, required: true, index: true }, date: { type: Date, required: true },
  departTime: String, arriveTime: String,
  classCode: { type: String, enum: ['SL', '3A', '2A', '1A', 'CC'], required: true }, className: String,
  price: { type: Number, required: true, min: 0 }, seatsAvailable: { type: Number, default: 60, min: 0 },
  tripKey: { type: String, index: true }, active: { type: Boolean, default: true },
}, T);
trainSchema.pre('validate', function () { if (!this.tripKey && this.number && this.date) this.tripKey = `${this.number}-${new Date(this.date).toISOString().slice(0, 10)}`; });
const Train = mongoose.model('Train', trainSchema);

const Booking = mongoose.model('Booking', new Schema({
  bookingId: { type: String, unique: true, index: true },
  user: oid('User', { index: true, required: true }),
  itemType: { type: String, enum: ['flight', 'train', 'hotel', 'package', 'bundle'], required: true },
  itemId: { type: Schema.Types.ObjectId, required: true, index: true },
  title: String, travelers: Number, units: Number, nights: Number,
  transport: String, // bundle only: 'flight' | 'train'
  meal: String, mealCost: { type: Number, default: 0 }, couponCode: String, couponDiscount: { type: Number, default: 0 },
  tripKey: { type: String, index: true }, // same key = same flight / same train+date (all classes) -> used by emergency matching
  hotelId: Schema.Types.ObjectId, hotelUnits: Number, discount: { type: Number, default: 0 }, // bundle = flight (itemId) + hotel (hotelId)
  startDate: Date, endDate: Date,
  total: { type: Number, required: true }, currency: { type: String, default: 'INR' },
  status: { type: String, enum: BOOKING_STATES, default: 'DRAFT', index: true },
  refundAmount: { type: Number, default: 0 },
  coach: String, seat: String,
  doctorOptIn: { type: Boolean, default: false },
}, T));

const Payment = mongoose.model('Payment', new Schema({
  booking: oid('Booking', { index: true, required: true }),
  gateway: String, orderId: { type: String, unique: true }, paymentId: String,
  amount: Number, status: { type: String, enum: ['CREATED', 'PAID', 'FAILED', 'REFUNDED'], default: 'CREATED' },
  refundId: String, eventIds: [String],   // processed webhook ids -> idempotency
}, T));

const Review = mongoose.model('Review', new Schema({
  user: oid('User', { required: true }), targetType: { type: String, enum: ['flight', 'train', 'hotel', 'package'] },
  targetId: Schema.Types.ObjectId, rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, maxlength: 500 }, status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
}, T));

const AuditLog = mongoose.model('AuditLog', new Schema({
  actor: oid('User'), action: String, entity: String, entityId: String, meta: Schema.Types.Mixed,
}, T));

const EmergencyAlert = mongoose.model('EmergencyAlert', new Schema({
  booking: oid('Booking', { required: true }), raisedBy: oid('User', { required: true }),
  itemId: { type: Schema.Types.ObjectId, index: true }, tripKey: { type: String, index: true }, coach: String, seat: String, seatArea: String, note: { type: String, maxlength: 200 },
  status: { type: String, enum: ['OPEN', 'ACCEPTED', 'RESOLVED'], default: 'OPEN', index: true },
  acceptedBy: oid('User'), acceptedAt: Date,
}, T));

// Date-wise hotel availability: rooms already booked per hotel per night (Hotel.roomsAvailable = rooms per night)
const RoomNight = mongoose.model('RoomNight', new Schema({
  hotel: oid('Hotel', { required: true }), date: { type: Date, required: true }, booked: { type: Number, default: 0 },
}).index({ hotel: 1, date: 1 }, { unique: true }));

module.exports = { Train, RoomNight, User, Package, Flight, Hotel, Booking, Payment, Review, AuditLog, EmergencyAlert, BOOKING_STATES };
