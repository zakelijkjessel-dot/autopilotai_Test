/**
 * One-time script to obtain a Google OAuth2 refresh token.
 * Run: node scripts/google-auth.js
 *
 * Prerequisites:
 *   1. Create OAuth2 credentials in Google Cloud Console
 *      (type: "Desktop app" or "Web application" with redirect URI below)
 *   2. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file
 *   3. Run this script and follow the prompts
 *   4. Copy the GOOGLE_REFRESH_TOKEN into your .env file
 */

require('dotenv').config();
const { google } = require('googleapis');
const readline = require('readline');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌  GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env\n');
  process.exit(1);
}

// Out-of-band redirect — no local server needed
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = auth.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // Force consent screen to always get a refresh_token
  scope: ['https://www.googleapis.com/auth/calendar'],
});

console.log('\n══════════════════════════════════════════════════');
console.log('  Google Calendar — Eénmalige autorisatie');
console.log('══════════════════════════════════════════════════\n');
console.log('Stap 1 — Open deze URL in je browser:\n');
console.log(authUrl);
console.log('\nStap 2 — Log in met het Google-account waarop de agenda staat.');
console.log('Stap 3 — Geef toegang en kopieer de autorisatiecode.\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Plak de autorisatiecode hier: ', async (code) => {
  rl.close();

  try {
    const { tokens } = await auth.getToken(code.trim());

    if (!tokens.refresh_token) {
      console.error(
        '\n⚠️  Geen refresh_token ontvangen. Zorg dat je de app-toegang eerst intrekt via\n' +
          '   https://myaccount.google.com/permissions en probeer opnieuw.\n'
      );
      process.exit(1);
    }

    console.log('\n✅  Succes! Voeg dit toe aan je .env bestand:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    console.log('══════════════════════════════════════════════════\n');
  } catch (err) {
    console.error('\n❌  Fout bij ophalen token:', err.message, '\n');
    process.exit(1);
  }
});
