const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'garage.db');

let db;

function initDatabase() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      phone_number   TEXT PRIMARY KEY,
      conversation   TEXT NOT NULL DEFAULT '[]',
      upsell_offered INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number          TEXT    NOT NULL,
      customer_name         TEXT,
      customer_email        TEXT,
      car_license           TEXT,
      car_make              TEXT,
      car_model             TEXT,
      car_year              INTEGER,
      service_type          TEXT,
      description           TEXT,
      estimated_minutes     INTEGER,
      estimated_price_min   INTEGER,
      estimated_price_max   INTEGER,
      appointment_datetime  TEXT,
      calendar_event_id     TEXT,
      status                TEXT NOT NULL DEFAULT 'scheduled',
      reminder_sent         INTEGER NOT NULL DEFAULT 0,
      created_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  console.log(`[DB] Initialized at ${DB_PATH}`);
  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialized — call initDatabase() first');
  return db;
}

module.exports = { initDatabase, getDb };
