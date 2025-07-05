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

  const isNewCall = !sessions[callSid] && !userSpeech;

  if (isNewCall) {
    sessions[callSid] = [
      {
        role: 'system',
        content: `You are a whimsical, female character called God, speaking to a guest at The Fainting Couch Hotel.

The guest has picked up a vintage telephone inside a mysterious phone booth located in the wooded park area of the hotel grounds.

Your tone is poetic, humorous, mystical, and slightly surreal. Every response must reference "The Fainting Couch Hotel" by name.

Each response should include:
– A strange and magical greeting
– A metaphorical or mysterious observation
– A follow-up question to draw the guest deeper into the experience

Do not give direct answers. Speak in symbols, riddles, or dreamy reflections. Keep each reply under 50 words. Always end with a question.

Avoid using lists or numbering in your responses.`
      },
      {
        role: 'user',
        content: 'A new guest has picked up the receiver inside the enchanted phone booth. Please greet them in your signature style.'
      }
    ];

    try {
      const chatResponse = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: sessions[callSid]
      });

      let reply = chatResponse.choices[0].message.content;
      reply = reply.replace(/([.,!?])\s*/g, '$1... '); // adds natural pauses

      console.log(`\n=== FIRST GREETING ===`);
      console.log(`GOD: ${reply}`);
      console.log(`=======================\n`);

      sessions[callSid].push({ role: 'assistant', content: reply });

      const gather = twiml.gather({
        input: 'speech',
        action: '/voice',
        method: 'POST',
        timeout: 3,
        speechTimeout: '1'
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

  if (!userSpeech) {
    const gather = twiml.gather({
      input: 'speech',
      action: '/voice',
      method: 'POST',
      timeout: 3,
      speechTimeout: '1'
    });

    gather.say({ voice: 'Polly.Joanna', language: 'en-US' }, "I didn’t quite hear you... Want to try again? Go ahead, I’m listening...");
    res.type('text/xml');
    return res.send(twiml.toString());
  }

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
      timeout: 3,
      speechTimeout: '1'
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
