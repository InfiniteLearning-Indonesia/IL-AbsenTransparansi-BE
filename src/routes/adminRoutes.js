const express = require('express');
const router = express.Router();
const { fetchAndSync } = require('../controllers/fetchController');
const { getAttendanceByProgram, getStats, getDailyHistory, getMentorList, getAttendanceByMentor, getStatsByMentor } = require('../controllers/dataController');

router.post('/fetch/:month', fetchAndSync);
router.get('/data', getAttendanceByProgram);
router.get('/data/by-mentor', getAttendanceByMentor);
router.get('/stats', getStats);
router.get('/stats/by-mentor', getStatsByMentor);
router.get('/mentors', getMentorList);
router.get('/history', getDailyHistory);

module.exports = router;
