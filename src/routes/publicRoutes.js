const express = require('express');
const router = express.Router();
const { checkAttendance } = require('../controllers/menteeController');

router.post('/check', checkAttendance);

module.exports = router;
