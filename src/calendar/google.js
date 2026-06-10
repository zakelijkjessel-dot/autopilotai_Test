const { google } = require('googleapis');
const config = require('../config');

// ─── Auth ──────────────────────────────────────────────────────────────────────

function getAuthClient() {
  const auth = new google.auth.OAuth2(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: config.GOOGLE_REFRESH_TOKEN });
  return auth;
}

// ─── Calendar helpers ──────────────────────────────────────────────────────────

/**
 * Create a new calendar event.
 * Returns the created event object (includes event.id).
 */
async function createCalendarEvent({
  title,
  description,
  startTime,
  endTime,
  customerName,
  customerEmail,
}) {
  const auth = getAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const attendees = customerEmail
    ? [{ email: customerEmail, displayName: customerName }]
    : [];

  const event = {
    summary: title,
    description,
    start: { dateTime: startTime, timeZone: 'Europe/Amsterdam' },
    end: { dateTime: endTime, timeZone: 'Europe/Amsterdam' },
    attendees,
    colorId: '5', // Banana — visually distinct in Google Calendar
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },     // 1 hour before
        { method: 'popup', minutes: 24 * 60 }, // 1 day before
      ],
    },
  };

  const response = await calendar.events.insert({
    calendarId: config.GOOGLE_CALENDAR_ID,
    resource: event,
    sendUpdates: 'none', // We send our own email confirmation
  });

  return response.data;
}

/**
 * Delete (cancel) a calendar event by event ID.
 */
async function cancelCalendarEvent(eventId) {
  const auth = getAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });

  await calendar.events.delete({
    calendarId: config.GOOGLE_CALENDAR_ID,
    eventId,
    sendUpdates: 'none',
  });
}

/**
 * Update the start/end time of an existing event.
 * Returns the updated event object.
 */
async function updateCalendarEvent(eventId, { startTime, endTime }) {
  const auth = getAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.events.patch({
    calendarId: config.GOOGLE_CALENDAR_ID,
    eventId,
    resource: {
      start: { dateTime: startTime, timeZone: 'Europe/Amsterdam' },
      end: { dateTime: endTime, timeZone: 'Europe/Amsterdam' },
    },
    sendUpdates: 'none',
  });

  return response.data;
}

/**
 * Return existing events for a given date (YYYY-MM-DD).
 * Useful for checking how busy a day already is.
 */
async function getEventsOnDate(dateString) {
  const auth = getAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const start = new Date(`${dateString}T00:00:00+02:00`);
  const end = new Date(`${dateString}T23:59:59+02:00`);

  const response = await calendar.events.list({
    calendarId: config.GOOGLE_CALENDAR_ID,
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return response.data.items || [];
}

module.exports = {
  createCalendarEvent,
  cancelCalendarEvent,
  updateCalendarEvent,
  getEventsOnDate,
};
