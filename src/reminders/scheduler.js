const cron = require('node-cron');
const twilio = require('twilio');
const config = require('../config');
const { getUpcomingAppointmentsForReminders, markReminderSent } = require('../state/sessions');
const { sendReminderEmail } = require('../email/mailer');

// ─── WhatsApp reminder message ─────────────────────────────────────────────────

function buildReminderMessage(appointment) {
  const dt = new Date(appointment.appointment_datetime);
  const timeStr = dt.toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  });
  const dateStr = dt.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Amsterdam',
  });

  return (
    `Goedemorgen ${appointment.customer_name}! 👋\n\n` +
    `Herinnering: morgen staat er een afspraak voor u klaar bij ${config.GARAGE_NAME}:\n\n` +
    `🔧 *${appointment.service_type}*\n` +
    `🚗 ${appointment.car_make} ${appointment.car_model} (${appointment.car_license})\n` +
    `📅 ${dateStr} om ${timeStr}\n\n` +
    `Kunt u er niet bij? Stuur ons gerust een bericht, dan zoeken we een ander moment.\n\n` +
    `Tot ${dateStr.split(' ')[0]}! 👍`
  );
}

// ─── Send via Twilio WhatsApp ──────────────────────────────────────────────────

async function sendWhatsAppReminder(appointment) {
  const client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);

  await client.messages.create({
    body: buildReminderMessage(appointment),
    from: config.TWILIO_WHATSAPP_NUMBER,
    to: appointment.phone_number,
  });

  console.log(`[Reminder] WhatsApp sent to ${appointment.phone_number} for appointment #${appointment.id}`);
}

// ─── Process due reminders ─────────────────────────────────────────────────────

async function processReminders() {
  console.log('[Reminder] Checking for appointments to remind…');

  let appointments;
  try {
    appointments = getUpcomingAppointmentsForReminders();
  } catch (err) {
    console.error('[Reminder] DB error:', err.message);
    return;
  }

  console.log(`[Reminder] Found ${appointments.length} appointment(s) to remind`);

  for (const appointment of appointments) {
    // Attempt WhatsApp reminder first
    let whatsappOk = false;
    try {
      await sendWhatsAppReminder(appointment);
      whatsappOk = true;
    } catch (err) {
      console.error(`[Reminder] WhatsApp failed for #${appointment.id}:`, err.message);
    }

    // Fallback: e-mail reminder if WhatsApp failed and we have an email address
    if (!whatsappOk && appointment.customer_email) {
      try {
        await sendReminderEmail({
          to: appointment.customer_email,
          customerName: appointment.customer_name,
          appointmentDatetime: new Date(appointment.appointment_datetime),
          serviceType: appointment.service_type,
          carMake: appointment.car_make,
          carModel: appointment.car_model,
          carLicense: appointment.car_license,
        });
        console.log(`[Reminder] Email fallback sent for #${appointment.id}`);
      } catch (emailErr) {
        console.error(`[Reminder] Email also failed for #${appointment.id}:`, emailErr.message);
      }
    }

    // Mark as sent regardless — don't spam on failure
    markReminderSent(appointment.id);
  }
}

// ─── Scheduler ─────────────────────────────────────────────────────────────────

function startReminderScheduler() {
  // Run every day at 09:00 Amsterdam time
  cron.schedule(
    '0 9 * * *',
    () => {
      processReminders().catch((err) =>
        console.error('[Reminder] Unexpected error:', err)
      );
    },
    { timezone: 'Europe/Amsterdam' }
  );

  console.log('[Reminder] Scheduler started — runs daily at 09:00 Amsterdam time');
}

module.exports = { startReminderScheduler, processReminders };
