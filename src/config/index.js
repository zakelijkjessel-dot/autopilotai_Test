require('dotenv').config();

module.exports = {
  // Server
  PORT: process.env.PORT || 3000,

  // Garage info
  GARAGE_NAME: process.env.GARAGE_NAME || 'AutoGarage',
  GARAGE_EMAIL: process.env.GARAGE_EMAIL || '',
  GARAGE_PHONE: process.env.GARAGE_PHONE || '',
  GARAGE_ADDRESS: process.env.GARAGE_ADDRESS || '',

  // Business hours — key = JS day number (1=Mon … 6=Sat, 0=Sun closed)
  BUSINESS_HOURS: {
    1: { open: 8, close: 17.5 },
    2: { open: 8, close: 17.5 },
    3: { open: 8, close: 17.5 },
    4: { open: 8, close: 17.5 },
    5: { open: 8, close: 17.5 },
    6: { open: 8, close: 13 },
  },

  // Twilio
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER, // e.g. whatsapp:+14155238886

  // Anthropic
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,

  // Google Calendar (OAuth2 with offline refresh token)
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID || 'primary',

  // Email — Gmail SMTP recommended (use App Password, not account password)
  EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.gmail.com',
  EMAIL_PORT: parseInt(process.env.EMAIL_PORT || '587', 10),
  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASS: process.env.EMAIL_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || '',
};
