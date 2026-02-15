const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
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

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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
