const express = require('express');
const router = express.Router();
const { fetchAndSync, fetchAndSyncAll } = require('../controllers/fetchController');
const { getAttendanceByProgram, getStats, getDailyHistory, getMentorList, getAttendanceByMentor, getStatsByMentor, getMenteeDetail, getBatchPerformance } = require('../controllers/dataController');

router.post('/fetch/all', fetchAndSyncAll);
router.post('/fetch/:month', fetchAndSync);
router.get('/data', getAttendanceByProgram);
router.get('/data/by-mentor', getAttendanceByMentor);
router.get('/stats', getStats);
router.get('/stats/by-mentor', getStatsByMentor);
router.get('/mentors', getMentorList);
router.get('/history', getDailyHistory);
router.get('/mentee/:whatsapp', getMenteeDetail);
router.get('/batch-performance', getBatchPerformance);

module.exports = router;
