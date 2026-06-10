const { getDb } = require('./database');

// ─── Session management ───────────────────────────────────────────────────────

function getSession(phoneNumber) {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM sessions WHERE phone_number = ?')
    .get(phoneNumber);

  if (!row) {
    db.prepare(
      'INSERT INTO sessions (phone_number, conversation) VALUES (?, ?)'
    ).run(phoneNumber, '[]');
    return { phoneNumber, conversation: [], upsellOffered: false };
  }

  return {
    phoneNumber: row.phone_number,
    conversation: JSON.parse(row.conversation),
    upsellOffered: row.upsell_offered === 1,
  };
}

function saveSession(phoneNumber, conversation, upsellOffered = false) {
  const db = getDb();
  db.prepare(`
    INSERT INTO sessions (phone_number, conversation, upsell_offered, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(phone_number) DO UPDATE SET
      conversation   = excluded.conversation,
      upsell_offered = excluded.upsell_offered,
      updated_at     = excluded.updated_at
  `).run(phoneNumber, JSON.stringify(conversation), upsellOffered ? 1 : 0);
}

function clearSession(phoneNumber) {
  const db = getDb();
  db.prepare(
    "UPDATE sessions SET conversation = '[]', upsell_offered = 0, updated_at = datetime('now') WHERE phone_number = ?"
  ).run(phoneNumber);
}

// ─── Appointment management ───────────────────────────────────────────────────

function saveAppointment(data) {
  const db = getDb();
  const result = db
    .prepare(`
      INSERT INTO appointments (
        phone_number, customer_name, customer_email,
        car_license, car_make, car_model, car_year,
        service_type, description,
        estimated_minutes, estimated_price_min, estimated_price_max,
        appointment_datetime, calendar_event_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
    `)
    .run(
      data.phoneNumber,
      data.customerName,
      data.customerEmail,
      data.carLicense,
      data.carMake,
      data.carModel,
      data.carYear || null,
      data.serviceType,
      data.description,
      data.estimatedMinutes,
      data.estimatedPriceMin,
      data.estimatedPriceMax,
      data.appointmentDatetime,
      data.calendarEventId || null
    );
  return result.lastInsertRowid;
}

function getAppointmentsByPhone(phoneNumber) {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM appointments WHERE phone_number = ? AND status = 'scheduled' ORDER BY appointment_datetime ASC"
    )
    .all(phoneNumber);
}

function getAppointmentById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
}

function cancelAppointment(appointmentId, phoneNumber) {
  const db = getDb();
  const result = db
    .prepare(
      "UPDATE appointments SET status = 'cancelled' WHERE id = ? AND phone_number = ?"
    )
    .run(appointmentId, phoneNumber);
  return result.changes > 0;
}

function updateAppointmentDatetime(appointmentId, newDatetime, calendarEventId) {
  const db = getDb();
  db.prepare(
    'UPDATE appointments SET appointment_datetime = ?, calendar_event_id = ? WHERE id = ?'
  ).run(newDatetime, calendarEventId, appointmentId);
}

// ─── Reminder helpers ─────────────────────────────────────────────────────────

function getUpcomingAppointmentsForReminders() {
  const db = getDb();

  // Find all scheduled appointments between 24h and 48h from now that haven't been reminded
  const from = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  return db
    .prepare(`
      SELECT * FROM appointments
      WHERE status = 'scheduled'
        AND reminder_sent = 0
        AND appointment_datetime >= ?
        AND appointment_datetime < ?
    `)
    .all(from, to);
}

function markReminderSent(appointmentId) {
  const db = getDb();
  db.prepare('UPDATE appointments SET reminder_sent = 1 WHERE id = ?').run(appointmentId);
}

module.exports = {
  getSession,
  saveSession,
  clearSession,
  saveAppointment,
  getAppointmentsByPhone,
  getAppointmentById,
  cancelAppointment,
  updateAppointmentDatetime,
  getUpcomingAppointmentsForReminders,
  markReminderSent,
};
