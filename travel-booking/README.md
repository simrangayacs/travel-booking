# Travel Booking Website — Hackathon Project

Pitch deck ke hisaab se banaya gaya full-stack MVP: **React + Node.js/Express + MongoDB + Razorpay (sandbox)**.

| Deck slide | Code mein kahan |
|---|---|
| 3 MVP scope (Traveler / Admin / System) | `frontend/src/pages/*`, `backend/src/routes/*` |
| 4 User journey (Login → Search → Select → Book → Pay → Confirm → Manage) | Home → BookingPanel → Checkout → Bookings |
| 5 Architecture (React → Express → DB, external services) | `frontend/`, `backend/`, Razorpay/OSM map/AI |
| 6 Data model + booking states | `backend/src/models/index.js`, `utils/bookingState.js` |
| 7 Integrity, payment safety, access control, testing | `services/paymentService.js`, `middleware/auth.js`, `backend/test/` |
| 8 Judge demo storyboard | Section 6 neeche |
| 9 Roadmap / stretch (AI itinerary) | `routes/itinerary.js` |
| 10 Emergency Medical Assistance (train coach / flight seat area) | `routes/emergency.js`, `pages/Emergency.jsx` |

---

## 1. Requirements
- Node.js 18+ (`node -v`), Git
- MongoDB Atlas free account (ya local MongoDB)
- (Optional) Razorpay test account, Anthropic API key (AI itinerary)

## 2. Project structure
```
travel-booking/
├─ backend/   (Express API)  src/{models,routes,services,middleware,utils}, seed.js, test/
└─ frontend/  (React + Vite) src/pages/{Home,Auth,Checkout,Bookings,Emergency,Admin}.jsx
```

## 3. Database (MongoDB Atlas)
1. https://cloud.mongodb.com → free **M0 cluster** banao.
2. *Database Access* → user banao (username + password).
3. *Network Access* → **Add IP → Allow access from anywhere (0.0.0.0/0)** (Render ke liye zaroori).
4. *Connect → Drivers* se connection string copy karo, e.g.
   `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/travel_booking`

## 4. Backend chalao
```bash
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
# .env mein MONGO_URI aur JWT_SECRET bharo
npm run seed                # demo data + demo users
npm run dev                 # http://localhost:5000/api/health
```
Demo logins (sirf demo ke liye): `demo@demo.com / Demo@1234`, `admin@demo.com / Admin@1234`, `doctor@demo.com / Doctor@1234`

## 5. Frontend chalao
```bash
cd frontend
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:5000
npm run dev                 # http://localhost:5173
```

## 6. Judge demo script (slide 8)
1. Home page kholo, traveler ki problem bolo (alag-alag apps, unclear status).
2. Login (`demo@demo.com`) → **Goa**, dates, travelers, budget daalke Search.
3. Flights / hotels / packages + **map** dikhao.
4. Kisi item par **Book** → **Continue to payment** → **Pay successfully** (sandbox).
5. Booking ID + status **CONFIRMED** (server-verified) dikhao.
6. **My Bookings** → status, **Cancel** (refund amount dikhta hai), refund status.
7. Admin login → **Admin dashboard**: reports, inventory edit, bookings, audit trail.
8. Close: **✨ AI itinerary** ya **Emergency Medical Assistance**:
   - Flight book karte waqt *I am a Doctor* tick (demo ke liye `doctor@demo.com` already verified).
   - Dusre browser/incognito mein traveler se same flight book karo → **Emergency** page → *Raise alert*.
   - Doctor wale tab mein alert aata hai (sirf coach/seat area, personal info nahi) → **Accept & assist**.
   - **Demo tip:** dono users ko *same flight* book karwao, tabhi alert match hota hai.

