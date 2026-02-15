const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const {
    login,
    getMe,
    updateProfile,
    listUsers,
    createUser,
    deleteUser,
    logout,
} = require('../controllers/authController');

// Public
router.post('/login', login);

// Protected (requires auth)
router.get('/me', authMiddleware, getMe);
router.put('/update-profile', authMiddleware, updateProfile);
router.post('/logout', authMiddleware, logout);

// User management (any authenticated admin)
router.get('/users', authMiddleware, listUsers);
router.post('/users', authMiddleware, createUser);
router.delete('/users/:id', authMiddleware, deleteUser);

module.exports = router;
