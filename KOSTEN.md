# 💰 Wat heb je nodig om de bot te laten werken?

Een eerlijk, actueel overzicht van de **programma's/diensten** die deze bot
gebruikt, en wat het ongeveer kost. Belangrijk: deze bot is **bewust lean**
gebouwd — veel diensten uit rondslingerende "complete stack"-lijstjes heb je
hier **niet** nodig.

> Basis (uit de code, `package.json`): Node.js + Claude + Express (webhook) +
> nodemailer (e-mail) + node-cron (herinneringen). Meer niet.

---

## In één oogopslag

| | Dienst | Nodig? |
|---|---|---|
| 🤖 | **Anthropic (Claude)** — het brein | ✅ **Vereist** |
| 📱 | **WhatsApp: Twilio *óf* Meta Cloud API** | ✅ **Vereist** (kies er één) |
| ☁️ | **Hosting (Railway)** | ✅ **Vereist** |
| 📧 | Gmail / SMTP — echte bevestigingsmails | ➖ Optioneel (gratis) |
| 🗄️ | Database | ➖ Later (nu een gratis bestand) |
| ❌ | Vercel, Supabase, Google Calendar, RDW, Resend/Postmark | 🚫 **Niet nodig** |

---

## 1. Wat je écht nodig hebt (3)

### 🤖 Anthropic (Claude) — het brein
Laat de bot begrijpen en antwoorden. **Pay-per-use**: je betaalt per gesprek,
grofweg centen. Sleutel via console.anthropic.com. Zet een *spend limit* voor
je gemoedsrust.

### 📱 WhatsApp — Twilio *of* Meta Cloud API (kies één)
De brug tussen WhatsApp en de bot. We hebben **beide** ingebouwd; in `.env`
kies je met `CHANNEL=twilio` of `CHANNEL=whatsapp` welke actief is. Zie de
vergelijking in hoofdstuk 4.

### ☁️ Hosting — Railway
De bot moet 24/7 draaien op een vast, openbaar adres (WhatsApp moet 'm kunnen
bereiken). **Railway ≈ $5/maand.** Alternatieven: Render, Fly.io.
👉 Zie `DEPLOY.md` voor de stappen.

---

## 2. Optioneel (bot werkt ook zonder)

- **📧 Gmail / SMTP — gratis.** Voor échte bevestigingsmails. Zonder deze
  worden mails alleen gelogd (niet verstuurd). Werkt met een Gmail
  *app-wachtwoord*. Zie `DEPLOY.md`.
- **🗄️ Database — later.** Nu bewaart de bot afspraken in een bestand (gratis,
  ingebouwd). Pas een echte database (bijv. Postgres/Supabase) overwegen bij
  veel garages of als data nooit verloren mag gaan.

---

## 3. Niet nodig voor deze bot

Kom je deze tegen in een "wat heb je nodig"-lijstje? Voor **onze** opzet kun je
ze overslaan:

| Dienst | Waarom niet |
|---|---|
| **Vercel** | Dat hoort bij een Next.js-app; wij draaien op een gewone Node-server (Railway). |
| **Supabase** | We gebruiken nu een simpel bestand. Pas nodig bij flinke groei. |
| **Google Calendar API** | De bot heeft een **interne agenda**. Koppelen kan later, hoeft niet. |
| **RDW-kenteken-API** | Niet gebouwd. Leuk voor later (auto-info via kenteken), niet vereist. |
| **Resend / Postmark** | Overbodig — je gewone **Gmail** volstaat voor bevestigingen. |

---

## 4. Twilio vs. Meta WhatsApp — welke kiezen?

Twee manieren voor hetzelfde. Je gebruikt er **één**.

| | **Twilio** | **Meta Cloud API** |
|---|---|---|
| Snel testen | ✅ Sandbox in minuten, geen verificatie | ➖ Meer setup vooraf |
| Setup voor productie | Eigen nummer via Twilio | Meta Business + verificatie (KvK e.d.) |
| Kosten per bericht | Meta-tarief **+ Twilio-opslag** | Alleen Meta-tarief (goedkoper) |
| Waarvoor gebouwd | `CHANNEL=twilio` | `CHANNEL=whatsapp` (de nieuwe webhook) |

**Aanbeveling voor jou:**
1. **Nu testen → Twilio-sandbox.** Snelste weg om de bot op je eigen telefoon
   te zien werken, zonder zakelijke verificatie.
2. **Straks echt live → Meta Cloud API.** Goedkoper per bericht op termijn.
   Omschakelen is later één regel: `CHANNEL=whatsapp`.

---

## 5. Wat kost het echt?

| Fase | Realistische kosten |
|---|---|
| **1 garage, testen** | Twilio-sandbox gratis · Claude centen · Railway ~$5 · Gmail gratis → **~$5–15/maand** |
| **1 garage, live** | + WhatsApp-berichten (klantreacties binnen 24u gratis; herinneringen ~€0,05/stuk) → **~$15–40/maand** |
| **Veel garages, op schaal** | Dít is het "worst-case" uit de grote tabellen: honderden–duizenden berichten, veel foto's → kan naar $100–300+ |

> De hoge bedragen die je online ziet horen bij het **schaal-scenario** (bijv.
> 20 garages, duizenden gesprekken). Zo begin je niet. Kosten schalen mee met
> gebruik.

*Tarieven zijn schattingen en kunnen wijzigen — check de actuele prijzen bij
Anthropic, Twilio/Meta en Railway.*

---

## 6. Minimaal om live te gaan — checklist

- [ ] **Claude API-sleutel** (console.anthropic.com) + spend limit
- [ ] **Eén WhatsApp-kanaal** — begin met de **Twilio-sandbox** om te testen
- [ ] **Railway-hosting** (~$5/mnd) — zie `DEPLOY.md`
- [ ] *(optioneel)* **Gmail app-wachtwoord** voor echte bevestigingsmails

Dat is alles. 🚗💬
