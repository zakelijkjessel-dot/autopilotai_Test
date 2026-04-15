const twilio = require('twilio');
const config = require('../config');
const { processMessage } = require('../ai/claude');
const { getSession, saveSession } = require('../state/sessions');

// ─── Twilio client ─────────────────────────────────────────────────────────────

function getTwilioClient() {
  return twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
}

// ─── Send a WhatsApp message ───────────────────────────────────────────────────

async function sendWhatsAppMessage(to, body) {
  const client = getTwilioClient();
  await client.messages.create({
    body,
    from: config.TWILIO_WHATSAPP_NUMBER,
    to,
  });
}

// ─── Split long messages ───────────────────────────────────────────────────────
// WhatsApp messages are capped at 4096 chars by Twilio; stay safely under.

const MAX_MSG_LENGTH = 1500;

function splitMessage(text) {
  if (text.length <= MAX_MSG_LENGTH) return [text];

  const parts = [];
  let remaining = text;

  while (remaining.length > MAX_MSG_LENGTH) {
    // Try to split at a paragraph or sentence boundary
    let splitAt = remaining.lastIndexOf('\n\n', MAX_MSG_LENGTH);
    if (splitAt < MAX_MSG_LENGTH * 0.5) splitAt = remaining.lastIndexOf('\n', MAX_MSG_LENGTH);
    if (splitAt < MAX_MSG_LENGTH * 0.5) splitAt = remaining.lastIndexOf('. ', MAX_MSG_LENGTH);
    if (splitAt <= 0) splitAt = MAX_MSG_LENGTH;

    parts.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) parts.push(remaining);
  return parts;
}

// ─── Main webhook handler ──────────────────────────────────────────────────────

async function handleIncomingMessage(req, res) {
  // Respond immediately so Twilio doesn't retry
  res.status(200).send('');

  const {
    From: from,
    Body: body,
    NumMedia,
    MediaUrl0: mediaUrl,
    MediaContentType0: mediaContentType,
  } = req.body;

  if (!from) {
    console.error('[Webhook] Missing From field');
    return;
  }

  const hasMedia = NumMedia && parseInt(NumMedia, 10) > 0 && mediaUrl;
  console.log(`[Webhook] Message from ${from}: ${body || '(no text)'}${hasMedia ? ' + media' : ''}`);

  try {
    const session = getSession(from);

    const result = await processMessage({
      phoneNumber: from,
      text: body || '',
      imageUrl: hasMedia ? mediaUrl : null,
      imageContentType: hasMedia ? mediaContentType : null,
      conversation: session.conversation,
    });

    // Persist updated conversation
    saveSession(from, result.updatedConversation, session.upsellOffered);

    // Send reply (possibly in multiple parts)
    const parts = splitMessage(result.reply);
    for (const part of parts) {
      await sendWhatsAppMessage(from, part);
    }
  } catch (err) {
    console.error('[Webhook] Error processing message:', err);

    try {
      await sendWhatsAppMessage(
        from,
        'Sorry, er is iets misgegaan aan onze kant. ' +
          `Probeer het opnieuw of bel ons op ${config.GARAGE_PHONE || 'ons telefoonnummer'}.`
      );
    } catch (sendErr) {
      console.error('[Webhook] Could not send error message:', sendErr.message);
    }
  }
}

module.exports = { handleIncomingMessage };
