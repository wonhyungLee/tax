let schemaReady = false;

const REQUIRED_POST_COLUMNS = ['id', 'title', 'content', 'created_at'];
const REQUIRED_COMMENT_COLUMNS = ['id', 'post_id', 'content', 'created_at'];
const REQUIRED_INTEREST_COLUMNS = ['category'];

const POST_ADD_COLUMNS = [
  { name: 'updated_at', sql: 'updated_at INTEGER NOT NULL DEFAULT 0' },
  { name: 'password_hash', sql: "password_hash TEXT NOT NULL DEFAULT ''" },
];

const COMMENT_ADD_COLUMNS = [
  { name: 'updated_at', sql: 'updated_at INTEGER NOT NULL DEFAULT 0' },
  { name: 'password_hash', sql: "password_hash TEXT NOT NULL DEFAULT ''" },
];

const INTEREST_ADD_COLUMNS = [
  { name: 'count', sql: 'count INTEGER NOT NULL DEFAULT 0' },
  { name: 'updated_at', sql: 'updated_at INTEGER NOT NULL DEFAULT 0' },
];

const ensureColumns = async (db, table, requiredColumns, addColumns) => {
  const info = await db.prepare(`PRAGMA table_info(${table})`).all();
  const columns = new Set((info.results || []).map((row) => row.name));

  if (!columns.size) {
    throw new Error(`${table} schema is missing`);
  }

  const missingRequired = requiredColumns.filter((col) => !columns.has(col));
  if (missingRequired.length) {
    throw new Error(`${table} schema is outdated: ${missingRequired.join(', ')}`);
  }

  for (const col of addColumns) {
    if (!columns.has(col.name)) {
      await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${col.sql}`).run();
    }
  }
};

export const ensureBoardSchema = async (db) => {
  if (schemaReady) return;

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        password_hash TEXT NOT NULL
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        password_hash TEXT NOT NULL,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS ad_interest (
        category TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`
    )
    .run();

  await ensureColumns(db, 'posts', REQUIRED_POST_COLUMNS, POST_ADD_COLUMNS);
  await ensureColumns(db, 'comments', REQUIRED_COMMENT_COLUMNS, COMMENT_ADD_COLUMNS);
  await ensureColumns(db, 'ad_interest', REQUIRED_INTEREST_COLUMNS, INTEREST_ADD_COLUMNS);

  await db.prepare('CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)').run();
  await db
    .prepare('CREATE INDEX IF NOT EXISTS idx_comments_post_id_created_at ON comments(post_id, created_at ASC)')
    .run();

  schemaReady = true;
};
