const calculateStats = (attendance) => {
    let hadir = 0;
    let izin = 0;
    let alpha = 0;
    let totalDays = 0;

    for (const status of Object.values(attendance)) {
        const s = status ? status.toLowerCase() : '';
        if (s.includes('hadir') || s.includes('present')) {
            hadir++;
        } else if (s.includes('izin') || s.includes('permit') || s.includes('sakit') || s.includes('sick')) {
            izin++;
        } else if (s.includes('alpha') || s.includes('absent')) {
            alpha++;
        }
        // Only count if status is not empty/null
        if (s) totalDays++;
    }

    // Percentage calculation: (Hadir / Total Recorded Days) * 100
    // Or (Hadir / (Hadir + Izin + Alpha)) ?
    // Usually strict percentage is Hadir vs Total Active Days.
    // Let's use total entries found as denominator.
    const recordedTotal = hadir + izin + alpha;
    const percentage = recordedTotal > 0 ? ((hadir / recordedTotal) * 100) : 0;

    return {
        hadir,
        izin,
        alpha,
        percentage: parseFloat(percentage.toFixed(2))
    };
};

module.exports = {
    calculateStats
};
