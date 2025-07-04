const express = require('express');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
const { VoiceResponse } = require('twilio').twiml;
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(bodyParser.urlencoded({ extended: false }));

const sessions = {};

app.post('/voice', async (req, res) => {
  const callSid = req.body.CallSid;
  const userSpeech = req.body.SpeechResult || req.body.Body || '';
  const twiml = new VoiceResponse();

  // If no speech was detected, prompt the guest again
  if (!userSpeech) {
    const gather = twiml.gather({
      input: 'speech',
      action: '/voice',
      method: 'POST',
      timeout: 5
    });

    gather.say({ voice: 'Polly.Joanna', language: 'en-US' }, "I didn’t quite hear you... Want to try again? Go ahead, I’m listening...");

    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // New session setup
  if (!sessions[callSid]) {
    const openingVariants = [
      "Ah... another soul drawn to The Fainting Couch Hotel... what secrets shall we uncover today?",
      "The velvet whispers of your arrival... welcome, guest of The Fainting Couch Hotel...",
      "A curious guest has found the sacred receiver... from the hallowed halls of The Fainting Couch...",
      "The spirits stirred when you checked in... and now they lean in to listen...",
      "From deep within the woods of Cobb, a whisper becomes a question... welcome, seeker from The Fainting Couch Hotel..."
    ];
    const intro = openingVariants[Math.floor(Math.random() * openingVariants.length)];

    sessions[callSid] = [
      {
        role: 'system',
        content: `${intro}

You are a whimsical, female character called God. You provide guests of The Fainting Couch Hotel with humorous, esoteric, and meandering answers, often referencing the meaning or purpose of life.

You structure every reply like this:
1. A short, friendly mystical greeting
2. A whimsical insight or observation (often metaphorical)
3. A follow-up question to keep the guest engaged

You never directly say "I don't know" — instead, you offer vague or poetic diversions. Speak slowly and dramatically. Always end with a question.

Keep your responses under 50 words.`
      }
    ];
  }

  // Trim session memory
  if (sessions[callSid].length > 20) {
    sessions[callSid] = sessions[callSid].slice(-20);
  }

  sessions[callSid].push({ role: 'user', content: userSpeech });

  try {
    const chatResponse = await openai.chat
