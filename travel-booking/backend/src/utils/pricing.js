const TAX_RATE = 0.05;
const BUNDLE_DISCOUNT = 0.10; // transport + hotel together
const unitsNeeded = (type, travelers) => (type === 'hotel' ? Math.ceil(travelers / 2) : travelers); // 2 guests / room
const nightsBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

// Single place where every price is built. Never trust the client for money.
function breakup({ base, bundleDiscount = 0, extra = 0, coupon = null }) {
  const subtotal = base - bundleDiscount + extra;
  const couponDiscount = coupon ? Math.min(coupon.max, Math.round((subtotal * coupon.percent) / 100)) : 0;
  const taxable = subtotal - couponDiscount;
  const tax = Math.round(taxable * TAX_RATE);
  return { base, discount: bundleDiscount, extra, couponDiscount, tax, total: taxable + tax };
}
const hotelBase = (hotel, travelers, nights) => hotel.pricePerNight * Math.max(1, nights) * unitsNeeded('hotel', travelers);

function computeTotal({ type, item, travelers, nights = 1, extra = 0, coupon = null }) {
  const base = type === 'hotel' ? hotelBase(item, travelers, nights) : item.price * travelers;
  return breakup({ base, extra, coupon });
}
// `flight` = the transport item (flight OR train class) of the bundle
function computeBundle({ flight, hotel, travelers, nights, extra = 0, coupon = null }) {
  const base = flight.price * travelers + hotelBase(hotel, travelers, nights);
  return breakup({ base, bundleDiscount: Math.round(base * BUNDLE_DISCOUNT), extra, coupon });
}

// >=48h before start: 100% | <48h: 50% | started: 0%
function refundAmount(total, startDate, now = new Date()) {
  const hours = (new Date(startDate) - now) / 36e5;
  if (hours >= 48) return total;
  if (hours > 0) return Math.round(total * 0.5);
  return 0;
}

const CANCELLABLE = ['DRAFT', 'PAYMENT_PENDING', 'PAYMENT_FAILED', 'CONFIRMED'];
function isCancellable(status, startDate, now = new Date()) {
  if (!CANCELLABLE.includes(status)) return false;
  if (status === 'CONFIRMED' && new Date(startDate) <= now) return false;
  return true;
}
module.exports = { BUNDLE_DISCOUNT, TAX_RATE, unitsNeeded, nightsBetween, breakup, computeTotal, computeBundle, refundAmount, isCancellable };
