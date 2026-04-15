const nodemailer = require('nodemailer');
const config = require('../config');

// ─── Transporter ───────────────────────────────────────────────────────────────

function createTransporter() {
  return nodemailer.createTransport({
    host: config.EMAIL_HOST,
    port: config.EMAIL_PORT,
    secure: config.EMAIL_PORT === 465,
    auth: {
      user: config.EMAIL_USER,
      pass: config.EMAIL_PASS,
    },
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(date) {
  return date.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  });
}

function formatShortDate(date) {
  return date.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Amsterdam',
  });
}

const baseStyle = `
  body{font-family:Arial,Helvetica,sans-serif;color:#333;margin:0;padding:0;background:#f4f4f4}
  .wrap{max-width:600px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)}
  .hdr{padding:24px 28px;color:#fff;text-align:center}
  .hdr h1{margin:0 0 4px;font-size:22px}
  .hdr p{margin:0;opacity:.85;font-size:14px}
  .body{padding:28px}
  .card{background:#f0f7ff;border-radius:8px;padding:18px;margin:18px 0}
  .card table{width:100%;border-collapse:collapse}
  .card td{padding:6px 0;vertical-align:top}
  .card td:first-child{font-weight:bold;color:#555;width:160px;white-space:nowrap}
  .note{font-style:italic;color:#666;font-size:13px;margin-top:16px}
  .ftr{background:#f5f5f5;padding:14px 28px;text-align:center;font-size:12px;color:#999}
`;

// ─── Confirmation email ────────────────────────────────────────────────────────

async function sendConfirmationEmail({
  to,
  customerName,
  appointmentDatetime,
  serviceType,
  carMake,
  carModel,
  carLicense,
  estimatedMinutes,
  estimatedPriceMin,
  estimatedPriceMax,
  description,
}) {
  const transporter = createTransporter();
  const garageName = config.GARAGE_NAME;
  const from = `${garageName} <${config.EMAIL_FROM || config.EMAIL_USER}>`;

  const html = `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8">
<style>${baseStyle}</style></head><body><div class="wrap">
<div class="hdr" style="background:#1a3a5c">
  <h1>${garageName}</h1>
  <p>Afspraakbevestiging</p>
</div>
<div class="body">
  <p>Beste ${customerName},</p>
  <p>Uw afspraak is bevestigd! Hieronder vindt u de details:</p>
  <div class="card">
    <table>
      <tr><td>Datum &amp; tijd:</td><td><strong>${formatDate(appointmentDatetime)}</strong></td></tr>
      <tr><td>Service:</td><td>${serviceType}</td></tr>
      <tr><td>Voertuig:</td><td>${carMake} ${carModel} &mdash; ${carLicense}</td></tr>
      <tr><td>Verwachte duur:</td><td>±${estimatedMinutes} minuten</td></tr>
      <tr><td>Prijsindicatie:</td><td>€${estimatedPriceMin}&ndash;€${estimatedPriceMax} <small style="color:#999">(excl. BTW, indicatief)</small></td></tr>
      ${description ? `<tr><td>Omschrijving:</td><td>${description}</td></tr>` : ''}
    </table>
  </div>
  ${config.GARAGE_ADDRESS ? `<p>📍 <strong>Adres:</strong> ${config.GARAGE_ADDRESS}</p>` : ''}
  ${config.GARAGE_PHONE ? `<p>📞 <strong>Telefoon:</strong> ${config.GARAGE_PHONE}</p>` : ''}
  <p class="note">Afspraak verzetten of vragen? Stuur ons een WhatsApp-bericht en we helpen u direct verder.</p>
</div>
<div class="ftr">${garageName}${config.GARAGE_ADDRESS ? ' &bull; ' + config.GARAGE_ADDRESS : ''}
<br>Dit is een automatisch gegenereerde e-mail.</div>
</div></body></html>`;

  await transporter.sendMail({
    from,
    to,
    bcc: config.GARAGE_EMAIL || undefined,
    subject: `Afspraakbevestiging – ${serviceType} op ${formatShortDate(appointmentDatetime)}`,
    html,
  });
}

// ─── Cancellation email ────────────────────────────────────────────────────────

async function sendCancellationEmail({ to, customerName, appointmentDatetime, serviceType }) {
  const transporter = createTransporter();
  const garageName = config.GARAGE_NAME;
  const from = `${garageName} <${config.EMAIL_FROM || config.EMAIL_USER}>`;

  const html = `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8">
<style>${baseStyle}</style></head><body><div class="wrap">
<div class="hdr" style="background:#7b2020">
  <h1>${garageName}</h1>
  <p>Afspraak geannuleerd</p>
</div>
<div class="body">
  <p>Beste ${customerName},</p>
  <p>Uw afspraak is geannuleerd:</p>
  <div class="card">
    <table>
      <tr><td>Service:</td><td>${serviceType}</td></tr>
      <tr><td>Was gepland:</td><td>${formatDate(appointmentDatetime)}</td></tr>
    </table>
  </div>
  <p>Wilt u een nieuwe afspraak inplannen? Stuur ons een WhatsApp-bericht en we regelen het snel voor u.</p>
</div>
<div class="ftr">${garageName}<br>Dit is een automatisch gegenereerde e-mail.</div>
</div></body></html>`;

  await transporter.sendMail({
    from,
    to,
    subject: `Afspraak geannuleerd – ${serviceType}`,
    html,
  });
}

// ─── Reminder email (fallback — we primarily use WhatsApp reminders) ──────────

async function sendReminderEmail({
  to,
  customerName,
  appointmentDatetime,
  serviceType,
  carMake,
  carModel,
  carLicense,
}) {
  const transporter = createTransporter();
  const garageName = config.GARAGE_NAME;
  const from = `${garageName} <${config.EMAIL_FROM || config.EMAIL_USER}>`;

  const html = `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8">
<style>${baseStyle}</style></head><body><div class="wrap">
<div class="hdr" style="background:#1a5c3a">
  <h1>${garageName}</h1>
  <p>Herinnering afspraak morgen</p>
</div>
<div class="body">
  <p>Beste ${customerName},</p>
  <p>Herinnering: u heeft morgen een afspraak bij ${garageName}:</p>
  <div class="card">
    <table>
      <tr><td>Datum &amp; tijd:</td><td><strong>${formatDate(appointmentDatetime)}</strong></td></tr>
      <tr><td>Service:</td><td>${serviceType}</td></tr>
      <tr><td>Voertuig:</td><td>${carMake} ${carModel} &mdash; ${carLicense}</td></tr>
    </table>
  </div>
  ${config.GARAGE_ADDRESS ? `<p>📍 ${config.GARAGE_ADDRESS}</p>` : ''}
  <p class="note">Niet meer mogelijk? Laat het ons weten via WhatsApp.</p>
</div>
<div class="ftr">${garageName}<br>Dit is een automatisch gegenereerde e-mail.</div>
</div></body></html>`;

  await transporter.sendMail({
    from,
    to,
    subject: `Herinnering: uw afspraak morgen – ${serviceType}`,
    html,
  });
}

module.exports = { sendConfirmationEmail, sendCancellationEmail, sendReminderEmail };
