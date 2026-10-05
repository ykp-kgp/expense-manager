import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { eq } from 'drizzle-orm';
import * as schema from './schema';
import { PREDEFINED_CATEGORIES, PREDEFINED_PAYMENT_METHODS } from './seeds';

const DB_NAME = 'expense_manager.db';
const SCHEMA_VERSION = 1;

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: SQLite.SQLiteDatabase | null = null;

export function getRawDb(): SQLite.SQLiteDatabase {
  if (!_sqlite) throw new Error('DB not initialized. Call initDb() first.');
  return _sqlite;
}

export function getDb() {
  if (!_db) throw new Error('DB not initialized. Call initDb() first.');
  return _db;
}

export async function initDb() {
  if (_db) return _db;
  const sqlite = await SQLite.openDatabaseAsync(DB_NAME, {
    enableChangeListener: true,
  });
  _sqlite = sqlite;
  await sqlite.execAsync('PRAGMA journal_mode = WAL;');
  await sqlite.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(sqlite);
  _db = drizzle(sqlite, { schema });
  await seedIfNeeded();
  return _db;
}

async function runMigrations(sqlite: SQLite.SQLiteDatabase) {
  await sqlite.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      id INTEGER PRIMARY KEY,
      version INTEGER NOT NULL
    );
  `);
  const row = await sqlite.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_meta WHERE id = 1'
  );
  const currentVersion = row?.version ?? 0;

  if (currentVersion < 1) {
    await sqlite.execAsync(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS payment_methods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        icon TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        category_id INTEGER NOT NULL REFERENCES categories(id),
        payment_method_id INTEGER NOT NULL REFERENCES payment_methods(id),
        date TEXT NOT NULL,
        note TEXT,
        attachment_path TEXT,
        recurring_id INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
      CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);

      CREATE TABLE IF NOT EXISTS recurring_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        category_id INTEGER NOT NULL REFERENCES categories(id),
        payment_method_id INTEGER NOT NULL REFERENCES payment_methods(id),
        frequency TEXT NOT NULL,
        interval_count INTEGER NOT NULL DEFAULT 1,
        start_date TEXT NOT NULL,
        end_date TEXT,
        next_run_date TEXT NOT NULL,
        note TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER REFERENCES categories(id),
        month TEXT NOT NULL,
        amount REAL NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_unique
        ON budgets(IFNULL(category_id, -1), month);

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  }

  await sqlite.runAsync(
    'INSERT OR REPLACE INTO schema_meta (id, version) VALUES (1, ?)',
    [SCHEMA_VERSION]
  );
}

async function seedIfNeeded() {
  const db = getDb();
  const existing = await db.select().from(schema.categories).limit(1);
  if (existing.length > 0) return;

  await db.insert(schema.categories).values(
    PREDEFINED_CATEGORIES.map((c, i) => ({
      name: c.name,
      icon: c.icon,
      color: c.color,
      sortOrder: i,
    }))
  );

  await db.insert(schema.paymentMethods).values(
    PREDEFINED_PAYMENT_METHODS.map((p, i) => ({
      name: p.name,
      icon: p.icon,
      sortOrder: i,
    }))
  );
}

export async function getSetting(key: string): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, key))
    .limit(1);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string | null) {
  const sqlite = getRawDb();
  await sqlite.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

export async function setSettingsBatch(entries: Record<string, string | null>) {
  const sqlite = getRawDb();
  const keys = Object.keys(entries);
  if (keys.length === 0) return;
  await sqlite.withTransactionAsync(async () => {
    for (const key of keys) {
      await sqlite.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, entries[key]]
      );
    }
  });
}

export { schema };
