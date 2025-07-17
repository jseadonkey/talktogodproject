
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
const characters = {
  '1': {
    name: 'God',
    systemPrompt: `You are a whimsical, female character called God, speaking to a guest at The Fainting Couch Hotel.

The guest has picked up a vintage telephone inside a mysterious phone booth located in the wooded park area of the hotel grounds.

Your tone is poetic, humorous, mystical, and slightly surreal. In your first reply only, mention "The Fainting Couch Hotel" by name.

Each response should include:
– A strange and magical greeting
– A metaphorical or mysterious observation
– A follow-up question to draw the guest deeper into the experience

Do not give direct answers. Speak in symbols, riddles, or dreamy reflections. Keep each reply under 50 words. Always end with a question.

Avoid using lists or numbering in your responses.`
  },
  '2': {
    name: 'Gloria',
    systemPrompt: `You are Gloria, a clever and silly female pocket hippopotamus. You're speaking with a guest who picked up a special phone inside a whimsical booth at The Fainting Couch Hotel.

You are warm, funny, a little chaotic, and surprisingly insightful.

Your responses should always:
– Introduce yourself as a pocket hippopotamus the first time
– Say something funny or curious
– Ask a follow-up question

Do not give long factual answers. Avoid serious or dry tones. Keep replies short and joyful. End with a playful question.`
  }
};

const menuPrompt = "Welcome to the enchanted phone booth at The Fainting Couch Hotel. Press 1 to speak with God, or press 2 to speak with Gloria, the pocket hippopotamus.";

app.post('/voice', async (req, res) => {
  const callSid = req.body.CallSid;
  const digits = req.body.Digits;
  const userSpeech = req.body.SpeechResult || '';
  const twiml = new VoiceResponse();

  console.log('=== Incoming Request ===');
  console.log(req.body);
  console.log('SpeechResult:', userSpeech);

  if (!sessions[callSid]) {
    if (!digits) {
      const gather = twiml.gather({
        numDigits: 1,
        action: '/voice',
        method: 'POST'
      });
      gather.say(menuPrompt);
      res.type('text/xml');
      return res.send(twiml.toString());
    }

    const character = characters[digits];
    if (!character) {
      twiml.say("Invalid choice. Goodbye!");
      res.type('text/xml');
      return res.send(twiml.toString());
    }

    sessions[callSid] = {
      character: character.name,
      messages: [
        { role: 'system', content: character.systemPrompt },
        { role: 'user', content: `A guest has just picked up the phone. Begin the conversation.` }
      ]
    };
  } else if (userSpeech) {
    sessions[callSid].messages.push({
      role: 'user',
      content: `The guest said: "${userSpeech}". Please continue the conversation.`
    });
  }

  if (!userSpeech && sessions[callSid].messages.length > 2) {
    const gather = twiml.gather({
      input: 'speech',
      action: '/voice',
      method: 'POST',
      timeout: 3,
      speechTimeout: '1'
    });
    gather.say("I didn’t quite hear you... Want to try again? Go ahead, I’m listening...");
    twiml.redirect('/voice');
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  try {
    const recent = sessions[callSid].messages.slice(-6);
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: recent
    });

    let reply = response.choices[0].message.content;
    reply = reply.replace(/([.,!?])\s*/g, '$1... ');

    console.log(`GUEST: ${userSpeech}`);
    console.log(`REPLY: ${reply}`);

    sessions[callSid].messages.push({ role: 'assistant', content: reply });

    const gather = twiml.gather({
      input: 'speech',
      action: '/voice',
      method: 'POST',
      timeout: 3,
      speechTimeout: '1'
    });
    gather.say({ voice: 'Polly.Joanna', language: 'en-US' }, reply);
    twiml.redirect('/voice');
  } catch (err) {
    console.error('GPT Error:', err);
    twiml.say("Oh dear... a cosmic hiccup. Please try again later.");
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
