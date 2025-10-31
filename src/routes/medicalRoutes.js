const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const {
  getDashboard,
  getPatients,
  getPatientDetails,
  getAppointments,
  createAppointment,
  updateAppointment,
  addPatientNotes,
  addMedication,
  getAnalytics
} = require('../controllers/medicalController');

const router = express.Router();

// Medical personnel routes
router.get('/dashboard', authMiddleware, roleMiddleware('medical'), getDashboard);
router.get('/patients', authMiddleware, roleMiddleware('medical'), getPatients);
router.get('/patients/:id', authMiddleware, roleMiddleware('medical'), getPatientDetails);
router.get('/appointments', authMiddleware, roleMiddleware('medical'), getAppointments);
router.post('/appointments', authMiddleware, roleMiddleware('medical'), createAppointment);
router.put('/appointments/:id', authMiddleware, roleMiddleware('medical'), updateAppointment);
router.post('/patients/:id/notes', authMiddleware, roleMiddleware('medical'), addPatientNotes);
router.post('/patients/:id/medications', authMiddleware, roleMiddleware('medical'), addMedication);
router.get('/analytics', authMiddleware, roleMiddleware('medical'), getAnalytics);

module.exports = router;
