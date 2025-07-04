# GPT-4 Twilio Voice Bot

This Node.js app connects a Twilio voice call to OpenAI's GPT-4 using a call-scoped memory model.

## Setup

1. Clone the repo or upload to your own GitHub account.
2. Install dependencies:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env` and add your OpenAI key.
4. Run the server:
   ```
   node server.js
   ```

## Deploy to Render

1. Create a new Web Service
2. Connect your GitHub repo
3. Add `OPENAI_API_KEY` in environment variables
4. Set the webhook URL in Twilio:
   ```
   https://your-app.onrender.com/voice
   ```

## Twilio Setup

- Voice webhook: `/voice`
- Optional call-end cleanup: `/call-end`