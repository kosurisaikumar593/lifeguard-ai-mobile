const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/stats', adminController.getStats);
router.get('/users', adminController.getUsers);
router.get('/incidents', adminController.getIncidents);

module.exports = router;
