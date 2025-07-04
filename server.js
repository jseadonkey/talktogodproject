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
  const userSpeech = req.body.SpeechResult || '';
  const twiml = new VoiceResponse();

  console.log('\n=== Incoming Request ===');
  console.log(req.body);
  console.log('========================\n');

  // Handle new caller (no session + no speech yet)
  const isNewCall = !sessions[callSid] && !userSpeech;

  if (isNewCall) {
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
      },
      { role: 'user', content: 'Greet the guest and ask a question.' }
    ];

    try {
      const chatResponse = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: sessions[callSid]
      });

      let reply = chatResponse.choices[0].message.content;
      reply = reply.replace(/([.,!?])\s*/g, '$1... '); // Add dramatic pacing

      console.log(`\n=== FIRST GREETING ===`);
      console.log(`GOD: ${reply}`);
      console.log(`=======================\n`);

      sessions[callSid].push({ role: 'assistant', content: reply });

      const gather = twiml.gather({
        input: 'speech',
        action: '/voice',
        method: 'POST',
        timeout: 7
      });

      gather.say({ voice: 'Polly.Joanna', language: 'en-US' }, reply);

      res.type('text/xml');
      return res.send(twiml.toString());
    } catch (error) {
      console.error('Error during first greeting:', error);
      twiml.say("Oh dear... a celestial hiccup occurred. Try again in a moment.");
      res.type('text/xml');
      return res.send(twiml.toString());
    }
  }

  // If no speech in ongoing convo, reprompt
  if (!userSpeech) {
    const gather = twiml.gather({
      input: 'speech',
      action: '/voice',
      method: 'POST',
      timeout: 7
    });

    gather.say({ voice: 'Polly.Joanna', language: 'en-US' }, "I didn’t quite hear you... Want to try again? Go ahead, I’m listening...");
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // Maintain conversation
  sessions[callSid].push({ role: 'user', content: userSpeech });

  try {
    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: sessions[callSid]
    });

    let reply = chatResponse.choices[0].message.content;
    reply = reply.replace(/([.,!?])\s*/g, '$1... ');

    console.log(`\n=== RESPONSE ===`);
    console.log(`GUEST: ${userSpeech}`);
    console.log(`GOD: ${reply}`);
    console.log(`================\n`);

    sessions[callSid].push({ role: 'assistant', content: reply });

    const gather = twiml.gather({
      input: 'speech',
      action: '/voice',
      method: 'POST',
      timeout: 7
    });

    gather.say({ voice: 'Polly.Joanna', language: 'en-US' }, reply);
  } catch (error) {
    console.error('Error during GPT reply:', error);
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
