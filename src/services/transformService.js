const { calculateStats } = require('../utils/attendanceCalculator');
const { normalizePhoneNumber } = require('../utils/monthUtils');

const transformRecord = (record, month) => {
    const fields = record.fields;

    // Static Fields Mapping
    // Adjust keys based on actual Airtable Column names provided in prompt:
    // "Name", "Institusi", "No WhatsApp", "Program IL", "Jenjang Pendidikan", "Personal Mentor"
    const name = fields['Name'] || fields['Nama'] || '';
    const institusi = fields['Institusi'] || '';
    const personalMentor = fields['Personal Mentor'] || fields['Mentor'] || '';
    const program = fields['Program IL'] || fields['Program'] || '';
    const jenjang = fields['Jenjang Pendidikan'] || fields['Jenjang'] || '';

    // Phone handling
    let whatsapp = fields['No WhatsApp'] || fields['WhatsApp'] || '';
    whatsapp = normalizePhoneNumber(String(whatsapp));

    // Dynamic Attendance Detection
    // Detect keys that are numeric (e.g., "1", "10", "31")
    const attendance = {};

    Object.keys(fields).forEach(key => {
        // Check if key is a number (1-31)
        if (/^\d+$/.test(key)) {
            const day = parseInt(key, 10);
            if (day >= 1 && day <= 31) {
                attendance[key] = fields[key];
            }
        }
    });

    const stats = calculateStats(attendance);

    return {
        name,
        institusi,
        whatsapp,
        program,
        jenjang,
        mentor: personalMentor,
        month,
        attendance,
        stats
    };
};

const transformBatch = (records, month) => {
    return records.map(record => transformRecord(record, month));
};

module.exports = {
    transformRecord,
    transformBatch
};
