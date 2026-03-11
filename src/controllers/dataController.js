const Attendance = require('../models/menteeAttendanceModel');

const getAttendanceByProgram = async (req, res) => {
    try {
        const { program, month } = req.query; // e.g., ?program=AI/Web/etc&month=Feb
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const query = {};
        if (program && program !== "All" && program !== "") {
            // Use regex for flexible matching (e.g., "Web" matches "Web Development & UI/UX Design")
            query.programIL = { $regex: program, $options: 'i' };
        }
        if (month && month !== "All" && month !== "") {
            query.month = month;
        }

        const total = await Attendance.countDocuments(query);
        const data = await Attendance.find(query)
            .sort({ name: 1 })
            .skip(skip)
            .limit(limit);

        // Get unique programs and months for filter
        const programs = await Attendance.distinct("programIL");
        const months = await Attendance.distinct("month");

        const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        months.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

        return res.json({
            success: true,
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                programs,
                months
            }
        });
    } catch (error) {
        console.error("Get All Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve data."
        });
    }
};

/**
 * GET /admin/stats?program=Web (optional)
 * Returns overview statistics including today's real attendance.
 * 
 * Logic:
 * - Determines today's date (day number) and current month abbreviation
 * - For each mentee record in the current month, checks attendance[todayDay]
 *   - Contains "hadir" → counted as present (hadir)
 *   - Equals "izin" → counted as izin
 *   - Equals "alpha" → counted as alpha
 *   - Key doesn't exist → counted as "tidak hadir" (absent / not yet filled)
 * - If program query param is provided, filters by that program (regex)
 */
const getStats = async (req, res) => {
    try {
        const { program } = req.query;

        // Month abbreviation mapping: JS month index → DB month name
        const monthMap = {
            0: "Jan", 1: "Feb", 2: "Mar", 3: "Apr", 4: "May",
            5: "Jun", 6: "Jul", 7: "Aug", 8: "Sep", 9: "Oct",
            10: "Nov", 11: "Dec"
        };

        const now = new Date();
        const todayDay = String(now.getDate()); // e.g. "13"
        const currentMonth = monthMap[now.getMonth()]; // e.g. "Feb"

        // Build query — optionally filter by program
        const baseQuery = {};
        if (program && program !== "" && program !== "All") {
            baseQuery.programIL = { $regex: program, $options: 'i' };
        }

        // Total mentee count (across all months, matching program filter)
        const totalMentee = await Attendance.countDocuments(baseQuery);

        // Get unique programs
        const programs = await Attendance.distinct("programIL");

        // Count per program (always show all programs regardless of filter)
        const programCounts = {};
        for (const prog of programs) {
            programCounts[prog] = await Attendance.countDocuments({ programIL: prog });
        }

        // Get all mentee records for the CURRENT month (with optional program filter)
        const currentMonthQuery = { ...baseQuery, month: currentMonth };
        const mentees = await Attendance.find(currentMonthQuery).select('attendance programIL').lean();

        // Calculate today's attendance
        let hadir = 0;
        let izin = 0;
        let alpha = 0;
        let belumDiisi = 0;

        for (const mentee of mentees) {
            const att = mentee.attendance;
            let todayStatus = undefined;
            if (att) {
                if (att instanceof Map) {
                    todayStatus = att.has(todayDay) ? att.get(todayDay) : undefined;
                } else if (typeof att === 'object') {
                    todayStatus = todayDay in att ? att[todayDay] : undefined;
                }
            }

            // Key doesn't exist → today is not an attendance day for this mentee → skip
            if (todayStatus === undefined) continue;

            // String "null" → scheduled day, not yet filled
            if (!todayStatus || todayStatus.toLowerCase().trim() === 'null') {
                belumDiisi++;
            } else {
                const status = todayStatus.toLowerCase().trim();
                if (status.includes('hadir')) {
                    hadir++;
                } else if (status === 'izin') {
                    izin++;
                } else {
                    alpha++;
                }
            }
        }

        // Get last fetched record timestamp
        const lastRecord = await Attendance.findOne({}).sort({ lastFetchedAt: -1 }).select('lastFetchedAt');
        const lastSync = lastRecord ? lastRecord.lastFetchedAt : null;

        return res.json({
            success: true,
            stats: {
                totalMentee,
                programs,
                programCounts,
                lastSync,
                today: {
                    date: todayDay,
                    month: currentMonth,
                    totalMenteeBulanIni: mentees.length,
                    hadir,
                    izin,
                    alpha,
                    belumDiisi,
                }
            }
        });
    } catch (error) {
        console.error("Stats Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve stats."
        });
    }
};

