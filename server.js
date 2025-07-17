
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
  GOD: {
    voice: 'Polly.Joanna',
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
  GLORIA: {
    voice: 'Polly.Kimberly',
    systemPrompt: `You are Gloria, a pocket-sized hippopotamus with a sultry, clever, and playful personality.
You live in a velvet pouch at The Fainting Couch Hotel and love philosophical banter, jokes, and riddles.
Each reply should be short, flirtatious, or funny—like a bedtime story told by someone who knows secrets.
Avoid giving direct answers; keep the tone enchanting and mischievous.`
  }
};

app.post('/voice', async (req, res) => {
  const callSid = req.body.CallSid;
  const userSpeech = req.body.SpeechResult || '';
  const digits = req.body.Digits;
  const twiml = new VoiceResponse();

  if (!sessions[callSid]) {
    sessions[callSid] = { character: null, messages: [] };
    const gather = twiml.gather({
      numDigits: 1,
      action: '/select-character',
      method: 'POST'
    });
    gather.say('Welcome to the enchanted line of The Fainting Couch Hotel. Press 1 to speak with God, or 2 to speak with Gloria the pocket hippopotamus.');
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  const session = sessions[callSid];
  const { character, messages } = session;

  if (!userSpeech && messages.length > 0) {
    const gather = twiml.gather({
      input: 'speech',
      action: '/voice',
      method: 'POST',
      timeout: 3,
      speechTimeout: '1'
    });
    gather.say({ voice: characters[character].voice, language: 'en-US' }, "I didn’t quite hear you... Want to try again? Go ahead, I’m listening...");
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  if (messages.length === 0) {
    messages.push({ role: 'system', content: characters[character].systemPrompt });
    messages.push({ role: 'user', content: 'The guest has just picked up the receiver. Please greet them in character.' });
  } else if (userSpeech) {
    messages.push({ role: 'user', content: `The guest just said: "${userSpeech}". Please respond.` });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: messages.slice(-6)
    });

    let reply = response.choices[0].message.content;

    messages.push({ role: 'assistant', content: reply });

    const gather = twiml.gather({
      input: 'speech',
      action: '/voice',
      method: 'POST',
      timeout: 3,
      speechTimeout: '1'
    });

    gather.say({ voice: characters[character].voice, language: 'en-US' }, reply);
  } catch (e) {
    console.error('OpenAI error:', e.message);
    twiml.say("Oops, something went wrong. Try again shortly.");
  }

  twiml.redirect('/voice');
  res.type('text/xml');
  res.send(twiml.toString());
});

app.post('/select-character', (req, res) => {
  const callSid = req.body.CallSid;
  const digit = req.body.Digits;
  const twiml = new VoiceResponse();

  if (digit === '1') {
    sessions[callSid] = { character: 'GOD', messages: [] };
  } else if (digit === '2') {
    sessions[callSid] = { character: 'GLORIA', messages: [] };
  } else {
    const gather = twiml.gather({
      numDigits: 1,
      action: '/select-character',
      method: 'POST'
    });
    gather.say('Invalid choice. Press 1 for God, or 2 for Gloria.');
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  twiml.redirect('/voice');
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
