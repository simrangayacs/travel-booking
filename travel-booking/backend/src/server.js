const mongoose = require('mongoose');
const config = require('./config');
const app = require('./app');

mongoose.connect(config.mongoUri)
  .then(() => app.listen(config.port, () => console.log(`API running on :${config.port} (payments: ${config.paymentMode})`)))
  .catch(e => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