/**
 * GET /admin/history?month=Feb (optional, defaults to current month)
 * Returns daily attendance breakdown for each day that has data in the attendance map.
 * 
 * Scans all mentee records for the given month, discovers which day keys exist
 * in their attendance maps, and for each day tallies hadir/izin/alpha/tidakHadir.
 */
const getDailyHistory = async (req, res) => {
    try {
        const monthMap = {
            0: "Jan", 1: "Feb", 2: "Mar", 3: "Apr", 4: "May",
            5: "Jun", 6: "Jul", 7: "Aug", 8: "Sep", 9: "Oct",
            10: "Nov", 11: "Dec"
        };

        const targetMonth = req.query.month || monthMap[new Date().getMonth()];
        const { program } = req.query;

        // Build query
        const query = { month: targetMonth };
        if (program && program !== "" && program !== "All") {
            query.programIL = { $regex: program, $options: 'i' };
        }

        const mentees = await Attendance.find(query).select('attendance name whatsapp').lean();
        const totalMentee = mentees.length;

        // Discover all unique day keys across all mentees (only days that exist in data)
        const allDays = new Set();
        for (const mentee of mentees) {
            const att = mentee.attendance;
            if (!att) continue;
            if (att instanceof Map) {
                for (const key of att.keys()) allDays.add(key);
            } else if (typeof att === 'object') {
                for (const key of Object.keys(att)) allDays.add(key);
            }
        }

        // Sort days numerically
        const sortedDays = Array.from(allDays)
            .filter(d => !isNaN(Number(d)))
            .sort((a, b) => Number(a) - Number(b));

        // For each day, count hadir/izin/alpha/belumDiisi
        const dailyStats = sortedDays.map(day => {
            let hadir = 0;
            let izin = 0;
            let alpha = 0;
            let belumDiisi = 0;

            for (const mentee of mentees) {
                const att = mentee.attendance;
                let hasKey = false;
                let status = null;
                if (att) {
                    if (att instanceof Map) {
                        hasKey = att.has(day);
                        status = hasKey ? att.get(day) : null;
                    } else if (typeof att === 'object') {
                        hasKey = day in att;
                        status = hasKey ? att[day] : null;
                    }
                }

                // Key doesn't exist for this mentee → skip (not an attendance day)
                if (!hasKey) continue;

                // String "null" → scheduled day, belum diisi
                if (!status || status.toLowerCase().trim() === 'null') {
                    belumDiisi++;
                } else {
                    const s = status.toLowerCase().trim();
                    if (s.includes('hadir')) {
                        hadir++;
                    } else if (s === 'izin') {
                        izin++;
                    } else {
                        alpha++;
                    }
                }
            }

            return {
                day: Number(day),
                dayLabel: `${day} ${targetMonth}`,
                hadir,
                izin,
                alpha,
                belumDiisi,
                totalMentee,
            };
        });

        return res.json({
            success: true,
            month: targetMonth,
            totalMentee,
            totalDays: sortedDays.length,
            history: dailyStats,
        });
    } catch (error) {
        console.error("History Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve history."
        });
    }
};

/**
 * GET /admin/mentors
 * Returns a list of unique mentor names from attendance data.
 */
const getMentorList = async (req, res) => {
    try {
        const mentors = await Attendance.distinct('mentor');
        // Filter out empty strings
        const filtered = mentors.filter(m => m && m.trim() !== '');
        return res.json({
            success: true,
            mentors: filtered.sort(),
        });
    } catch (error) {
        console.error('Mentor List Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve mentor list.',
        });
    }
};

/**
 * GET /admin/data/by-mentor?mentor=Arifian&page=1&limit=10
 * Returns paginated mentee attendance data filtered by mentor name.
 * Uses regex matching so partial names work (e.g. "Arifian" matches "Arifian Saputra").
 */
