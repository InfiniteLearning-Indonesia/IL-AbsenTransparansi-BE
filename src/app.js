const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const adminRoutes = require('./routes/adminRoutes');
const publicRoutes = require('./routes/publicRoutes');
const authRoutes = require('./routes/authRoutes');
const { authMiddleware } = require('./middleware/authMiddleware');
const seedSuperAdmin = require('./utils/seedAdmin');
require('dotenv').config();

const app = express();

/* ===============================
   DATABASE
================================ */
connectDB().then(() => {
    seedSuperAdmin();
});

/* ===============================
   CORS CONFIG
================================ */
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map(origin => origin.trim());

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
}));

// Handle preflight request explicitly
app.options(/.*/, cors({
    origin: allowedOrigins,
    credentials: true,
}));

/* ===============================
   SECURITY & OPTIMIZATION
================================ */
app.use(helmet());
app.use(compression());

/* ===============================
   RATE LIMIT (SKIP OPTIONS)
================================ */
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    skip: (req) => req.method === 'OPTIONS', // 🔥 penting
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    }
});

app.use(limiter);

/* ===============================
   PARSERS & LOGGER
================================ */
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

/* ===============================
   ROUTES
================================ */
app.use('/auth', authRoutes);
app.use('/admin', authMiddleware, adminRoutes);
app.use('/attendance', publicRoutes);

/* ===============================
   GLOBAL ERROR HANDLER
================================ */
app.use((err, req, res, next) => {
    console.error(err.stack);

    // CORS error handler (biar tidak 500 generic)
    if (err.message && err.message.includes('CORS')) {
        return res.status(403).json({
            success: false,
            message: err.message
        });
    }

    res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

module.exports = app;