const Attendance = require('../models/menteeAttendanceModel');

const checkAttendance = async (req, res) => {
    const { whatsapp } = req.body;

    if (!whatsapp) {
        return res.status(400).json({
            success: false,
            message: "WhatsApp number is required."
        });
    }

    // Normalize input phone just in case, or assume FE sends clean data.
    // Ideally, mirror the normalization logic in attendanceService.
    let cleanPhone = whatsapp.toString().replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
        cleanPhone = '62' + cleanPhone.slice(1);
    } else if (cleanPhone.startsWith('8')) {
        cleanPhone = '62' + cleanPhone;
    }

    try {
        const data = await Attendance.find({ whatsapp: cleanPhone }).sort({ month: 1 }); // Sorted by month or createdAt

        if (!data || data.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No attendance data found for this number."
            });
        }

        return res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error("[Mentee Check Error]", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

module.exports = {
    checkAttendance
};
