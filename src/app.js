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

// Connect Database & seed super admin
connectDB().then(() => {
    seedSuperAdmin();
});

// Security & Optimization Middleware
app.use(helmet());
app.use(compression());

// Rate Limiting: Max 100 requests per 1 minute per IP
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    }
});
app.use(limiter);

// Middleware
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map(origin => origin.trim());

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true, // Allow cookies
}));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// Routes
app.use('/auth', authRoutes);                       // Public: /auth/login — Protected: /auth/me, etc.
app.use('/admin', authMiddleware, adminRoutes);      // All admin routes require authentication
app.use('/attendance', publicRoutes);                // Public routes for mentees

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

module.exports = app;
