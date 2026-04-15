const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const config = require('../config');
const { createCalendarEvent, cancelCalendarEvent, updateCalendarEvent } = require('../calendar/google');
const { sendConfirmationEmail, sendCancellationEmail } = require('../email/mailer');
const {
  saveAppointment,
  getAppointmentsByPhone,
  getAppointmentById,
  cancelAppointment,
  updateAppointmentDatetime,
} = require('../state/sessions');

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

// ─── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt() {
  const now = new Date().toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  });

  return `Je bent een vriendelijke en professionele klantenservice assistent van ${config.GARAGE_NAME}. \
Je helpt klanten via WhatsApp met alles rondom hun auto en afspraken.

JOUW TAKEN:
• Afspraken inplannen, verplaatsen en annuleren
• Vragen beantwoorden over onderhoud en reparaties
• Prijsindicaties en tijdsinschattingen geven
• Foto's van schade, banden of auto-onderdelen analyseren
• Eén keer per gesprek subtiel een aanvullende dienst aanraden

INFORMATIE DIE JE NODIG HEBT VOOR EEN AFSPRAAK:
Verzamel dit stap voor stap — stel niet alles tegelijk:
1. Voor- en achternaam van de klant
2. E-mailadres (voor de bevestigingsmail)
3. Kenteken (bijv. AB-123-C)
4. Merk en model van de auto
5. Bouwjaar (indien bekend, anders overslaan)
6. Wat er moet gebeuren / het probleem
7. Gewenste datum én tijdstip

Als de klant onzeker is over datum/tijd, stel dan voor: maandag t/m vrijdag 08:00–17:30, zaterdag 08:00–13:00.
Vraag nooit om informatie die je al hebt.

TARIEVEN (indicatief, excl. BTW — communiceer dit altijd als richtprijs):
• APK keuring:              €45–55   |  45–60 min
• APK + kleine beurt:       €85–105  |  90–120 min
• Kleine beurt (olie/filter): €75–120  |  60–90 min
• Grote beurt:              €150–250 | 120–180 min
• Remmen (voor of achter):  €80–150  |  60–90 min
• Banden wisselen (4 st.):  €40–60   |  30–45 min
• Airco service:            €65–85   |  45–60 min
• Diagnose / storing:       €45–65   |  30–60 min (excl. reparatie)
• Uitlijnen & balanceren:   €40–70   |  30–45 min
• Schadeherstel:            €100+    |  variabel

UPSELLING (max 1× per gesprek, subtiel en oprecht):
• APK aangevraagd → stel kleine beurt voor
• Banden wisselen → stel uitlijnen voor
• Diagnose bij oudere auto → noem preventief onderhoud
Stel de upsell nooit op een opdringerige manier voor. Één zin is genoeg.

FOTO ANALYSE:
Als de klant een foto stuurt, analyseer je wat je ziet: type schade, ernst, mogelijk risico en aanbeveling. \
Wees concreet maar zonder overbodige technische termen.

TOON & STIJL:
• Schrijf altijd Nederlands
• Kort en bondig — dit is WhatsApp, geen e-mail
• Vriendelijk en persoonlijk, niet formeel
• Gebruik af en toe een emoji, maar houd het rustig
• Bevestig altijd de afspraakgegevens voordat je ze vastlegt

HUIDIGE DATUM & TIJD: ${now}
${config.GARAGE_ADDRESS ? `ADRES GARAGE: ${config.GARAGE_ADDRESS}` : ''}
${config.GARAGE_PHONE ? `TELEFOON GARAGE: ${config.GARAGE_PHONE}` : ''}`;
}

// ─── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'schedule_appointment',
    description:
      'Plan een nieuwe afspraak in Google Calendar en stuur een bevestigingsmail. ' +
      'Roep deze functie ALLEEN aan wanneer je alle benodigde informatie hebt verzameld ' +
      '(naam, email, kenteken, merk/model, servicetype, datum+tijd) én de klant heeft bevestigd.',
    input_schema: {
      type: 'object',
      properties: {
        customer_name: { type: 'string', description: 'Voor- en achternaam van de klant' },
        customer_email: { type: 'string', description: 'E-mailadres voor bevestigingsmail' },
        car_license: { type: 'string', description: 'Kenteken (bijv. AB-123-C)' },
        car_make: { type: 'string', description: 'Merk van de auto (bijv. Volkswagen)' },
        car_model: { type: 'string', description: 'Model van de auto (bijv. Golf)' },
        car_year: { type: 'number', description: 'Bouwjaar (optioneel)' },
        service_type: { type: 'string', description: 'Type service (bijv. APK, kleine beurt)' },
        description: { type: 'string', description: 'Uitgebreide omschrijving van het probleem of gewenste service' },
        appointment_datetime: {
          type: 'string',
          description: 'Datum en tijd in ISO 8601 (bijv. 2025-01-15T09:00:00)',
        },
        estimated_minutes: { type: 'number', description: 'Geschatte duur in minuten' },
        estimated_price_min: { type: 'number', description: 'Minimale prijsschatting in euros (excl. BTW)' },
        estimated_price_max: { type: 'number', description: 'Maximale prijsschatting in euros (excl. BTW)' },
      },
      required: [
        'customer_name', 'customer_email', 'car_license', 'car_make', 'car_model',
        'service_type', 'description', 'appointment_datetime',
        'estimated_minutes', 'estimated_price_min', 'estimated_price_max',
      ],
    },
  },
  {
    name: 'get_appointments',
    description: 'Haal de geplande afspraken op van de klant op basis van hun telefoonnummer.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'cancel_appointment',
    description: 'Annuleer een bestaande afspraak van de klant.',
    input_schema: {
      type: 'object',
      properties: {
        appointment_id: { type: 'number', description: 'ID van de afspraak die geannuleerd moet worden' },
      },
      required: ['appointment_id'],
    },
  },
  {
    name: 'reschedule_appointment',
    description: 'Verplaats een bestaande afspraak naar een nieuwe datum en tijd.',
    input_schema: {
      type: 'object',
      properties: {
        appointment_id: { type: 'number', description: 'ID van de afspraak die verplaatst moet worden' },
        new_datetime: {
          type: 'string',
          description: 'Nieuwe datum en tijd in ISO 8601 (bijv. 2025-01-20T14:00:00)',
        },
      },
      required: ['appointment_id', 'new_datetime'],
    },
  },
];

