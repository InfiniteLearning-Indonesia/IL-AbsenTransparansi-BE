const mongoose = require('mongoose');

const menteeAttendanceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    institusi: {
        type: String,
        default: ''
    },
    whatsapp: {
        type: String,
        required: true,
        index: true // Indexed for fast lookup by phone
    },
    programIL: {
        type: String,
        default: ''
    },
    jenjang: {
        type: String,
        default: ''
    },
    mentor: {
        type: String,
        default: ''
    },
    month: {
        type: String,
        required: true
    },
    batch: {
        type: String,
        default: ''
    },
    attendance: {
        type: Map,
        of: String
        // Keys: date numbers (e.g. "10", "18"). Values: status string or "null" (belum diisi)
    },
    summary: {
        hadir: { type: Number, default: 0 },
        izin: { type: Number, default: 0 },
        alpha: { type: Number, default: 0 },
        belumDiisi: { type: Number, default: 0 },
        persen: { type: Number, default: 0 } // hadir / totalAllDays * 100
    },
    lastFetchedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    strict: false // Allow fields not strictly defined (safety net)
});

// Composite index to ensure one record per mentee per month
menteeAttendanceSchema.index({ whatsapp: 1, month: 1 }, { unique: true });

const MenteeAttendance = mongoose.model('MenteeAttendance', menteeAttendanceSchema);

module.exports = MenteeAttendance;