const getAttendanceByMentor = async (req, res) => {
    try {
        const { mentor, month } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const query = {};
        if (mentor && mentor !== 'All' && mentor !== '') {
            query.mentor = { $regex: mentor, $options: 'i' };
        }
        if (month && month !== 'All' && month !== '') {
            query.month = month;
        }

        const total = await Attendance.countDocuments(query);
        const data = await Attendance.find(query)
            .sort({ name: 1 })
            .skip(skip)
            .limit(limit);

        // Get unique mentors and months for reference
        const mentors = await Attendance.distinct('mentor');
        const filteredMentors = mentors.filter(m => m && m.trim() !== '');
        const months = await Attendance.distinct('month');

        const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        months.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

        return res.json({
            success: true,
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                mentors: filteredMentors.sort(),
                months,
            },
        });
    } catch (error) {
        console.error('Get By Mentor Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve data by mentor.',
        });
    }
};

/**
 * GET /admin/stats/by-mentor?mentor=Arifian
 * Returns stats filtered by mentor name (same structure as getStats but filtered by mentor).
 */
const getStatsByMentor = async (req, res) => {
    try {
        const { mentor } = req.query;

        const monthMap = {
            0: 'Jan', 1: 'Feb', 2: 'Mar', 3: 'Apr', 4: 'May',
            5: 'Jun', 6: 'Jul', 7: 'Aug', 8: 'Sep', 9: 'Oct',
            10: 'Nov', 11: 'Dec'
        };

        const now = new Date();
        const todayDay = String(now.getDate());
        const currentMonth = monthMap[now.getMonth()];

        const baseQuery = {};
        if (mentor && mentor !== '' && mentor !== 'All') {
            baseQuery.mentor = { $regex: mentor, $options: 'i' };
        }

        const totalMentee = await Attendance.countDocuments(baseQuery);

        // Get current month mentees for this mentor
        const currentMonthQuery = { ...baseQuery, month: currentMonth };
        const mentees = await Attendance.find(currentMonthQuery).select('attendance').lean();

        let hadir = 0;
        let izin = 0;
        let alpha = 0;
        let belumDiisi = 0;

        for (const m of mentees) {
            const att = m.attendance;
            let todayStatus = undefined;
            if (att) {
                if (att instanceof Map) {
                    todayStatus = att.has(todayDay) ? att.get(todayDay) : undefined;
                } else if (typeof att === 'object') {
                    todayStatus = todayDay in att ? att[todayDay] : undefined;
                }
            }

            if (todayStatus === undefined) continue;

            if (!todayStatus || todayStatus.toLowerCase().trim() === 'null') {
                belumDiisi++;
            } else {
                const status = todayStatus.toLowerCase().trim();
                if (status.includes('hadir')) {
                    hadir++;
                } else if (status === 'izin') {
                    izin++;
                } else {
                    alpha++;
                }
            }
        }

        return res.json({
            success: true,
            stats: {
                totalMentee,
                today: {
                    date: todayDay,
                    month: currentMonth,
                    totalMenteeBulanIni: mentees.length,
                    hadir,
                    izin,
                    alpha,
                    belumDiisi,
                },
            },
        });
    } catch (error) {
        console.error('Stats By Mentor Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve mentor stats.',
        });
    }
};


/**
 * GET /admin/mentee/:whatsapp
 * Returns all attendance records for a specific mentee across all months.
 * WhatsApp number is used as string identifier (no integer issues with leading zeros).
 */
