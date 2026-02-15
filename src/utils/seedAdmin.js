const User = require('../models/userModel');

const seedSuperAdmin = async () => {
    try {
        const existing = await User.findOne({ role: 'superadmin' });
        if (existing) {
            console.log(`✅ Super Admin already exists: "${existing.username}"`);
            return;
        }

        const superAdmin = await User.create({
            username: 'admin',
            password: 'ILAdminAbsensiB10#2026',
            name: 'Super Admin',
            role: 'superadmin',
        });

        console.log(`🔑 Super Admin created: username="${superAdmin.username}"`);
    } catch (error) {
        console.error('❌ Failed to seed Super Admin:', error.message);
    }
};

module.exports = seedSuperAdmin;
