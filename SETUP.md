# Autogarage WhatsApp Chatbot — Installatiegids

Volledige AI-chatbot voor autogarages via WhatsApp. Werkt uitsluitend met Google Calendar en WhatsApp — geen CRM of planningsprogramma nodig.

---

## Wat doet de chatbot?

| Functie | Details |
|---|---|
| Vragen beantwoorden | Auto-onderhoud, prijzen, openingstijden, etc. |
| Afspraken inplannen | Verzamelt kenteken, merk/model, probleem en gewenste tijd |
| Herinnering sturen | 24 uur van tevoren via WhatsApp (+ e-mail fallback) |
| Annuleren / verplaatsen | Klant stuurt een bericht, bot regelt het |
| Foto-analyse | Beschadigingen, bandenslijtage, gebreken beoordelen |
| Prijsindicatie | Realistische schatting op basis van servicesoort |
| Upselling (subtiel) | Bijv. bij APK → kleine beurt voorstellen (1× per gesprek) |
| Google Calendar | Afspraken direct in de agenda met alle autogegevens |
| Bevestigingsmail | Klant én garage ontvangen een nette HTML-mail |

---

## Vereisten

- Node.js 18 of hoger
- Een **Twilio-account** (gratis sandbox beschikbaar)
- Een **Anthropic API-sleutel** (Claude)
- Een **Google-account** met Google Calendar
- Een **Gmail-adres** voor het versturen van e-mails (of een andere SMTP-server)
- Een publiek bereikbaar domein of **ngrok** voor lokaal testen

---

## Stap 1 — Repository klaarzetten

```bash
git clone <repo-url>
cd autogarage-whatsapp-chatbot
npm install
cp .env.example .env
```

---

## Stap 2 — Twilio instellen (WhatsApp)

### Optie A — Sandbox (gratis testen)

