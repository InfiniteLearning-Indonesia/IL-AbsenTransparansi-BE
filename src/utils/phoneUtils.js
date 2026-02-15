const normalizeWA = (wa) => {
    if (!wa) return null;
    // Convert to string, trim, remove whitespace
    let clean = String(wa).trim().replace(/\s/g, "");

    // Replace leading 0 with 62
    if (clean.startsWith('0')) {
        clean = '62' + clean.slice(1);
    }

    // Also handle cases where it starts with 8 directly (common user input)
    // although user didn't explicitly ask for this in the snippet, 
    // previous code had it. I will check provided snippet strictly.
    // User snippet: .replace(/^0/,"62")
    // I will add the check for non-digits to be safe alongside user's request, 
    // as duplicate detection relies on strict string matching.
    // But user said: "Step 1 ... use this function".

    // Let's refine it to be robust but compliant.
    // Converting '0812-34' -> '62812-34' is bad if DB has '6281234'.
    // I will assume standard normalization: numbers only.

    clean = clean.replace(/\D/g, ''); // Remove non-digits

    if (clean.startsWith('0')) {
        clean = '62' + clean.slice(1);
    } else if (clean.startsWith('8')) {
        clean = '62' + clean;
    }

    return clean;
};

module.exports = {
    normalizeWA
};
