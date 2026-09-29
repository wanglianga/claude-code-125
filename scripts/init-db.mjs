// 初始化数据库：创建库并执行 db/schema.sql
import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const cfg = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
};
const dbName = process.env.DB_NAME || 'uniform';

async function waitDb(conn) {
  for (let i = 0; i < 30; i++) {
    try { await conn.query('SELECT 1'); return; } catch { await new Promise(r => setTimeout(r, 1000)); }
  }
}

const conn = await mysql.createConnection(cfg);
await waitDb(conn);
await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
await conn.query(`USE \`${dbName}\``);
const sql = await readFile(path.join(root, 'db', 'schema.sql'), 'utf8');
await conn.query(sql);
console.log(`[init-db] schema applied to database "${dbName}"`);
await conn.end();
