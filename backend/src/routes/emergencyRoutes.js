const express = require('express');
const router = express.Router();
const emergencyController = require('../controllers/emergencyController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.post('/create', emergencyController.createEmergency);
router.post('/location', emergencyController.updateEmergencyLocation);
router.post('/acknowledge', emergencyController.acknowledgeEmergency);
router.get('/history', emergencyController.getEmergencyHistory);
router.get('/:id', emergencyController.getEmergencyById);

module.exports = router;
