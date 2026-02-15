const { fetchTableData } = require('../services/airtableService');
const { parseAttendance } = require('../services/attendanceService');
const Attendance = require('../models/menteeAttendanceModel');
const { validMonths } = require('../utils/monthConfig');

const fetchAndSync = async (req, res) => {
    const { month } = req.params;

    // 1. Validate Month — must be in the allowed list
    if (!validMonths.includes(month)) {
        return res.status(400).json({
            success: false,
            message: `Invalid month. Allowed: ${validMonths.join(', ')}`
        });
    }

    // 2. Validate Month — cannot sync a future month
    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentMonthIndex = new Date().getMonth(); // 0-based (0=Jan, 1=Feb, ...)
    const requestedMonthIndex = monthOrder.indexOf(month);
    if (requestedMonthIndex > currentMonthIndex) {
        return res.status(400).json({
            success: false,
            message: `Bulan ${month} belum tiba. Anda hanya bisa sync bulan saat ini atau sebelumnya.`
        });
    }

    try {
        console.log(`[Fetch] Starting sync for ${month}...`);

        // 2. Fetch from Airtable
        const rawRecords = await fetchTableData(month);
        console.log(`[Fetch] Retrieved ${rawRecords.length} records from Airtable.`);

        if (rawRecords.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Table ${month} is empty or not found.`
            });
        }

        // 3. Transform Data with Validation and Deduplication
        const operations = [];
        const skippedRecords = [];
        const duplicateRecords = [];
        const seenWA = new Set();

        rawRecords.forEach(record => {
            const doc = parseAttendance(record, month);
            const whatsapp = doc.whatsapp;
            const name = doc.name;

            // Step 2: Validation
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

            // Step 3: Duplicate Check
            if (seenWA.has(whatsapp)) {
                console.log("[DUPLICATE WA DETECTED] Skip duplicate in batch:", whatsapp, name);
                duplicateRecords.push({ whatsapp, name });
                // We skip adding this to operations because it would overwrite the previous one in this batch anyway 
                // (or cause conflict if we weren't upserting by unique key, but here we want to report it)
                // However, user prompt implies we just DETECT it. 
                // If we proceed, the last one wins in a bulkWrite with same filter. 
                // But usually better to skip or just log.
                // "Deteksi duplicate WA dalam fetch". 
                // Let's Skip it to be safe and report it? 
                // User said "Duplicates.push" and log it.
                // I will NOT skip it in the operations unless I want to ignore secondary entries.
                // Usually the first entry is the main one, or maybe the last.
                // Let's skip adding to operations so we don't waste DB calls, assuming first one valid.
                return;
            }
            seenWA.add(whatsapp);

            // Upsert Operation
            operations.push({
                updateOne: {
                    filter: { whatsapp: doc.whatsapp, month: month },
                    update: { $set: doc },
                    upsert: true
                }
            });
        });

        // Step 4: Log Summary
        console.log("TOTAL FETCHED:", rawRecords.length);
        console.log("TOTAL OPERATIONS:", operations.length);
        console.log("SKIPPED:", skippedRecords.length);
        console.log("DUPLICATES:", duplicateRecords.length);

        // 4. Bulk Write to MongoDB
        let result = { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };

        if (operations.length > 0) {
            result = await Attendance.bulkWrite(operations);
            console.log(`[Sync] ${month} complete. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}, Upserted: ${result.upsertedCount}`);
        } else {
            console.log("[Sync] No valid operations to perform.");
        }

        return res.json({
            success: true,
            message: `Sync ${month} complete`,
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
        });

    } catch (error) {
        console.error("[Fetch Error]", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error during fetch."
        });
    }
};

module.exports = {
    fetchAndSync
};
