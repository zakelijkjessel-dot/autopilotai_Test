require('dotenv').config();

const express = require('express');
const { initDatabase } = require('./state/database');
const { handleIncomingMessage } = require('./whatsapp/handler');
const { startReminderScheduler } = require('./reminders/scheduler');
const config = require('./config');

const app = express();

// Parse both URL-encoded bodies (Twilio) and JSON
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ─── Routes ────────────────────────────────────────────────────────────────────

// Health check — useful for uptime monitors and deployment verification
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: `${config.GARAGE_NAME} WhatsApp Chatbot`,
    timestamp: new Date().toISOString(),
  });
});

// Twilio webhook — receives inbound WhatsApp messages
app.post('/webhook/whatsapp', handleIncomingMessage);

// ─── Startup ───────────────────────────────────────────────────────────────────

async function start() {
  // Initialize SQLite database (creates tables if not exist)
  initDatabase();

  // Start cron scheduler for 24h appointment reminders
  startReminderScheduler();

  app.listen(config.PORT, () => {
    console.log(`\n🚗  ${config.GARAGE_NAME} — WhatsApp Chatbot`);
    console.log(`✅  Server running on port ${config.PORT}`);
    console.log(`📲  Webhook endpoint: POST /webhook/whatsapp`);
    console.log(`🕐  Reminders: daily at 09:00 Amsterdam time\n`);
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
