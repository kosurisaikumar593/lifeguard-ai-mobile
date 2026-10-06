const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.get('/', contactController.getContacts);
router.post('/request', contactController.requestContact);
router.post('/accept', contactController.acceptContact);
router.delete('/:id', contactController.removeContact);

module.exports = router;
