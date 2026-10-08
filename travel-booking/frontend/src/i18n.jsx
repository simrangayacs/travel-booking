import { createContext, useContext, useState } from 'react';

const D = {
  en: {
    search: 'Search', bookings: 'My Bookings', emergency: 'Emergency', admin: 'Admin', login: 'Login', logout: 'Logout',
    hero: 'Search. Compare. Book. Pay. Manage.', hero_sub: 'Flights, hotels and holiday packages in one place.',
    destination: 'Destination', checkin: 'Check-in', checkout: 'Check-out', travelers: 'Travelers', budget: 'Budget (₹)', optional: 'optional',
    searching: 'Searching…', trains: 'Trains', from: 'From (optional)', popular: 'Popular destinations', why: 'Why TravelBook', meal: 'Meal add-on', coupon: 'Coupon code', apply: 'Apply', total: 'Total', flights: 'Flights', hotels: 'Hotels', packages: 'Packages', saved: 'Saved', book: 'Book', est_total: 'Est. total',
    per_person: '/ person', per_night: '/ night', cheapest: 'Cheapest', top_rated: 'Top rated', best_value: 'Best value',
    bundle_add: 'Add a hotel to this flight (10% bundle discount)', ai_plan: '✨ Plan my trip (AI itinerary)', weather: 'Weather', currency: 'Currency converter',
    no_bookings: 'No bookings yet.', cancel: 'Cancel', continue_pay: 'Continue payment', ticket: 'E-ticket (PDF)', checkout_title: 'Checkout',
    pay: 'Pay', confirmed: 'Booking confirmed', scan_qr: 'Scan to verify this booking', continue_checkout: 'Continue to payment',
    no_saved: 'Nothing saved yet. Tap ♡ on any item.', verify_ok: 'Valid confirmed booking', verify_bad: 'Not a valid confirmed booking', view_bookings: 'View my bookings',
  },
  hi: {
    search: 'खोजें', bookings: 'मेरी बुकिंग', emergency: 'इमरजेंसी', admin: 'एडमिन', login: 'लॉगिन', logout: 'लॉगआउट',
    hero: 'खोजें। तुलना करें। बुक करें। भुगतान करें। मैनेज करें।', hero_sub: 'फ्लाइट, होटल और हॉलिडे पैकेज, सब एक ही जगह।',
    destination: 'गंतव्य', checkin: 'चेक-इन', checkout: 'चेक-आउट', travelers: 'यात्री', budget: 'बजट (₹)', optional: 'वैकल्पिक',
    searching: 'खोज रहे हैं…', trains: 'ट्रेनें', from: 'कहाँ से (वैकल्पिक)', popular: 'लोकप्रिय गंतव्य', why: 'TravelBook क्यों', meal: 'भोजन ऐड-ऑन', coupon: 'कूपन कोड', apply: 'लगाएं', total: 'कुल', flights: 'उड़ानें', hotels: 'होटल', packages: 'पैकेज', saved: 'सेव किए', book: 'बुक करें', est_total: 'अनुमानित कुल',
    per_person: '/ व्यक्ति', per_night: '/ रात', cheapest: 'सबसे सस्ता', top_rated: 'टॉप रेटेड', best_value: 'बेस्ट वैल्यू',
    bundle_add: 'इस फ्लाइट के साथ होटल जोड़ें (10% बंडल छूट)', ai_plan: '✨ मेरा ट्रिप प्लान करें (AI)', weather: 'मौसम', currency: 'करेंसी कन्वर्टर',
    no_bookings: 'अभी कोई बुकिंग नहीं।', cancel: 'रद्द करें', continue_pay: 'भुगतान जारी रखें', ticket: 'ई-टिकट (PDF)', checkout_title: 'चेकआउट',
    pay: 'भुगतान करें', confirmed: 'बुकिंग कन्फर्म', scan_qr: 'बुकिंग वेरिफाई करने के लिए स्कैन करें', continue_checkout: 'भुगतान पर जाएं',
    no_saved: 'अभी कुछ सेव नहीं। किसी आइटम पर ♡ दबाएं।', verify_ok: 'मान्य कन्फर्म्ड बुकिंग', verify_bad: 'यह मान्य कन्फर्म्ड बुकिंग नहीं है', view_bookings: 'मेरी बुकिंग देखें',
  },
};
const Ctx = createContext(null);
export const useT = () => useContext(Ctx);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(localStorage.getItem('tb_lang') || 'en');
  const toggle = () => { const n = lang === 'en' ? 'hi' : 'en'; localStorage.setItem('tb_lang', n); setLang(n); };
  const t = k => D[lang][k] || D.en[k] || k;
  return <Ctx.Provider value={{ lang, toggle, t }}>{children}</Ctx.Provider>;
}
