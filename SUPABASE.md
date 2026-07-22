# 🗄️ Supabase koppelen (database-opslag)

Hiermee bewaart de bot afspraken en gesprekken in **jouw Supabase-database** in
plaats van een bestand — zodat niets verloren gaat bij een herstart of nieuwe
deploy. Reken op ±5 minuten.

> Laat je de Supabase-velden leeg? Dan gebruikt de bot gewoon `data/db.json`.
> Alles blijft werken; het is puur een upgrade voor duurzame opslag.

---

## Stap 1 — De tabel aanmaken (eenmalig)

1. Open je project op **supabase.com** → in het linkermenu **SQL Editor** → **New query**.
2. Plak dit en klik **Run**:

```sql
create table if not exists garage_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

-- Alleen de bot (service_role) mag erbij; niemand anders.
alter table garage_state enable row level security;
```

Je hoort "Success. No rows returned" te zien. ✅

## Stap 2 — De twee waardes ophalen

Ga naar **Project Settings** (tandwiel) → **API**. Je hebt precies twee dingen nodig:

| Wat | Waar |
|---|---|
| **Project URL** | bovenaan, iets als `https://xxxxxxxx.supabase.co` |
| **service_role key** | onder *Project API keys* → rij **`service_role`** → klik **Reveal** |

> 🔒 De **service_role**-sleutel geeft volledige toegang tot je database — behandel
> 'm als een hoofdwachtwoord. Alleen invullen in Railway (of je `.env`), **nooit in
> een chat of in git.**

## Stap 3 — In Railway invullen

Zet in **Railway → Variables**:

| Variabele | Waarde |
|---|---|
| `SUPABASE_URL` | de Project URL uit stap 2 |
| `SUPABASE_SERVICE_ROLE_KEY` | de `service_role`-sleutel uit stap 2 |

Railway bouwt opnieuw. In de logs zie je dan:
`✅ Opslag: Supabase (afspraken blijven bewaard na een herstart/deploy).`

---

## Klaar

Vanaf nu schrijft de bot alles naar de tabel `garage_state` (één rij met de
volledige staat als JSON). Je kunt die rij bekijken in Supabase onder
**Table Editor → garage_state**.

> Wil je later afspraken als losse, doorzoekbare rijen (voor rapportages)? Dat kan
> als uitbreiding — vraag me er dan naar.
