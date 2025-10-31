const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const {
  getDashboard,
  getInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getOrders,
  updateOrderStatus,
  getAnalytics
} = require('../controllers/groceryController');

const router = express.Router();

// Grocery store routes
router.get('/dashboard', authMiddleware, roleMiddleware('grocery'), getDashboard);
router.get('/inventory', authMiddleware, roleMiddleware('grocery'), getInventory);
router.post('/inventory', authMiddleware, roleMiddleware('grocery'), addInventoryItem);
router.put('/inventory/:id', authMiddleware, roleMiddleware('grocery'), updateInventoryItem);
router.delete('/inventory/:id', authMiddleware, roleMiddleware('grocery'), deleteInventoryItem);
router.get('/orders', authMiddleware, roleMiddleware('grocery'), getOrders);
router.put('/orders/:id/status', authMiddleware, roleMiddleware('grocery'), updateOrderStatus);
router.get('/analytics', authMiddleware, roleMiddleware('grocery'), getAnalytics);

module.exports = router;
