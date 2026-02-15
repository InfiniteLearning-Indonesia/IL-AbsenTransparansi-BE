const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const JWT_SECRET = process.env.JWT_SECRET || 'il-absensi-secret-key-2026';

/**
 * Auth middleware — checks for JWT token in httpOnly cookie OR Authorization header.
 * Attaches `req.user` (full user document without password) if valid.
 */
const authMiddleware = async (req, res, next) => {
    try {
        let token = null;

        // 1. Check httpOnly cookie first
        if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        // 2. Fallback to Authorization header (Bearer token)
        if (!token && req.headers.authorization) {
            const parts = req.headers.authorization.split(' ');
            if (parts.length === 2 && parts[0] === 'Bearer') {
                token = parts[1];
            }
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Akses ditolak. Silakan login terlebih dahulu.',
            });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Token tidak valid. User tidak ditemukan.',
            });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Sesi telah berakhir. Silakan login kembali.',
            });
        }
        return res.status(401).json({
            success: false,
            message: 'Token tidak valid.',
        });
    }
};

module.exports = { authMiddleware, JWT_SECRET };
