const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const { JWT_SECRET } = require('../middleware/authMiddleware');

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,         
    sameSite: 'none',     
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
};

const generateToken = (userId) => {
    return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
};

// ─── Login ───
const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username dan password harus diisi.',
            });
        }

        const user = await User.findOne({ username: username.toLowerCase().trim() });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Username atau password salah.',
            });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Username atau password salah.',
            });
        }

        const token = generateToken(user._id);

        res.cookie('token', token, COOKIE_OPTIONS);

        return res.json({
            success: true,
            message: 'Login berhasil.',
            user: user.toJSON(),
        });
    } catch (error) {
        console.error('Login Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server.',
        });
    }
};

// ─── Get Current User ───
const getMe = async (req, res) => {
    return res.json({
        success: true,
        user: req.user,
    });
};

// ─── Update Profile (self) ───
const updateProfile = async (req, res) => {
    try {
        const { name, currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id);

        if (name) {
            user.name = name.trim();
        }

        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Password saat ini harus diisi untuk mengubah password.',
                });
            }

            const isMatch = await user.comparePassword(currentPassword);
            if (!isMatch) {
                return res.status(400).json({
                    success: false,
                    message: 'Password saat ini salah.',
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Password baru minimal 6 karakter.',
                });
            }

            user.password = newPassword; // will be hashed by pre-save hook
        }

        await user.save();

        return res.json({
            success: true,
            message: 'Profil berhasil diperbarui.',
            user: user.toJSON(),
        });
    } catch (error) {
        console.error('Update Profile Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Gagal memperbarui profil.',
        });
    }
};

// ─── List All Users ───
const listUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: 1 });
        return res.json({
            success: true,
            users,
        });
    } catch (error) {
        console.error('List Users Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Gagal mengambil daftar user.',
        });
    }
};

// ─── Create User ───
const createUser = async (req, res) => {
    try {
        const { username, password, name, role } = req.body;

        if (!username || !password || !name) {
            return res.status(400).json({
                success: false,
                message: 'Username, password, dan nama harus diisi.',
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password minimal 6 karakter.',
            });
        }

        // Check duplicate
        const existing = await User.findOne({ username: username.toLowerCase().trim() });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: `Username "${username}" sudah digunakan.`,
            });
        }

        const user = await User.create({
            username: username.toLowerCase().trim(),
            password,
            name: name.trim(),
            role: role === 'superadmin' ? 'superadmin' : 'admin',
        });

        return res.status(201).json({
            success: true,
            message: 'Akun berhasil dibuat.',
            user: user.toJSON(),
        });
    } catch (error) {
        console.error('Create User Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Gagal membuat akun.',
        });
    }
};

// ─── Delete User ───
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan.',
            });
        }

        // Prevent deleting superadmin
        if (user.role === 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Akun Super Admin tidak dapat dihapus.',
            });
        }

        // Prevent deleting self
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Anda tidak dapat menghapus akun sendiri.',
            });
        }

        await User.findByIdAndDelete(id);

        return res.json({
            success: true,
            message: 'Akun berhasil dihapus.',
        });
    } catch (error) {
        console.error('Delete User Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Gagal menghapus akun.',
        });
    }
};

// ─── Logout ───
const logout = async (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
    });

    return res.json({
        success: true,
        message: 'Logout berhasil.',
    });
};

module.exports = {
    login,
    getMe,
    updateProfile,
    listUsers,
    createUser,
    deleteUser,
    logout,
};
