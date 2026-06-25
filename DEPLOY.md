# 📱 De bot online zetten op echte WhatsApp

Deze gids zet de garage-bot op een vast internetadres en koppelt 'm aan WhatsApp
via **Twilio**. Je hoeft hiervoor niets te programmeren — alleen klikken en
invullen. Reken op ±20–30 minuten.

We doen het in 3 delen:

1. **Twilio** — de brug tussen WhatsApp en je bot (gratis sandbox om te testen)
2. **Hosting** — je bot op een vast adres zetten (Railway, aanrader)
3. **Koppelen & testen** — alles aan elkaar knopen en chatten vanaf je telefoon

> 🔐 **Veilig met sleutels:** alle geheime sleutels vul je straks in op de
> websites van Twilio en Railway — **nooit in een chat of in de code.** Daar
> worden ze versleuteld bewaard.

---

## Deel 1 — Twilio + WhatsApp Sandbox

De **sandbox** is Twilio's gratis testomgeving voor WhatsApp. Geen zakelijke
verificatie nodig; je koppelt je eigen telefoon met één berichtje.

1. Maak een gratis account op **https://www.twilio.com/try-twilio**.
2. Ga in de console naar **Messaging → Try it out → Send a WhatsApp message**.
3. Je ziet nu de **Sandbox**: een nummer (meestal `+1 415 523 8886`) en een
   join-code zoals `join lucky-tiger`.
4. Open **WhatsApp op je telefoon** en stuur dat hele bericht
   (`join lucky-tiger`) naar dat sandbox-nummer. Je krijgt een bevestiging
   terug → je telefoon is nu gekoppeld. ✅
5. Noteer voor straks deze 3 gegevens:
   - **Account SID** en **Auth Token** — staan op het dashboard onder
     *Account Info* (klik "Show" om de token te zien).
   - Het **sandbox-nummer** (bv. `+14155238886`).

> De webhook-URL vullen we in **Deel 3** in, als je hosting-adres bekend is.

---

## Deel 2 — Hosting op Railway (aanrader)

Railway draait je bot 24/7 op een vast adres en leest de code direct uit GitHub.

1. Ga naar **https://railway.app** en meld je aan **met GitHub** (zo kan Railway
   bij je repository).
2. Klik **New Project → Deploy from GitHub repo** en kies de repository
   **`autopilotai_test`**. Geef Railway toegang als daarom gevraagd wordt.
3. Railway begint automatisch te bouwen. **Stel eerst de juiste branch in:**
   open de service → **Settings → Source** → zet *Branch* op
   `claude/serene-archimedes-doeyn4` (of merge die branch eerst naar `main`).
4. Ga naar het tabblad **Variables** en voeg deze toe (knop *New Variable*):

   | Variabele | Waarde |
   |---|---|
   | `ANTHROPIC_API_KEY` | je **nieuwe** Claude-sleutel (zie ⚠️ hieronder) |
   | `CHANNEL` | `twilio` |
   | `TWILIO_ACCOUNT_SID` | je Account SID uit Deel 1 |
   | `TWILIO_AUTH_TOKEN` | je Auth Token uit Deel 1 |
   | `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` (jouw sandbox-nummer) |
   | `TZ` | `Europe/Amsterdam` |

   > `PORT` hoef je niet te zetten — dat regelt Railway zelf.

5. Maak het bot-adres openbaar: **Settings → Networking → Generate Domain**.
   Je krijgt een adres als `https://autopilotai-test-production.up.railway.app`.
   **Dit adres heb je in Deel 3 nodig.**
6. Railway bouwt opnieuw na het instellen van de variabelen. Open je nieuwe
   adres in de browser; je hoort te zien:
   *"Garage WhatsApp-bot draait. Webhook: POST /whatsapp"*. 🎉

> ⚠️ **Vervang eerst je Claude-sleutel!** De sleutel die je eerder in de chat
> plakte, geldt als "op straat". Maak op console.anthropic.com een nieuwe aan
> (en zet de oude op *Disable*), en gebruik die nieuwe hier bij Railway.

---

## Deel 3 — Koppelen & testen

1. Ga terug naar Twilio: **Messaging → Try it out → Send a WhatsApp message →
   Sandbox settings**.
2. Bij **"When a message comes in"** vul je in:
   `https://JOUW-RAILWAY-ADRES/whatsapp` — methode **POST**. Klik **Save**.
   (Let op het stukje `/whatsapp` achteraan!)
3. Pak je telefoon en stuur een WhatsApp naar het sandbox-nummer, bijvoorbeeld:
   *"Hoi, kan ik volgende week een APK inplannen?"*
4. De bot antwoordt — nu écht op WhatsApp. 🚗💬

---

## Goed om te weten

- **Kosten:** Railway en Twilio hebben allebei gratis startkrediet. Daarna is
  Railway ±€ 5/mnd; de Twilio-sandbox blijft gratis om te testen.
- **Afspraken-opslag:** afspraken staan nu in een bestand op de server. Bij een
  nieuwe deploy kan dat resetten. Prima om te testen — voor "in productie" met
  echte klanten zetten we er later een echte database onder.
- **Eigen WhatsApp-nummer:** de sandbox is voor testen. Wil je je éigen
  bedrijfsnummer gebruiken, dan vraagt Twilio een eenmalige WhatsApp Business-
  goedkeuring aan. Dat regelen we als je tevreden bent over de bot.
- **Beveiliging:** voor echt gebruik voegen we nog Twilio-handtekening­controle
  toe (zodat alleen Twilio je webhook kan aanroepen). Vraag me ernaar.

Vastgelopen bij een stap? Zeg welk deel en wat je ziet, dan help ik je verder.
