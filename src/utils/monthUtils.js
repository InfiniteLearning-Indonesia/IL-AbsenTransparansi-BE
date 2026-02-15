const programConfig = require('../config/programConfig');

const isValidMonth = (month) => {
    const { startMonth, endMonth, monthOrder } = programConfig;

    const startIndex = monthOrder.indexOf(startMonth);
    const endIndex = monthOrder.indexOf(endMonth);
    const targetIndex = monthOrder.indexOf(month);

    if (startIndex === -1 || endIndex === -1 || targetIndex === -1) {
        return false;
    }

    return targetIndex >= startIndex && targetIndex <= endIndex;
};

const normalizePhoneNumber = (phone) => {
    // Remove non-numeric characters
    if (!phone) return "";
    let clean = phone.replace(/\D/g, '');

    // Ensure starts with 62
    if (clean.startsWith('0')) {
        clean = '62' + clean.slice(1);
    } else if (!clean.startsWith('62')) {
        // Assumption: if no prefix, add 62? Or leave as is?
        // User request example: "628xxxx". Let's assume input comes in various forms.
        // If it's just '812...', add '62'.
        clean = '62' + clean;
    }
    return clean;
};

module.exports = {
    isValidMonth,
    normalizePhoneNumber
};
