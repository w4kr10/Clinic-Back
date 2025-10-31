const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  getMessages,
  sendMessage,
  getChatRooms,
  createChatRoom,
  markAsRead,
  getUnreadCount
} = require('../controllers/chatController');

const router = express.Router();

// Chat routes
router.get('/messages/:roomId', authMiddleware, getMessages);
router.post('/messages', authMiddleware, sendMessage);
router.get('/rooms', authMiddleware, getChatRooms);
router.post('/rooms', authMiddleware, createChatRoom);
router.put('/messages/:roomId/read', authMiddleware, markAsRead);
router.get('/unread-count', authMiddleware, getUnreadCount);

module.exports = router;
