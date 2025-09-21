const express = require('express');
require('dotenv').config();

const authRoutes = require('./api/auth');
const profileRoutes = require('./api/profile');
const authMiddleware = require('./middlewares/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend server is running!' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profile', authMiddleware, profileRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server is listening on http://localhost:${PORT}`);
});
