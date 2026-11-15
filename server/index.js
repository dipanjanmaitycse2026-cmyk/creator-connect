
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Frontend URLs allowed to access the backend
const allowedOrigins = (
  process.env.FRONTEND_URL || 'http://localhost:5173'
)
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS'));
  }
}));

app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Creator Connect backend is running'
  });
});

// Auto Scientist AI integration
app.post('/api/ai/test', async (req, res) => {
  try {
    const { input } = req.body;

    if (!input || typeof input !== 'string' || !input.trim()) {
      return res.status(400).json({
        success: false,
        error: 'A valid input string is required.'
      });
    }

    const apiKey = process.env.ADAPTION_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'Auto Scientist API key is not configured.'
      });
    }

    const response = await fetch(
      'https://api.prod.adaptionlabs.ai/api/v1/responses',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'stack:deepseek-v4-flash-1',
          input: input.trim()
        }),
        signal: AbortSignal.timeout(60000)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        'Auto Scientist API error:',
        response.status
      );

      return res.status(502).json({
        success: false,
        error: 'The AI provider could not process the request.'
      });
    }

    const aiText = data.output
      ?.flatMap(item => item.content || [])
      .filter(item => item.type === 'output_text')
      .map(item => item.text)
      .join('\n');

    return res.json({
      success: true,
      response: aiText || 'No text response received.',
      responseId: data.id
    });

  } catch (error) {
    console.error('Auto Scientist error:', error.message);

    return res.status(500).json({
      success: false,
      error: 'Unable to connect to Auto Scientist.'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Creator Connect API running on port ${PORT}`);
});
