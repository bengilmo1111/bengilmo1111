const express = require('express');
const cors = require('cors');
require('dotenv').config();
const fetch = require('node-fetch');
const { Buffer } = require('buffer'); // Import Buffer for binary-to-base64 conversion

const app = express();
app.use(express.json());

// Allowed origins
const allowedOrigins = ['https://bengilmo1111-github-io.vercel.app'];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin); // Debugging line
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
};

// Apply CORS middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight requests for all routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Main game endpoint for Cohere API
app.post('/api', async (req, res) => {
  try {
    const { input, history } = req.body;

    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    if (!Array.isArray(history)) {
      return res.status(400).json({ error: 'History must be an array' });
    }

    const messages = [
      {
        role: 'system',
        content: "You are a classic text-based adventure game assistant. Outline scenarios and responses with humour and wit. The point of the game is for the user to work their way through rooms or scenarios in a castle, haunted house, magic kingdom, prison, lair or similar. Each room or scenario should have a unique description, occupants, set of items and puzzles and riddles. Not every room or scenario needs all these attributes. There should be funny side quests. The play can win the game by gathering companions to form a company, and then defeating a big, bad, final enemy or monster. Each room or scenario should have no more than one riddle or puzzle to be solved at once. When answering or constructing a new scenario, remember to take into account the previous story and messages. Try to keep your messages short."
      },
      ...history.map((entry) => ({
        role: entry.role === 'user' ? 'user' : 'assistant',
        content: entry.content
      })),
      { role: 'user', content: input }
    ];

    const payload = {
          model: 'command-r-plus-08-2024',
          messages: messages,
          max_tokens: 800, // Increase max tokens to allow longer responses
          temperature: 0.7, // Slightly lower temperature for more comprehensive answers
          frequency_penalty: 0.5 // Reduce penalty to allow repetition if needed
        };

    const cohereResponse = await fetch('https://api.cohere.com/v2/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseData = await cohereResponse.json();

    if (!cohereResponse.ok) {
      console.error('Cohere API error:', responseData);
      return res.status(cohereResponse.status).json({
        error: 'Cohere API error',
        details: responseData
      });
    }

    const responseText = responseData.message.content[0].text;

    res.json({ response: responseText });

  } catch (error) {
    console.error('Error during Cohere API call:', error);
    return res.status(500).json({
      error: 'An error occurred while processing your request',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Image generation endpoint for Hugging Face API
app.post('/generate-image', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required for image generation' });
  }

  try {
    console.log("Generating image with prompt:", prompt); // Debugging line

    const response = await fetch(`https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-3-medium-diffusers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          width: 256,
          height: 256
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hugging Face API error:', errorText);
      return res.status(response.status).json({
        error: 'Hugging Face API error',
        details: errorText
      });
    }

    // Handle binary response from Hugging Face
    const buffer = await response.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString('base64');

    // Send back the base64 image
    res.json({ image: `data:image/png;base64,${base64Image}` });

  } catch (error) {
    console.error("Error generating image:", error);
    res.status(500).json({ error: "Image generation failed" });
  }
});

// Export for Vercel
module.exports = app;