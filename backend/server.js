const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const studentAuthRouter = require('./routes/studentAuth');
const educatorAuthRouter = require('./routes/educatorAuth');
const adminAuthRouter = require('./routes/adminAuth');

const app = express();
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/student/auth', studentAuthRouter);
app.use('/api/educator/auth', educatorAuthRouter);
app.use('/api/admin/auth', adminAuthRouter);

app.get('/api/hello', (req, res) => res.json({ message: 'Hello from backend' }));

const PORT = process.env.PORT || 5000;
const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/mern_demo';

mongoose
  .connect(MONGO)
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('DB connection error', err);
    process.exit(1);
  });
