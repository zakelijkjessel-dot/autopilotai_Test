# WhatsApp-chatbot voor autogarages 🚗💬

Een slimme WhatsApp-assistent voor autogarages, aangedreven door Claude. De bot
beantwoordt vragen 24/7, plant afspraken in, stuurt herinneringen, doet een
auto-intake, geeft een richtprijs, beoordeelt foto's en stuurt een nette
e-mailbevestiging.

> Status: werkende basis. Lokaal testbaar via een **simulator**; klaar om aan
> **Twilio WhatsApp** te koppelen. Agenda en e-mail zijn pluggable adapters.

## Wat de bot kan

| # | Functie | Hoe het werkt |
|---|---------|---------------|
| 01 | **Vragen beantwoorden** | Gesprek-engine met kennis van openingstijden, diensten en mogelijkheden (24/7). |
| 02 | **Afspraken inplannen** | Zoekt vrije momenten in de agenda en zet de afspraak klaar. |
| 03 | **Herinneringen sturen** | Vriendelijke WhatsApp-herinnering ±24 u vooraf — minder no-shows. |
| 04 | **Annuleren & verplaatsen** | Klant verzet/annuleert zelf via de chat; de agenda werkt direct bij. |
| 05 | **Slimme auto-intake** | Vraagt merk, type, kenteken en klacht uit en schat de werkplaatstijd. |
| 06 | **Prijsindicatie** | Eerlijke richtprijs (van–tot) op basis van onderdelen + arbeid. |
| 07 | **Foto-analyse** | Beoordeelt foto's van schade of versleten banden (Claude vision). |
| 08 | **Slimme upselling** | Biedt bij een APK netjes een kleine beurt aan — nooit opdringerig. |
| 09 | **Bevestiging per mail** | Nette e-mailbevestiging met alle details na het boeken. |

## Snel starten

```bash
# 1. Dependencies installeren
npm install

# 2. Instellingen kopiëren en je Claude-sleutel invullen
cp .env.example .env
#   -> zet ANTHROPIC_API_KEY in .env (https://console.anthropic.com)

# 3. De bot starten in de simulator (lokaal testen, geen WhatsApp nodig)
npm run chat
```

Je krijgt een chat in de terminal. Probeer bijvoorbeeld:

- `Wat zijn jullie openingstijden?`
- `Ik wil een APK afspraak maken voor volgende week`
- `Wat kost het vervangen van de remmen ongeveer?`
- `/foto ./band.jpg is deze band nog goed?` — stuur een foto mee voor analyse

Commando's in de simulator: `/foto <pad> [tekst]`, `/help`, `/quit`.

## Echte WhatsApp via Twilio

1. Maak een [Twilio-account](https://www.twilio.com/) en activeer de **WhatsApp-sandbox**.
2. Vul in `.env` in: `CHANNEL=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
   `TWILIO_WHATSAPP_FROM` (bv. `whatsapp:+14155238886`).
3. Start de bot: `npm run start`. Er draait nu een webhook op `http://localhost:3000/whatsapp`.
4. Maak die bereikbaar (bv. met [ngrok](https://ngrok.com/): `ngrok http 3000`) en zet
   de https-URL als **"When a message comes in"** in de Twilio WhatsApp-sandbox.
5. Stuur een WhatsApp naar je sandboxnummer — de bot antwoordt.

## Projectstructuur

```
src/
├── index.ts              Startpunt: koppelt alles en kiest het kanaal
├── config/garage.ts      Garage-instellingen: openingstijden, diensten, tarieven
├── domain/               Datatypes + prijs- en werkplaatstijd-logica
├── store/                Opslag van afspraken en gesprekken (JSON)
├── calendar/             Agenda-interface + in-memory slot-zoeker
├── email/                E-mail-interface + console-implementatie
├── brain/                Het "brein": systeemprompt, tools en de Claude-loop
├── channel/              Kanalen: simulator + Twilio (zelfde interface)
└── scheduler/            Herinneringen (cron)
```

De bot is opgebouwd uit **vervangbare adapters** (`Channel`, `Calendar`, `Email`).
Daardoor kun je onderdelen wisselen zonder de logica te verbouwen.

## Je eigen garage instellen

Pas `src/config/garage.ts` aan: naam, adres, telefoon, e-mail, openingstijden,
uurtarief en de lijst met diensten (met richtprijzen en standaardtijden). De bot
gebruikt deze gegevens automatisch in antwoorden, prijzen en de agenda.

## Hoe het werkt (kort)

Elk binnenkomend bericht gaat naar het **brein** (`src/brain/brain.ts`). Dat
stuurt de gespreksgeschiedenis naar Claude (`claude-opus-4-8`) samen met een set
**tools**: beschikbaarheid checken, prijs schatten, boeken, zoeken, annuleren en
verzetten. Claude beslist welke tools nodig zijn, de bot voert ze uit en stuurt
het resultaat terug tot er een net antwoord voor de klant klaarstaat. Foto's
worden meegestuurd als beeld, zodat Claude ze direct kan beoordelen.

## Volgende stappen (uitbreiden)

- **Google Calendar**-adapter i.p.v. de in-memory agenda (zelfde `Calendar`-interface).
- **Echte e-mail** via Resend/SendGrid/SMTP (zelfde `Email`-interface).
- **Meta WhatsApp Cloud API** als extra kanaal naast Twilio.
- Database (PostgreSQL) achter de huidige `Store`-methodes voor productie.

## Scripts

| Script | Doel |
|--------|------|
| `npm run chat` / `npm start` | Start de bot (simulator of Twilio, afhankelijk van `CHANNEL`). |
| `npm run dev` | Start met automatische herstart bij wijzigingen. |
| `npm run typecheck` | Controleer de types zonder te bouwen. |
| `npm run build` | Compileer naar `dist/`. |