## 7. Payments
- `PAYMENT_MODE=mock` (default): built-in sandbox gateway — internet ya keys ki zaroorat nahi, demo ke liye sabse safe.
- `PAYMENT_MODE=razorpay`: Razorpay **Test Mode** keys `.env` mein daalo (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`). Server signature verify karta hai.
- Webhook (deploy ke baad): Razorpay Dashboard → Webhooks → URL `https://<backend>/api/payments/webhook`, secret = `RAZORPAY_WEBHOOK_SECRET`, events `payment.captured`, `payment.failed`.
- Test card/UPI Razorpay docs ke test details se use karo. Real card kabhi store nahi hota.

## 8. Tests
```bash
cd backend && npm test
```
Pricing, refund policy, booking state transitions, signature verification, seat privacy, aur API guards (auth/validation) cover hote hain. Deck ke "integration tests" ke liye next step: `supertest` + `mongodb-memory-server` (local machine par).

## 9. Deploy

### 9.1 GitHub
```bash
git init && git add . && git commit -m "Travel booking hackathon MVP"
# GitHub par repo banao, phir:
git remote add origin https://github.com/<you>/travel-booking.git && git push -u origin main
```

### 9.2 Backend → Render (free)
1. https://render.com → **New → Web Service** → GitHub repo.
2. Root Directory: `backend` · Build: `npm install` · Start: `npm start`
3. Environment variables:
   `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET` (lamba random string), `PAYMENT_MODE=mock`, `CORS_ORIGIN` (frontend URL, step 9.3 ke baad)
4. Deploy ke baad `https://<name>.onrender.com/api/health` kholo → `{"ok":true}` aana chahiye.
5. Production DB seed (local se, ek baar): `.env` mein Atlas URI rakhke `npm run seed` chalao.
> Render free plan 15 min idle ke baad sleep karta hai — **demo se 5 min pehle health URL khol do**.

### 9.3 Frontend → Vercel (ya Netlify)
1. https://vercel.com → **Add New → Project** → same repo.
2. Root Directory: `frontend` · Framework: Vite
3. Env var: `VITE_API_URL=https://<name>.onrender.com`
4. Deploy → URL milega (e.g. `https://travel-booking.vercel.app`).
5. Wapas Render → `CORS_ORIGIN=https://travel-booking.vercel.app` set karke redeploy.

### 9.4 Post-deploy smoke test
Register → Search Goa → Book → Pay (sandbox) → CONFIRMED → History → Cancel → Admin dashboard.

## 10. Demo-day checklist
- [ ] Seed data fresh (`npm run seed`) — flights ki dates seed ke din se aage ki hoti hain
- [ ] Backend health URL se server jaga hua
- [ ] 3 browser profiles: traveler, doctor, admin
- [ ] Backup: local `npm run dev` + screen recording

## 11. Honest limitations (judges poochhein to seedha bolo)
- Hotels ki availability ab **date-wise** hai (`Hotel.roomsAvailable` = rooms *per night*); packages/flights abhi simple counter par hain.
- Seat assignment simple hai; emergency alerts **polling** (5 sec) se chalte hain, push/WebSocket nahi.
- Emergency feature demo-level hai; production mein trip window check, doctor licence ki real verification aur legal review chahiye. Ye 112/ambulance ka replacement nahi hai.
- SMS notifications abhi nahi. Weather/currency free public APIs se aate hain (sirf helper; internet na ho to widget chhup jaata hai).
- Atlas M0 free tier par transactions use nahi kiye; atomic conditional updates se overselling aur double-confirmation roka gaya hai.

## 12. API quick list
`POST /api/auth/register|login` · `GET /api/search` · `POST /api/bookings/quote` (live price) · `POST /api/bookings` · `GET /api/bookings` · `POST /api/bookings/:id/cancel` ·
`POST /api/payments/:bookingId/order` · `POST /api/payments/verify` · `POST /api/payments/mock/complete` · `POST /api/payments/webhook` ·
`GET /api/bookings/:id/ticket(.pdf)` · `GET /api/verify/:bookingId` (public, QR) · `POST /api/emergency` · `GET /api/emergency/nearby` · `POST /api/emergency/:id/accept` · `POST /api/reviews` · `POST /api/itinerary` · `/api/admin/*`

## 13. Naye features (v2)
| Feature | Kaise use karein |
|---|---|
| **Flight + Hotel bundle (10% off)** | Flight par Book → *Add a hotel to this flight* tick karo → hotel chuno. Ek hi checkout, ek hi payment. |
| **E-ticket PDF + QR** | Booking CONFIRMED hone par Checkout/My Bookings mein *E-ticket (PDF)* aur QR. QR scan karne par `/verify/<bookingId>` khulta hai (public page, sirf first name + trip + status dikhata hai). |
| **Email confirmation** | Backend `.env` mein `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` daalo (Gmail ke liye *App Password*). Khaali ho to email skip hota hai aur log mein likha aata hai. Ticket PDF attach hoke jaata hai. |
| **QR ke liye** | Deploy ke baad Render mein `FRONTEND_URL=<Vercel URL>` zaroor set karo, warna QR localhost wala link dega. |
| **Hindi / English** | Navbar mein `हिं / EN` button (main user pages translate hote hain, admin English mein hai). |
| **Admin charts** | Admin → Reports: 14 din ki revenue aur status-wise bookings ke charts. |
| **Badges** | Cheapest / Top rated / Best value tags search results mein. |
| **Wishlist** | Kisi bhi item par ♡ → *Saved* tab (browser mein save hota hai). |
| **Weather + Currency** | Search ke baad right side mein (Open-Meteo aur open.er-api, free, key nahi chahiye). |
| **PWA** | Deploy ke baad (HTTPS par) browser/phone mein *Install app* option aata hai. |
| **Date-wise hotel availability** | Same hotel alag dates par book ho sakta hai; sold-out sirf unhi raaton ke liye hota hai. Seed dobara chalane se pehle purana data delete ho jaata hai. |

> Dhyan: v1 ke baad naye packages aaye hain (`pdfkit`, `qrcode`, `nodemailer`), isliye **backend mein ek baar `npm install` dobara chalao**.

## 14. v3: Trains, Meals, Coupons, Live price, naya look
| Feature | Details |
|---|---|
| **Train booking** | Search mein *Trains* tab: ek train ke saare classes (SL / 3A / 2A) ek card mein, class button dabake book karo. Optional *From* field (Gaya, Patna, Delhi). Train numbers fictional hain (`TBxxxx`). |
| **Train + Hotel bundle** | Train ya flight dono ke saath 10% bundle discount. |
| **Meal add-on** | Veg / Non-veg / Jain (train, flight) aur Breakfast buffet (hotel, package). Price per traveler, server par calculate. |
| **Coupons** | `WELCOME10` (10%, max ₹1000), `TRAIN5` (sirf train, 5%), `HACKATHON15` (₹5000+ par 15%, max ₹1500). Booking form mein chip dabao. |
| **Live price quote** | Form mein fare, discount, meal, coupon, GST ka breakup turant dikhta hai (`/api/bookings/quote`). Final amount hamesha server se. |
| **Emergency on trains** | Coach (S1, B2, A1...) + seat area ke saath. Same train ke *kisi bhi class/coach* ke opted-in verified doctors ko alert milta hai. |
| **Doctors on board** | Search results mein sirf count dikhta hai (identity nahi): `🩺 1 doctor on board`. |
| **Naya look** | Hero mode chips, popular destinations tiles, "Why TravelBook" strip, booking countdown (`in 5 days`). |

### Emergency demo (train) - 2 minute
1. `npm run seed` ke baad `doctor@demo.com` (verified) har city ki pehli train (4 din baad) mein pehle se opted-in hai.
2. Traveler (`demo@demo.com`) se Goa (ya koi bhi city) search karo → *Trains* tab → pehli train → **🩺 1 doctor on board** badge dikhega → kisi bhi class ka ticket book + pay karo.
3. *Emergency* page → apni train booking chuno → **Raise Emergency Medical Alert**.
4. Dusre browser mein `doctor@demo.com` login → *Emergency* page → alert (sirf coach/seat area) → **Accept & assist**.
5. Traveler ke page par doctor ka pehla naam + ✔ Verified badge dikhta hai.

> Seed dobara chalane par purana data delete hota hai. Naye packages nahi jude, par `npm install` ek baar fir chala lena (safe).
