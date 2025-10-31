const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const {
  getDashboard,
  getUsers,
  getUserDetails,
  verifyUser,
  deleteUser,
  getAnalytics,
  getReports,
  getAILogs,
  getStores,
  getStoreDetails
} = require('../controllers/adminController');

const router = express.Router();

// Admin routes
router.get('/dashboard', authMiddleware, roleMiddleware('admin'), getDashboard);
router.get('/users', authMiddleware, roleMiddleware('admin'), getUsers);
router.get('/users/:id', authMiddleware, roleMiddleware('admin'), getUserDetails);
router.put('/users/:id/verify', authMiddleware, roleMiddleware('admin'), verifyUser);
router.delete('/users/:id', authMiddleware, roleMiddleware('admin'), deleteUser);
router.get('/analytics', authMiddleware, roleMiddleware('admin'), getAnalytics);
router.get('/reports', authMiddleware, roleMiddleware('admin'), getReports);
router.get('/ai-logs', authMiddleware, roleMiddleware('admin'), getAILogs);
router.get('/stores', authMiddleware, roleMiddleware('admin'), getStores);
router.get('/stores/:id', authMiddleware, roleMiddleware('admin'), getStoreDetails);

module.exports = router;
