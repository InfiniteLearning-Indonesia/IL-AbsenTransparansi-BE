const MenteeAttendance = require('../models/menteeAttendanceModel');
const { fetchTableRecords } = require('../services/airtableService');
const { transformBatch } = require('../services/transformService');
const { isValidMonth } = require('../utils/monthUtils');
const programConfig = require('../config/programConfig');

const fetchAndSyncMonth = async (req, res) => {
    const { month } = req.params;

    try {
        // 1. Validation
        if (!isValidMonth(month)) {
            return res.status(400).json({
                success: false,
                message: `Month '${month}' is not within the valid batch range (${programConfig.startMonth} - ${programConfig.endMonth}).`
            });
        }

        // Optional: Strict check against config activeFetchMonth
        // if (month !== programConfig.activeFetchMonth) {
        //   return res.status(400).json({ message: "Requested month is not the active fetch month." });
        // }

        // 2. Fetch from Airtable
        console.log(`Starting sync for month: ${month}`);
        const rawRecords = await fetchTableRecords(month);

        if (!rawRecords || rawRecords.length === 0) {
            return res.status(404).json({ success: false, message: `No records found for table '${month}'.` });
        }

        // 3. Transform Data
        const transformedData = transformBatch(rawRecords, month);

        // 4. Save to MongoDB
        // Strategy: Delete existing records for this month to insure full sync (handle removals/updates)
        await MenteeAttendance.deleteMany({ month });

        // Insert new
        const result = await MenteeAttendance.insertMany(transformedData);

        return res.status(200).json({
            success: true,
            message: `Successfully synced ${result.length} records for ${month}.`,
            data: {
                totalSynced: result.length,
                month
            }
        });

    } catch (error) {
        console.error("Sync Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};

module.exports = {
    fetchAndSyncMonth
};
