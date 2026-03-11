const { fetchTableData } = require('../services/airtableService');
const { parseAttendance } = require('../services/attendanceService');
const Attendance = require('../models/menteeAttendanceModel');
const { validMonths } = require('../utils/monthConfig');

/**
 * Core sync logic — extracted so it can be reused by single-month and all-months sync.
 * Returns { success, stats, skippedRecords, duplicateRecords } or throws.
 */
const syncMonth = async (month) => {
    console.log(`[Fetch] Starting sync for ${month}...`);

    const rawRecords = await fetchTableData(month);
    console.log(`[Fetch] Retrieved ${rawRecords.length} records from Airtable.`);

    if (rawRecords.length === 0) {
        return { success: false, message: `Table ${month} is empty or not found.`, stats: null };
    }

    // DEBUG: Log field names from first record
    if (rawRecords.length > 0) {
        const firstFields = rawRecords[0].fields;
        const fieldNames = Object.keys(firstFields);
        console.log(`[DEBUG] All field names from Airtable (${month}):`, fieldNames);
    }

    const operations = [];
    const skippedRecords = [];
    const duplicateRecords = [];
    const seenWA = new Set();

    rawRecords.forEach(record => {
        const doc = parseAttendance(record, month);
        const whatsapp = doc.whatsapp;
        const name = doc.name;

        if (!whatsapp) {
            console.log("[SKIP] No WhatsApp kosong:", name);
            skippedRecords.push({ name, reason: "no_whatsapp" });
            return;
        }

        if (whatsapp.length < 10) {
            console.log("[SKIP] WA terlalu pendek:", whatsapp, name);
            skippedRecords.push({ name, reason: "invalid_length" });
            return;
        }

        if (seenWA.has(whatsapp)) {
            console.log("[DUPLICATE WA DETECTED] Skip duplicate in batch:", whatsapp, name);
            duplicateRecords.push({ whatsapp, name });
            return;
        }
        seenWA.add(whatsapp);

        operations.push({
            updateOne: {
                filter: { whatsapp: doc.whatsapp, month: month },
                update: { $set: doc },
                upsert: true
            }
        });
    });

    console.log("TOTAL FETCHED:", rawRecords.length);
    console.log("TOTAL OPERATIONS:", operations.length);
    console.log("SKIPPED:", skippedRecords.length);
    console.log("DUPLICATES:", duplicateRecords.length);

    let result = { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };

    if (operations.length > 0) {
        result = await Attendance.bulkWrite(operations);
        console.log(`[Sync] ${month} complete. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}, Upserted: ${result.upsertedCount}`);
    }

    return {
        success: true,
        month,
        stats: {
            totalFetched: rawRecords.length,
            operationsPrepared: operations.length,
            skippedCount: skippedRecords.length,
            duplicateCount: duplicateRecords.length,
            inserted: result.upsertedCount,
            updated: result.modifiedCount,
            matched: result.matchedCount
        },
        skippedRecords,
        duplicateRecords
    };
};

/**
 * POST /admin/fetch/:month — Sync a single month
 */
const fetchAndSync = async (req, res) => {
    const { month } = req.params;

    if (!validMonths.includes(month)) {
        return res.status(400).json({
            success: false,
            message: `Invalid month. Allowed: ${validMonths.join(', ')}`
        });
    }

    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentMonthIndex = new Date().getMonth();
    const requestedMonthIndex = monthOrder.indexOf(month);
    if (requestedMonthIndex > currentMonthIndex) {
        return res.status(400).json({
            success: false,
            message: `Bulan ${month} belum tiba. Anda hanya bisa sync bulan saat ini atau sebelumnya.`
        });
    }

    try {
        const result = await syncMonth(month);

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.json({
            success: true,
            message: `Sync ${month} complete`,
            stats: result.stats,
            skippedRecords: result.skippedRecords,
            duplicateRecords: result.duplicateRecords
        });
    } catch (error) {
        console.error("[Fetch Error]", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error during fetch."
        });
    }
};

/**
 * POST /admin/fetch/all — Sync ALL available months listed in validMonths.
 * Unlike single-month sync, this does NOT restrict to current month.
 * Airtable tables for future months already exist with "null" values.
 * This is essential to calculate total scheduled days for the batch (e.g. 60 days).
 */
const fetchAndSyncAll = async (req, res) => {
    // Sync ALL valid months — including future months whose tables already exist in Airtable
    const monthsToSync = [...validMonths];

    if (monthsToSync.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Tidak ada bulan yang bisa disinkronisasi saat ini."
        });
    }

    try {
        console.log(`[Sync All] Starting sync for months: ${monthsToSync.join(', ')}`);

        const results = [];
        let totalFetched = 0;
        let totalInserted = 0;
        let totalUpdated = 0;
        const failedMonths = [];

        for (const month of monthsToSync) {
            try {
                const result = await syncMonth(month);
                if (result.success) {
                    results.push(result);
                    totalFetched += result.stats.totalFetched;
                    totalInserted += result.stats.inserted;
                    totalUpdated += result.stats.updated;
                } else {
                    failedMonths.push({ month, message: result.message });
                }
            } catch (err) {
                console.error(`[Sync All] Error syncing ${month}:`, err.message);
                failedMonths.push({ month, message: err.message });
            }
        }

        // After syncing all months, calculate total scheduled days per mentee
        // by counting unique date keys across all months
        const pipeline = [
            {
                $project: {
                    whatsapp: 1,
                    month: 1,
                    dayCount: {
                        $size: { $objectToArray: "$attendance" }
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalScheduledDays: { $max: "$dayCount" }, // Per-month basis (for reference)
                    allDaysSum: { $sum: "$dayCount" }, // Sum of all days across all months and mentees
                    monthCount: { $addToSet: "$month" },
                    menteeCount: { $addToSet: "$whatsapp" }
                }
            }
        ];

        const aggResult = await Attendance.aggregate(pipeline);
        const totalInfo = aggResult[0] || {};

        // Get per-month day counts (take from first mentee since all mentees share the same day schedule)
        const perMonthDays = await Attendance.aggregate([
            {
                $group: {
                    _id: "$month",
                    daysInMonth: { $max: { $size: { $objectToArray: "$attendance" } } }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const totalDaysAcrossAllMonths = perMonthDays.reduce((sum, m) => sum + m.daysInMonth, 0);

        console.log(`[Sync All] Complete. Total months: ${monthsToSync.length}, Total fetched: ${totalFetched}`);
        console.log(`[Sync All] Total scheduled days across all months: ${totalDaysAcrossAllMonths}`);

        return res.json({
            success: true,
            message: `Sync selesai untuk ${results.length} bulan: ${monthsToSync.join(', ')}`,
            summary: {
                monthsSynced: monthsToSync,
                totalFetched,
                totalInserted,
                totalUpdated,
                totalScheduledDays: totalDaysAcrossAllMonths,
                perMonthDays: perMonthDays.map(m => ({ month: m._id, days: m.daysInMonth })),
                failedMonths
            },
            details: results.map(r => ({
                month: r.month,
                stats: r.stats
            }))
        });
    } catch (error) {
        console.error("[Sync All Error]", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error during full sync."
        });
    }
};

module.exports = {
    fetchAndSync,
    fetchAndSyncAll
};