// ─── Image download ────────────────────────────────────────────────────────────

async function downloadImageAsBase64(imageUrl) {
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    auth: {
      username: config.TWILIO_ACCOUNT_SID,
      password: config.TWILIO_AUTH_TOKEN,
    },
    timeout: 15000,
  });

  const base64 = Buffer.from(response.data).toString('base64');
  const contentType = (response.headers['content-type'] || 'image/jpeg').split(';')[0].trim();

  // Claude vision supports jpeg, png, gif, webp
  const supported = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const mediaType = supported.includes(contentType) ? contentType : 'image/jpeg';

  return { base64, mediaType };
}

// ─── Tool execution ────────────────────────────────────────────────────────────

async function executeToolCall(toolName, toolInput, phoneNumber) {
  console.log(`[Tool] ${toolName}`, JSON.stringify(toolInput));

  try {
    // ── schedule_appointment ──────────────────────────────────────────────────
    if (toolName === 'schedule_appointment') {
      const start = new Date(toolInput.appointment_datetime);
      const end = new Date(start.getTime() + toolInput.estimated_minutes * 60 * 1000);

      const calendarDescription = [
        `Klant:        ${toolInput.customer_name}`,
        `E-mail:       ${toolInput.customer_email}`,
        `Telefoon:     ${phoneNumber}`,
        `Kenteken:     ${toolInput.car_license}`,
        `Auto:         ${toolInput.car_make} ${toolInput.car_model}${toolInput.car_year ? ` (${toolInput.car_year})` : ''}`,
        `Service:      ${toolInput.service_type}`,
        `Omschrijving: ${toolInput.description}`,
        `Duur:         ±${toolInput.estimated_minutes} min`,
        `Prijs:        €${toolInput.estimated_price_min}–€${toolInput.estimated_price_max} excl. BTW`,
      ].join('\n');

      let calendarEventId = null;
      try {
        const event = await createCalendarEvent({
          title: `${toolInput.service_type} – ${toolInput.car_make} ${toolInput.car_model} (${toolInput.car_license})`,
          description: calendarDescription,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          customerName: toolInput.customer_name,
          customerEmail: toolInput.customer_email,
        });
        calendarEventId = event.id;
        console.log(`[Calendar] Event created: ${calendarEventId}`);
      } catch (err) {
        console.error('[Calendar] Failed to create event:', err.message);
      }

      const appointmentId = saveAppointment({
        phoneNumber,
        customerName: toolInput.customer_name,
        customerEmail: toolInput.customer_email,
        carLicense: toolInput.car_license,
        carMake: toolInput.car_make,
        carModel: toolInput.car_model,
        carYear: toolInput.car_year || null,
        serviceType: toolInput.service_type,
        description: toolInput.description,
        estimatedMinutes: toolInput.estimated_minutes,
        estimatedPriceMin: toolInput.estimated_price_min,
        estimatedPriceMax: toolInput.estimated_price_max,
        appointmentDatetime: start.toISOString(),
        calendarEventId,
      });

      try {
        await sendConfirmationEmail({
          to: toolInput.customer_email,
          customerName: toolInput.customer_name,
          appointmentDatetime: start,
          serviceType: toolInput.service_type,
          carMake: toolInput.car_make,
          carModel: toolInput.car_model,
          carLicense: toolInput.car_license,
          estimatedMinutes: toolInput.estimated_minutes,
          estimatedPriceMin: toolInput.estimated_price_min,
          estimatedPriceMax: toolInput.estimated_price_max,
          description: toolInput.description,
        });
        console.log(`[Email] Confirmation sent to ${toolInput.customer_email}`);
      } catch (err) {
        console.error('[Email] Failed to send confirmation:', err.message);
      }

      const formattedDate = start.toLocaleDateString('nl-NL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Amsterdam',
      });

      return {
        success: true,
        appointmentId,
        formattedDatetime: formattedDate,
        calendarCreated: !!calendarEventId,
      };
    }

    // ── get_appointments ──────────────────────────────────────────────────────
    if (toolName === 'get_appointments') {
      const rows = getAppointmentsByPhone(phoneNumber);
      if (rows.length === 0) {
        return { appointments: [], message: 'Geen geplande afspraken gevonden.' };
      }
      return {
        appointments: rows.map((a) => ({
          id: a.id,
          datetime: a.appointment_datetime,
          service: a.service_type,
          car: `${a.car_make} ${a.car_model} (${a.car_license})`,
          status: a.status,
        })),
      };
    }

    // ── cancel_appointment ────────────────────────────────────────────────────
    if (toolName === 'cancel_appointment') {
      const appointment = getAppointmentById(toolInput.appointment_id);
      if (!appointment || appointment.phone_number !== phoneNumber) {
        return { success: false, message: 'Afspraak niet gevonden.' };
      }

      if (appointment.calendar_event_id) {
        try {
          await cancelCalendarEvent(appointment.calendar_event_id);
          console.log(`[Calendar] Event deleted: ${appointment.calendar_event_id}`);
        } catch (err) {
          console.error('[Calendar] Failed to delete event:', err.message);
        }
      }

      cancelAppointment(toolInput.appointment_id, phoneNumber);

      if (appointment.customer_email) {
        try {
          await sendCancellationEmail({
            to: appointment.customer_email,
            customerName: appointment.customer_name,
            appointmentDatetime: new Date(appointment.appointment_datetime),
            serviceType: appointment.service_type,
          });
        } catch (err) {
          console.error('[Email] Failed to send cancellation:', err.message);
        }
      }

      return { success: true, message: 'Afspraak geannuleerd.' };
    }

    // ── reschedule_appointment ────────────────────────────────────────────────
    if (toolName === 'reschedule_appointment') {
      const appointment = getAppointmentById(toolInput.appointment_id);
      if (!appointment || appointment.phone_number !== phoneNumber) {
        return { success: false, message: 'Afspraak niet gevonden.' };
      }

      const newStart = new Date(toolInput.new_datetime);
      const newEnd = new Date(newStart.getTime() + appointment.estimated_minutes * 60 * 1000);

      if (appointment.calendar_event_id) {
        try {
          await updateCalendarEvent(appointment.calendar_event_id, {
            startTime: newStart.toISOString(),
            endTime: newEnd.toISOString(),
          });
          console.log(`[Calendar] Event rescheduled: ${appointment.calendar_event_id}`);
        } catch (err) {
          console.error('[Calendar] Failed to reschedule event:', err.message);
        }
      }

      updateAppointmentDatetime(
        toolInput.appointment_id,
        newStart.toISOString(),
        appointment.calendar_event_id
      );

      const formattedDate = newStart.toLocaleDateString('nl-NL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Amsterdam',
      });

      return { success: true, formattedDatetime: formattedDate };
    }

    return { error: `Onbekende tool: ${toolName}` };
  } catch (err) {
    console.error(`[Tool] Error in ${toolName}:`, err);
    return { error: err.message };
  }
}

