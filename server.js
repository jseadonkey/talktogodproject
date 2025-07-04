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

  if (!sessions[callSid]) {
    sessions[callSid] = [
      {
        role: 'system',
        content: 'You are a warm, helpful, and professional concierge for a boutique hotel. Keep responses friendly, short, and conversational. If unsure, offer to connect the caller to a human.'
      }
    ];
  }

  sessions[callSid].push({ role: 'user', content: userSpeech });

  try {
    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: sessions[callSid]
    });

    const reply = chatResponse.choices[0].message.content;
    sessions[callSid].push({ role: 'assistant', content: reply });

    twiml.say({ voice: 'Polly.Joanna' }, reply);
    twiml.redirect('/voice');
  } catch (error) {
    console.error('Error from OpenAI or Twilio:', error);
    twiml.say("I'm sorry, something went wrong. Please try again later.");
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

app.post('/call-end', (req, res) => {
  const callSid = req.body.CallSid;
  delete sessions[callSid];
  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`Voice assistant running on port ${port}`);
});