1. Maak een gratis account op [twilio.com](https://www.twilio.com)
2. Ga naar **Messaging → Try it out → Send a WhatsApp message**
3. Volg de instructies om je telefoon te koppelen aan de sandbox
4. Kopieer het sandbox-nummer (bijv. `whatsapp:+14155238886`) naar je `.env`

### Optie B — Eigen nummer (productie)

1. Koop een WhatsApp Business-nummer via Twilio
2. Stel het in onder **Messaging → Senders**
3. Gebruik dat nummer in `TWILIO_WHATSAPP_NUMBER`

### Webhook instellen

Zodra je server draait (zie Stap 5), stel je de webhook in:

- **URL:** `https://jouwdomein.nl/webhook/whatsapp`
- **Method:** `HTTP POST`
- In Twilio: **Messaging → Settings → WhatsApp Sandbox Settings** (of je nummer-instellingen)

---

## Stap 3 — Anthropic API-sleutel

1. Maak een account op [console.anthropic.com](https://console.anthropic.com)
2. Ga naar **API Keys → Create Key**
3. Zet de sleutel in `.env` als `ANTHROPIC_API_KEY`

---

## Stap 4 — Google Calendar instellen

### 4a — Google Cloud project + credentials

1. Ga naar [console.cloud.google.com](https://console.cloud.google.com)
2. Maak een nieuw project (bijv. "Garage Chatbot")
3. Ga naar **APIs & Services → Library**
4. Zoek naar **Google Calendar API** en klik **Enable**
5. Ga naar **APIs & Services → Credentials**
6. Klik **Create Credentials → OAuth client ID**
7. Kies **Desktop app** als applicatietype
8. Geef het een naam (bijv. "Garage Bot") en klik **Create**
9. Kopieer de **Client ID** en **Client Secret** naar je `.env`

### 4b — OAuth toestemmingsscherm (als je het project net hebt aangemaakt)

1. Ga naar **OAuth consent screen**
2. Kies **External** en klik **Create**
3. Vul een naam in (bijv. "Garage Bot") en een e-mailadres
4. Klik door tot het scherm opgeslagen is
5. Voeg onder **Test users** het Google-account toe dat de agenda heeft

### 4c — Refresh token ophalen (eenmalig)

```bash
node scripts/google-auth.js
```

- Volg de instructies in de terminal
- Kopieer de `GOOGLE_REFRESH_TOKEN` naar je `.env`

### 4d — Agenda-ID instellen

- Gebruik `primary` voor de hoofdagenda van het Google-account
- Of gebruik een specifieke agenda-ID (te vinden in Google Calendar → Agenda-instellingen)

---

## Stap 5 — E-mail instellen (Gmail)

1. Ga naar je Google-account → **Beveiliging**
2. Zet **2-stapsverificatie** aan (vereist voor App Passwords)
3. Ga naar **Beveiliging → App-wachtwoorden**
4. Maak een app-wachtwoord aan (kies "E-mail" en "Windows-computer" of "Overig")
5. Kopieer het 16-tekens wachtwoord naar `EMAIL_PASS` in je `.env`

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=jouwgarage@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx
EMAIL_FROM=jouwgarage@gmail.com
```

---

## Stap 6 — Server starten

### Lokaal (ontwikkelen / testen)

```bash
# Installeer ngrok als je dat nog niet hebt: https://ngrok.com
ngrok http 3000

# Kopieer de ngrok URL (bijv. https://abc123.ngrok.io)
# Stel deze in als webhook in Twilio:
# → https://abc123.ngrok.io/webhook/whatsapp

# Start de server
npm run dev
```

### Productie (op een VPS, bijv. DigitalOcean / Hetzner)

```bash
npm start
```

Gebruik **PM2** om de server automatisch te herstarten:

```bash
npm install -g pm2
pm2 start src/index.js --name garage-chatbot
pm2 startup       # automatisch starten na reboot
pm2 save
```

---

## Stap 7 — Testen

1. Stuur een WhatsApp-bericht naar het Twilio-nummer
2. De bot antwoordt binnen enkele seconden
3. Probeer:
   - "Ik wil een APK laten doen"
   - Stuur een foto van een band of schade
   - "Wat kost een kleine beurt?"
   - "Ik wil mijn afspraak verzetten"

---

## Bestandsstructuur

```
src/
├── index.js                  # Express server
├── config/
│   ├── index.js              # Omgevingsvariabelen
│   └── services.js           # Dienstencatalogus (prijzen + duur)
├── state/
│   ├── database.js           # SQLite initialisatie
│   └── sessions.js           # Sessiebeheer + afspraken DB
├── ai/
│   └── claude.js             # Claude API (chat + vision + tools)
├── calendar/
│   └── google.js             # Google Calendar API
├── email/
│   └── mailer.js             # Bevestiging- en herinneringsmail
├── reminders/
│   └── scheduler.js          # Dagelijkse cron: 24h-herinnering
└── whatsapp/
    └── handler.js            # Twilio webhook
scripts/
└── google-auth.js            # Eenmalig Google OAuth2 token ophalen
data/
└── garage.db                 # SQLite database (automatisch aangemaakt)
```

---

## Veelgestelde vragen

**De bot reageert niet.**
Controleer of de webhook correct is ingesteld in Twilio en of de server bereikbaar is. Bekijk de logs: `pm2 logs garage-chatbot`.

**Google Calendar werkt niet.**
Controleer of de Google Calendar API ingeschakeld is en of je refresh token geldig is. Draai opnieuw `node scripts/google-auth.js` als het token verlopen is.

**Mails komen niet aan.**
Controleer of je een App Password gebruikt (niet je gewone wachtwoord) en of 2FA aanstaat op het Gmail-account.

**Hoe reset ik een gesprek?**
Verwijder de sessie uit de database:
```bash
sqlite3 data/garage.db "DELETE FROM sessions WHERE phone_number='whatsapp:+31612345678';"
```

---

## Onderhoud & uitbreiding

- **Prijzen aanpassen:** `src/config/services.js`
- **Systeemprompt aanpassen:** `src/ai/claude.js` → `buildSystemPrompt()`
- **Openingstijden aanpassen:** `src/config/index.js` → `BUSINESS_HOURS`
- **Herinneringstijd aanpassen:** `src/reminders/scheduler.js` → cron expression `'0 9 * * *'`
