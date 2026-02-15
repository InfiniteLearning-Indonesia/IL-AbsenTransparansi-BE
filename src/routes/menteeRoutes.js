const express = require('express');
const router = express.Router();
const { checkAttendance, getAttendanceByMonth } = require('../controllers/menteeController');

// Route: POST /mentee/check
router.post('/check', checkAttendance);

// Route: GET /mentee/:phone/:month
router.get('/:phone/:month', getAttendanceByMonth);

module.exports = router;
