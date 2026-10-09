const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const errorHandler = require('./middleware/error');

const app = express();
app.set('trust proxy', 1); // behind Render/Vercel proxies
app.use(helmet());
app.use(cors());

// webhook needs the raw body -> must be registered BEFORE express.json()
app.post('/api/payments/webhook', express.raw({ type: '*/*', limit: '100kb' }), require('./routes/payments').webhook);

app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }), require('./routes/auth'));
app.use('/api/meta', require('./routes/meta'));
app.use('/api/verify', require('./routes/verify'));
app.use('/api/search', require('./routes/search'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/emergency', require('./routes/emergency'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/itinerary', require('./routes/itinerary'));
app.use('/api/admin', require('./routes/admin'));
app.get('/api/health', (_req, res) => res.json({ ok: true, paymentMode: config.paymentMode }));
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);
module.exports = app;