const getMenteeDetail = async (req, res) => {
    try {
        const { whatsapp } = req.params;

        if (!whatsapp) {
            return res.status(400).json({
                success: false,
                message: 'WhatsApp number is required.',
            });
        }

        // Find all records for this mentee across all months
        let data = await Attendance.find({ whatsapp }).lean();

        const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        data.sort((a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month));

        if (!data || data.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No data found for this mentee.',
            });
        }

        // Aggregate stats across all months
        let totalHadir = 0;
        let totalIzin = 0;
        let totalAlpha = 0;
        let totalBelumDiisi = 0;
        const monthlyBreakdown = [];

        for (const record of data) {
            const s = record.summary || {};
            totalHadir += s.hadir || 0;
            totalIzin += s.izin || 0;
            totalAlpha += s.alpha || 0;
            totalBelumDiisi += s.belumDiisi || 0;

            monthlyBreakdown.push({
                month: record.month,
                hadir: s.hadir || 0,
                izin: s.izin || 0,
                alpha: s.alpha || 0,
                belumDiisi: s.belumDiisi || 0,
                persen: s.persen || 0,
            });
        }

        // Calculate total scheduled days for this mentee
        // = sum of all date entries across all their months
        let menteeTotalDays = 0;
        for (const record of data) {
            const att = record.attendance;
            if (att) {
                // .lean() converts Map to plain object
                menteeTotalDays += Object.keys(att).length;
            }
        }

        // Also get the global total scheduled days across ALL months in DB
        // (max day count per month across all mentees, summed)
        const perMonthDays = await Attendance.aggregate([
            {
                $group: {
                    _id: '$month',
                    daysInMonth: { $max: { $size: { $objectToArray: '$attendance' } } }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        const globalTotalDays = perMonthDays.reduce((sum, m) => sum + m.daysInMonth, 0);

        // Calculate total percentage from total days
        const totalPersen = menteeTotalDays > 0
            ? parseFloat(((totalHadir / menteeTotalDays) * 100).toFixed(2))
            : 0;

        // Use the latest record for profile info
        const latest = data[data.length - 1];

        return res.json({
            success: true,
            profile: {
                name: latest.name,
                institusi: latest.institusi,
                whatsapp: latest.whatsapp,
                programIL: latest.programIL,
                jenjang: latest.jenjang,
                mentor: latest.mentor,
                batch: latest.batch,
                sp1: latest.sp1 || false,
                sp2: latest.sp2 || false,
                sp3: latest.sp3 || false,
                status: latest.status || 'Active',
            },
            records: data,
            aggregated: {
                totalHadir,
                totalIzin,
                totalAlpha,
                totalBelumDiisi,
                totalMonths: data.length,
                menteeTotalDays,
                globalTotalDays,
                totalPersen,
                perMonthDays: perMonthDays.map(m => ({ month: m._id, days: m.daysInMonth })),
                monthlyBreakdown,
            },
        });
    } catch (error) {
        console.error('Mentee Detail Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve mentee detail.',
        });
    }
};

/**
 * GET /admin/batch-performance
 * Returns global batch-level stats: total scheduled days, per-month days,
 * how many mentees, and how many days have actually started (non-null attendance).
 */
const getBatchPerformance = async (req, res) => {
    try {
        // Per-month day counts (max across all mentees)
        const perMonthDays = await Attendance.aggregate([
            {
                $group: {
                    _id: '$month',
                    daysInMonth: { $max: { $size: { $objectToArray: '$attendance' } } }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const globalTotalDays = perMonthDays.reduce((sum, m) => sum + m.daysInMonth, 0);

        // Count how many days have actually started (non-null) across all months
        // We sample from one mentee to count started days per month
        const startedDaysPerMonth = [];
        const monthOrder = ['Feb', 'Mar', 'Apr', 'May', 'Jun'];

        for (const monthInfo of perMonthDays) {
            const m = monthInfo._id;
            // Find one record for this month
            const sample = await Attendance.findOne({ month: m }).lean();
            let startedDays = 0;
            if (sample && sample.attendance) {
                const entries = Object.entries(sample.attendance);
                startedDays = entries.filter(([, val]) => val && val.toString().toLowerCase() !== 'null').length;
            }
            startedDaysPerMonth.push({
                month: m,
                totalDays: monthInfo.daysInMonth,
                startedDays,
            });
        }

        const totalStartedDays = startedDaysPerMonth.reduce((sum, m) => sum + m.startedDays, 0);

        // Count unique mentees
        const menteeCount = await Attendance.distinct('whatsapp');

        // Count total months synced
        const monthsSynced = await Attendance.distinct('month');

        return res.json({
            success: true,
            batch: {
                globalTotalDays,
                totalStartedDays,
                totalMentees: menteeCount.length,
                monthsSynced: monthsSynced.sort(),
                perMonthDays: perMonthDays.map(m => ({ month: m._id, days: m.daysInMonth })),
                startedDaysPerMonth,
            },
        });
    } catch (error) {
        console.error('Batch Performance Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve batch performance.',
        });
    }
};

module.exports = {
    getAttendanceByProgram,
    getStats,
    getDailyHistory,
    getMentorList,
    getAttendanceByMentor,
    getStatsByMentor,
    getMenteeDetail,
    getBatchPerformance,
};
