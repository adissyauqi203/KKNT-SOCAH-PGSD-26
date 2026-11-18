require('dotenv').config();
const express = require('express');
const path = require('path');
const chatHandler = require('./api/chat');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => {
  if (path.basename(req.path).toLowerCase().includes('.env')) {
    return res.sendStatus(404);
  }
  next();
});
app.use(express.static(path.join(__dirname)));
app.post('/api/chat', chatHandler);

app.use((error, req, res, next) => {
  if (!req.path.startsWith('/api/')) {
    return next(error);
  }

  if (res.headersSent) {
    return next(error);
  }

  const status = Number.isInteger(error.status) ? error.status : 500;
  const message = error.type === 'entity.parse.failed'
    ? 'Body request harus berupa JSON yang valid.'
    : error.type === 'entity.too.large'
      ? 'Ukuran request terlalu besar.'
      : 'Terjadi kesalahan saat memproses request AI.';

  console.error(`API request failed with HTTP ${status}: ${message}`);
  return res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
