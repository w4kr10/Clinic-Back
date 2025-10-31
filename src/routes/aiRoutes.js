const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  generateAIMealPlan,
  getAIHealthAdvice,
  aiChat,
  aiRiskAssessment,
  getAIChatHistory
} = require('../controllers/aiController');

const router = express.Router();

// AI routes
router.post('/meal-plan', authMiddleware, generateAIMealPlan);
router.post('/health-advice', authMiddleware, getAIHealthAdvice);
router.post('/chat', authMiddleware, aiChat);
router.post('/risk-assessment', authMiddleware, aiRiskAssessment);
router.get('/chat-history', authMiddleware, getAIChatHistory);

module.exports = router;
