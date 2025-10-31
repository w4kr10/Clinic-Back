const { HfInference } = require('@huggingface/inference');

// Initialize Hugging Face client
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Helper function to call Hugging Face model with retries and fallbacks
const callAIModel = async (prompt, maxLength = 512, modelCandidates = null) => {
  if (!process.env.HUGGINGFACE_API_KEY) {
    throw new Error('Hugging Face API key not configured');
  }

  // Models to try in order (some models may not be hosted for inference)
  const defaultModels = [
    'meta-llama/Llama-3.1-8B-Instruct',
    'google/flan-t5-large',
    'google/flan-t5-base',
    'google/flan-t5-small'
  ];

  const models = Array.isArray(modelCandidates) && modelCandidates.length ? modelCandidates : defaultModels;

  let lastErr = null;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const response = await hf.textGeneration({
        model,
        inputs: prompt,
        parameters: {
          max_length: maxLength,
          temperature: 0.7,
          top_p: 0.95,
          do_sample: true
        }
      });

      if (!response) throw new Error('Empty response from HF model');

      // Normalize response shape
      if (Array.isArray(response)) return response.map(r => r.generated_text || r.text || '').join('\n').trim();
      if (response.generated_text) return response.generated_text;
      if (response.generated_texts && Array.isArray(response.generated_texts)) return response.generated_texts.join('\n').trim();
      if (response.text) return response.text;

      return String(response);
    } catch (err) {
      lastErr = err;
      console.error(`HF textGeneration failed for model=${model}:`, {
        message: err.message,
        stack: err.stack,
        responseData: err.response?.data || err.response || null
      });

      // if not last, wait with backoff then continue
      if (i < models.length - 1) await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }

  // All models failed
  const errMsg = lastErr ? (lastErr.message || String(lastErr)) : 'Unknown HF error';
  console.error('All HF model attempts failed:', errMsg);
  throw new Error(`Failed to get AI response: ${errMsg}`);
};

// Generate meal plan
const generateMealPlan = async ({ trimester, dietaryRestrictions, preferences, healthMetrics }) => {
  try {
    const prompt = `Task: Create a detailed 7-day pregnancy meal plan and return the result as JSON.

Return a JSON object with the following shape:
{
  "summary": "short summary",
  "weeklyPlan": [
    { "meals": [ { "type": "breakfast|lunch|dinner|snack", "description": "...", "nutritionalInfo": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 } }, ... ] },
    ... (7 items)
  ],
  "nutritionalGuidelines": "string",
  "tips": ["tip1","tip2"]
}

Trimester: ${trimester}
Dietary restrictions: ${Array.isArray(dietaryRestrictions) ? dietaryRestrictions.join(', ') : dietaryRestrictions || 'None'}
Preferences: ${Array.isArray(preferences) ? preferences.join(', ') : preferences || 'None'}
Health metrics: ${JSON.stringify(healthMetrics)}

Instructions: Be concise but specific. If you cannot produce full structured fields, still return a JSON object with those keys and fill text fields with the generated content.`;

    const rawResponse = await callAIModel(prompt, 2048);

    // Try to parse JSON from model output. Models sometimes include backticks or extra text.
    let parsed = null;
    try {
      // Attempt to extract JSON substring
      const firstBrace = rawResponse.indexOf('{');
      const lastBrace = rawResponse.lastIndexOf('}');
      const jsonCandidate = firstBrace !== -1 && lastBrace !== -1 ? rawResponse.slice(firstBrace, lastBrace + 1) : rawResponse;
      parsed = JSON.parse(jsonCandidate);
    } catch (e) {
      // Fallback: wrap the whole text into summary
      parsed = {
        summary: rawResponse,
        weeklyPlan: null,
        nutritionalGuidelines: null,
        tips: null
      };
    }

    return {
      ...parsed,
      trimester,
      generatedAt: new Date()
    };
  } catch (error) {
    console.error('Generate meal plan error:', error);
    throw error;
  }
};

