# 🗓️ Google Calendar koppelen

Hiermee komt elke afspraak die de bot maakt automatisch in **jullie Google-agenda**
te staan (en verdwijnt/verschuift weer bij annuleren/verzetten). De bot houdt zijn
eigen agenda voor de beschikbaarheid; Google krijgt een nette kopie.

We gebruiken een **service-account**: een soort robot-account van Google waarmee de
bot zonder inlogscherm in de agenda mag schrijven. Reken op ±15 minuten.

> Werkt de koppeling (nog) niet of laat je de velden leeg? Geen probleem — de bot
> draait gewoon door met zijn interne agenda.

---

## Stap 1 — Project + Calendar API aanzetten

1. Ga naar **console.cloud.google.com** en log in met je Google-account.
2. Maak bovenin een **nieuw project** aan (naam bv. "Garage Bot") en selecteer het.
3. Zoek bovenin naar **"Google Calendar API"** → open 'm → klik **Enable**.

## Stap 2 — Service-account + sleutel maken

> ℹ️ Kom je een scherm **"Google Auth Platform"** of **"OAuth consent screen"**
> tegen (met Internal/External)? Dat heb je **niet** nodig — dat is voor
> "Inloggen met Google". Sla het over en ga direct naar Service Accounts.

4. Typ bovenin in de **zoekbalk** het woord **"Service accounts"** en open
   **Service Accounts** (onder IAM & Admin).
5. Klik **+ Create service account** → geef een naam (bv. "garage-bot") →
   **Create and continue** → de rechten mag je overslaan → **Done**.
6. Klik op de nieuwe service-account → tabblad **Keys** → **Add key → Create new key → JSON** → **Create**.
   Er wordt een **JSON-bestand** gedownload. Open dat; je hebt hieruit twee dingen nodig:
   - `client_email` (iets als `garage-bot@...gserviceaccount.com`)
   - `private_key` (begint met `-----BEGIN PRIVATE KEY-----`)

## Stap 3 — Je agenda delen met de robot

7. Ga naar **calendar.google.com** → bij de agenda die je wilt gebruiken: **⋮ → Settings and sharing**.
8. Onder **Share with specific people** → **Add people** → plak de `client_email` uit stap 6 →
   rechten op **"Make changes to events"** → **Send**.
9. Scroll naar **Integrate calendar** → kopieer de **Calendar ID** (vaak je e-mailadres,
   of een lange `...@group.calendar.google.com`).

## Stap 4 — In Railway invullen

Zet in **Railway → Variables** deze drie:

| Variabele | Waarde |
|---|---|
| `GOOGLE_CLIENT_EMAIL` | de `client_email` uit het JSON-bestand |
| `GOOGLE_PRIVATE_KEY` | de héle `private_key` uit het JSON-bestand (inclusief de `\n`-stukken) |
| `GOOGLE_CALENDAR_ID` | de Calendar ID uit stap 9 |

Railway bouwt opnieuw. In de logs zie je dan:
`✅ Google Calendar: afspraken worden gespiegeld naar de gedeelde agenda.`

## Klaar — testen

Laat de bot een testafspraak maken → hij verschijnt binnen enkele seconden in je
Google-agenda, met klant, voertuig en referentie in de omschrijving. Annuleer 'm →
hij verdwijnt weer.

> 🔒 De sleutel (`private_key`) is geheim — alleen in Railway invullen, nooit in de
> chat of in de code.