// ─── Main message processor ────────────────────────────────────────────────────

async function processMessage({ phoneNumber, text, imageUrl, imageContentType, conversation }) {
  // Build user message content (text and/or image)
  let userContent;

  if (imageUrl) {
    try {
      const { base64, mediaType } = await downloadImageAsBase64(imageUrl);
      userContent = [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        },
        { type: 'text', text: text || 'Ik heb een foto gestuurd.' },
      ];
    } catch (err) {
      console.error('[Image] Download failed:', err.message);
      userContent = text || 'Ik probeerde een foto te sturen maar dat lukte helaas niet.';
    }
  } else {
    userContent = text || '...';
  }

  // Trim conversation to avoid unbounded growth.
  // Keep last 30 messages — always an even number to preserve turn structure.
  const trimmed = conversation.length > 30 ? conversation.slice(-30) : conversation;

  let messages = [
    ...trimmed,
    { role: 'user', content: userContent },
  ];

  // ── Agentic loop ────────────────────────────────────────────────────────────
  let finalResponse = null;

  while (true) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: buildSystemPrompt(),
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === 'tool_use') {
      // Collect all tool results before adding to messages
      const toolResults = [];

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await executeToolCall(block.name, block.input, phoneNumber);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }

      // Add assistant turn (with tool_use blocks) and the tool results
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
    } else {
      // end_turn or max_tokens — final answer
      messages.push({ role: 'assistant', content: response.content });
      finalResponse = response;
      break;
    }
  }

  const textBlock = finalResponse.content.find((b) => b.type === 'text');
  const reply = textBlock
    ? textBlock.text
    : 'Sorry, er is iets misgegaan. Probeer het opnieuw of bel ons direct.';

  return { reply, updatedConversation: messages };
}

module.exports = { processMessage };
