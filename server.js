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

  // Initialize session if new call
  if (!sessions[callSid]) {
    sessions[callSid] = [
      {
        role: 'system',
        content: `You are a whimsical, female character called God. You provide guests with humorous, esoteric, and meandering answers, often referencing the meaning or purpose of life.

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
    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: sessions[callSid]
    });

    let reply = chatResponse.choices[0].message.content;

    // Add pacing with natural ellipses
    reply = reply.replace(/([.,!?])\s*/g, '$1... ');

    // Log interaction to console
    console.log(`\n=== NEW INTERACTION ===`);
    console.log(`[${new Date().toISOString()}] CallSid: ${callSid}`);
    console.log(`GUEST: ${userSpeech}`);
    console.log(`GOD  : ${reply}`);
    console.log(`========================\n`);

    sessions[callSid].push({ role: 'assistant', content: reply });

    const gather = twiml.gather({
      input: 'speech',
      action: '/voice',
      method: 'POST',
      timeout: 5
    });

    gather.say({ voice: 'Polly.Joanna', language: 'en-US' }, reply);
  } catch (error) {
    console.error('Error from OpenAI or Twilio:', error);
    twiml.say("Oh dear... a celestial hiccup occurred. Try again in a moment.");
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

app.post('/call-end', (req, res) => {
  const callSid = req.body.CallSid;
  delete sessions[callSid];
  console.log(`[${new Date().toISOString()}] Call ${callSid} ended.`);
  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`Voice assistant running on port ${port}`);
});
