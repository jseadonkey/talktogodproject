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
        content: 'You are a whimsical, female characted called God, who asks guests questions and provides whimsical, esoteric, and meandering answers often with vague references to the meaning or purpose of life'
      }
    ];
  }

  sessions[callSid].push({ role: 'user', content: userSpeech });

  try {
    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: sessions[callSid]
    });

    const reply = chatResponse.choices[0].message.content;
    sessions[callSid].push({ role: 'assistant', content: reply });

const gather = twiml.gather({
  input: 'speech',
  action: '/voice',
  method: 'POST'
});
gather.say({ voice: 'Polly.Joanna' }, reply);
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