// Get health advice
const getHealthAdvice = async ({ question, symptoms, trimester, healthMetrics, currentWeek }) => {
  try {
    const symptomsText = symptoms.map(s => `${s.name} (${s.severity})`).join(', ');
    
    const prompt = `Task: Provide pregnancy health advice.

Context:
- Pregnancy Week: ${currentWeek}
- Trimester: ${trimester}
- Current Symptoms: ${symptomsText || 'None reported'}
- Health Metrics: ${JSON.stringify(healthMetrics)}

Question: ${question}

Instructions: Provide evidence-based pregnancy health advice. Include when to consult healthcare providers for serious concerns.`;

    const response = await callAIModel(prompt, 768);

    // Additional sentiment analysis on symptoms if present
    let symptomsAnalysis = null;
    if (symptoms && symptoms.length > 0) {
      const symptomsPrompt = `Analyze these pregnancy symptoms: ${symptomsText}
Instructions: Identify any concerning patterns or urgent medical attention needed.`;
      
      symptomsAnalysis = await callAIModel(symptomsPrompt, 256);
    }

    return {
      advice: response,
      symptomsAnalysis,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Get health advice error:', error);
    throw error;
  }
};

// Chat with AI assistant
const chatWithAI = async ({ userMessage, userContext }) => {
  try {
    const systemPrompt = `You are MCaid Assistant, a friendly and knowledgeable AI companion for pregnant mothers. You provide emotional support, answer questions about pregnancy, offer health tips, and help with meal planning. You're empathetic, informative, and always encourage users to consult healthcare providers for medical concerns.`;
    
    const contextPrompt = `User context:
- Trimester: ${userContext.trimester}
- Pregnancy week: ${userContext.currentWeek}
- Recent symptoms: ${userContext.symptoms?.slice(-3).map(s => s.name).join(', ') || 'None'}
`;

    const prompt = `${systemPrompt}\n\n${contextPrompt}\nUser: ${userMessage}\n\nRespond as the assistant:`;

    const response = await callAIModel(prompt, 512);

    return {
      response,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('AI chat error:', error);
    throw error;
  }
};

// Assess health risk
const assessHealthRisk = async ({ symptoms, healthMetrics, trimester, currentWeek, medications }) => {
  try {
    const systemPrompt = `You are a medical AI system that assesses health risks for pregnant mothers. Analyze symptoms and health metrics to identify potential risks. Provide risk levels (low, moderate, high) and recommendations.`;
    
    const symptomsText = symptoms.map(s => `${s.name} (severity: ${s.severity}, date: ${s.date})`).join('\n');
    const medicationsText = medications?.map(m => `${m.name} - ${m.dosage}`).join('\n') || 'None';
    
    const userPrompt = `Assess health risks for a mother at week ${currentWeek} (${trimester} trimester):

Symptoms:
${symptomsText || 'None reported'}

Health Metrics:
- Blood Pressure: ${healthMetrics.bloodPressure?.systolic || 'N/A'}/${healthMetrics.bloodPressure?.diastolic || 'N/A'}
- Blood Sugar: ${healthMetrics.bloodSugar || 'N/A'}
- Heart Rate: ${healthMetrics.heartRate || 'N/A'}
- Weight: ${healthMetrics.weight || 'N/A'}

Current Medications:
${medicationsText}

Provide:
1. Overall risk level (low/moderate/high)
2. Specific concerns identified
3. Recommendations
4. When to seek immediate medical attention`;

    const prompt = `${systemPrompt}\n\n${userPrompt}`;
    const response = await callAIModel(prompt, 512);

    return {
      assessment: response,
      assessedAt: new Date(),
      weekAssessed: currentWeek
    };
  } catch (error) {
    console.error('Risk assessment error:', error);
    throw error;
  }
};

module.exports = {
  generateMealPlan,
  getHealthAdvice,
  chatWithAI,
  assessHealthRisk
};
