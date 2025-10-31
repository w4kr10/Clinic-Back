const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const {
  getDashboard,
  getPregnancyRecord,
  updatePregnancyRecord,
  getAppointments,
  bookAppointment,
  updateAppointment,
  getGroceryItems,
  createOrder,
  getOrders,
  getMedicalPersonnel,
  getNearbyStores
} = require('../controllers/motherController');

const router = express.Router();

// Mother routes
router.get('/dashboard', authMiddleware, roleMiddleware('mother'), getDashboard);
router.get('/pregnancy-record', authMiddleware, roleMiddleware('mother'), getPregnancyRecord);
router.post('/pregnancy-record', authMiddleware, roleMiddleware('mother'), updatePregnancyRecord);
router.get('/appointments', authMiddleware, roleMiddleware('mother'), getAppointments);
router.post('/appointments', authMiddleware, roleMiddleware('mother'), bookAppointment);
router.get('/grocery-items', authMiddleware, roleMiddleware('mother'), getGroceryItems);
router.post('/orders', authMiddleware, roleMiddleware('mother'), createOrder);
router.get('/orders', authMiddleware, roleMiddleware('mother'), getOrders);
router.get('/medical-personnel', authMiddleware, roleMiddleware('mother'), getMedicalPersonnel);
router.get('/stores/nearby', authMiddleware, roleMiddleware('mother'), getNearbyStores);
router.put('/appointments/:id', authMiddleware, roleMiddleware('mother'), updateAppointment);

module.exports = router;
