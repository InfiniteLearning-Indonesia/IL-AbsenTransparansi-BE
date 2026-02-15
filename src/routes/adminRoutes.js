const express = require('express');
const router = express.Router();
const { fetchAndSync } = require('../controllers/fetchController');
const { getAttendanceByProgram, getStats, getDailyHistory } = require('../controllers/dataController');

router.post('/fetch/:month', fetchAndSync);
router.get('/data', getAttendanceByProgram);
router.get('/stats', getStats);
router.get('/history', getDailyHistory);

module.exports = router;
