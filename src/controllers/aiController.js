const { generateMealPlan, getHealthAdvice, chatWithAI, assessHealthRisk } = require('../utils/aiAssistant');
const PregnancyRecord = require('../models/PregnancyRecord');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');

// Generate AI meal plan
const generateAIMealPlan = async (req, res) => {
  try {
    const { trimester, dietaryRestrictions, preferences } = req.body;

    const pregnancyRecord = await PregnancyRecord.findOne({ motherId: req.user.id });
    
    const userTrimester = trimester || pregnancyRecord?.trimester || 'first';

    const mealPlan = await generateMealPlan({
      trimester: userTrimester,
      dietaryRestrictions: dietaryRestrictions || [],
      preferences: preferences || [],
      healthMetrics: pregnancyRecord?.healthMetrics || {}
    });

    res.json({ success: true, data: mealPlan });
  } catch (error) {
    console.error('Generate meal plan error:', error);
    // Graceful fallback to avoid breaking the frontend if AI is unavailable
    const userTrimester = req.body.trimester || 'first';
    const fallbackWeeklyPlan = Array.from({ length: 7 }).map(() => ({
      meals: [
        { type: 'breakfast', description: 'Oatmeal with banana and a glass of milk', nutritionalInfo: { calories: 350, protein: 10, carbs: 60, fat: 6 } },
        { type: 'snack', description: 'Plain yogurt with honey', nutritionalInfo: { calories: 120, protein: 6, carbs: 18, fat: 2 } },
        { type: 'lunch', description: 'Grilled chicken salad with mixed greens and quinoa', nutritionalInfo: { calories: 450, protein: 30, carbs: 40, fat: 12 } },
        { type: 'snack', description: 'Apple with peanut butter', nutritionalInfo: { calories: 200, protein: 6, carbs: 22, fat: 10 } },
        { type: 'dinner', description: 'Baked salmon, steamed vegetables and brown rice', nutritionalInfo: { calories: 500, protein: 35, carbs: 50, fat: 14 } }
      ]
    }));

    const fallback = {
      summary: 'Fallback meal plan: balanced, pregnancy-friendly meals. This plan is a safe default returned because the AI service was unavailable.',
      weeklyPlan: fallbackWeeklyPlan,
      nutritionalGuidelines: 'Include iron-rich foods (leafy greens, lean meats), protein, calcium-rich dairy, and stay hydrated. Consult your provider for personal restrictions.',
      tips: [
        'Eat small frequent meals to manage nausea',
        'Include a source of iron and vitamin C to aid absorption',
        'Drink plenty of water throughout the day'
      ],
      trimester: userTrimester,
      generatedAt: new Date(),
      _fallback: true
    };

    res.json({ success: true, data: fallback });
  }
};

// Get AI health advice
const getAIHealthAdvice = async (req, res) => {
  try {
    const { question, symptoms } = req.body;

    const pregnancyRecord = await PregnancyRecord.findOne({ motherId: req.user.id });

    const advice = await getHealthAdvice({
      question,
      symptoms: symptoms || pregnancyRecord?.symptoms || [],
      trimester: pregnancyRecord?.trimester || 'first',
      healthMetrics: pregnancyRecord?.healthMetrics || {},
      currentWeek: pregnancyRecord?.currentWeek || 1
    });

    res.json({ success: true, data: advice });
  } catch (error) {
    console.error('Get health advice error:', error);
    res.status(500).json({ message: 'Failed to get health advice', error: error.message });
  }
};

// AI chat
const aiChat = async (req, res) => {
  try {
    const { message, chatRoom } = req.body;

    const pregnancyRecord = await PregnancyRecord.findOne({ motherId: req.user.id });

    const aiResponse = await chatWithAI({
      userMessage: message,
      userContext: {
        trimester: pregnancyRecord?.trimester || 'first',
        currentWeek: pregnancyRecord?.currentWeek || 1,
        healthMetrics: pregnancyRecord?.healthMetrics || {},
        symptoms: pregnancyRecord?.symptoms || []
      }
    });

    // Save user message
    const userMessage = new ChatMessage({
      senderId: req.user.id,
      receiverId: req.user.id, // AI messages use same user for both
      message,
      chatRoom,
      isAI: false
    });
    await userMessage.save();

    // Save AI response
    const aiMessage = new ChatMessage({
      senderId: req.user.id,
      receiverId: req.user.id,
      message: aiResponse.response,
      chatRoom,
      isAI: true
    });
    await aiMessage.save();

    res.json({ 
      success: true, 
      data: { 
        userMessage, 
        aiMessage,
        response: aiResponse.response 
      } 
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ message: 'Failed to process AI chat', error: error.message });
  }
};

// AI health risk assessment
const aiRiskAssessment = async (req, res) => {
  try {
    const { customSymptoms, customMetrics } = req.body;

    const pregnancyRecord = await PregnancyRecord.findOne({ motherId: req.user.id });

    if (!pregnancyRecord) {
      return res.status(404).json({ message: 'Pregnancy record not found' });
    }

    const assessment = await assessHealthRisk({
      symptoms: customSymptoms || pregnancyRecord.symptoms,
      healthMetrics: customMetrics || pregnancyRecord.healthMetrics,
      trimester: pregnancyRecord.trimester,
      currentWeek: pregnancyRecord.currentWeek,
      medications: pregnancyRecord.medications
    });

    res.json({ success: true, data: assessment });
  } catch (error) {
    console.error('Risk assessment error:', error);
    res.status(500).json({ message: 'Failed to assess health risk', error: error.message });
  }
};

// Get AI chat history
const getAIChatHistory = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const chatRoom = `ai-${req.user.id}`;

    const messages = await ChatMessage.find({ 
      chatRoom,
      $or: [{ senderId: req.user.id }, { receiverId: req.user.id }]
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, data: messages.reverse() });
  } catch (error) {
    console.error('Get AI chat history error:', error);
    res.status(500).json({ message: 'Failed to get chat history' });
  }
};

module.exports = {
  generateAIMealPlan,
  getAIHealthAdvice,
  aiChat,
  aiRiskAssessment,
  getAIChatHistory
};
