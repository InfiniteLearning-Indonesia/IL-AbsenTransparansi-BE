const { batchName } = require('../utils/monthConfig');

const parseAttendance = (record, month) => {
    const fields = record.fields;

    // Normalize Phone
    const { normalizeWA } = require('../utils/phoneUtils');
    let whatsapp = normalizeWA(fields['No WhatsApp'] || fields['WhatsApp']);

    // Basic Info
    const name = fields['Name'] || fields['Nama'] || '';
    const institusi = fields['Institusi'] || '';
    const programIL = fields['Program IL'] || '';
    const jenjang = fields['Jenjang Pendidikan'] || '';
    const mentor = fields['Personal Mentor'] || '';

    // Attendance Parsing
    const attendance = {};
    let hadir = 0;
    let izin = 0;
    let alpha = 0;
    let belumDiisi = 0;

    // Iterate keys to find numeric days
    Object.keys(fields).forEach(key => {
        if (/^\d+$/.test(key)) {
            const val = fields[key];
            if (val) {
                // Store the value (including "null" string from Airtable)
                attendance[key] = val;

                // Categorize
                const status = val.toLowerCase().trim();
                if (status === 'null') {
                    belumDiisi++;
                } else if (status.includes('hadir')) {
                    hadir++; // Covers "Hadir on-cam" and "Hadir off-cam"
                } else if (status === 'izin') {
                    izin++;
                } else if (status === 'alpha') {
                    alpha++;
                }
            }
        }
    });

    // Percentage = hadir / ALL scheduled days (including belumDiisi)
    const totalAllDays = hadir + izin + alpha + belumDiisi;
    const persen = totalAllDays > 0 ? (hadir / totalAllDays) * 100 : 0;

    return {
        name,
        institusi,
        whatsapp,
        programIL,
        jenjang,
        mentor,
        month,
        attendance,
        summary: {
            hadir,
            izin,
            alpha,
            belumDiisi,
            persen: parseFloat(persen.toFixed(2))
        },
        batch: batchName,
        lastFetchedAt: new Date()
    };
};

module.exports = {
    parseAttendance
};
