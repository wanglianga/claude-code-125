// 数据库初始化脚本：容器/本地启动时执行
// 1. 等待 MySQL 就绪  2. 执行 schema.sql  3. 空库时执行 seed.sql（密码哈希动态生成）
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const DB = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'uniform',
  multipleStatements: false,
};

// bcrypt('123456') 兜底哈希（bcryptjs 不可用时使用，盐值固定不影响校验）
const FALLBACK_HASH = '$2a$10$w3B.Jf8deJdgbAFckUoEHeAhU.KG.x84ipvOUT5EctnzBiElPgJmS';

function loadSql(file) {
  return fs
    .readFileSync(path.join(__dirname, '..', 'src', 'lib', file), 'utf8')
    .split(/;\s*[\r\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function waitForDb(retries = 60) {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await mysql.createConnection(DB);
      await conn.ping();
      return conn;
    } catch (e) {
      console.log(`[init-db] 等待数据库就绪... (${i + 1}/${retries}) ${e.code || e.message}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error('数据库连接失败，超过最大重试次数');
}

async function main() {
  const conn = await waitForDb();
  console.log('[init-db] 数据库已连接');

  for (const stmt of loadSql('schema.sql')) {
    await conn.query(stmt);
  }
  console.log('[init-db] 表结构已就绪');

  const [rows] = await conn.query('SELECT COUNT(*) AS c FROM users');
  if (rows[0].c === 0) {
    let hash = FALLBACK_HASH;
    try {
      const bcrypt = require('bcryptjs');
      hash = bcrypt.hashSync('123456', 10);
    } catch (e) {
      console.log('[init-db] bcryptjs 不可用，使用内置哈希');
    }
    const seed = loadSql('seed.sql').map((s) => s.split('__PWD_HASH__').join(hash));
    for (const stmt of seed) {
      await conn.query(stmt);
    }
    console.log('[init-db] 种子数据已写入（测试账号密码均为 123456）');
  } else {
    console.log('[init-db] 已有数据，跳过种子数据');
  }

  await conn.end();
  console.log('[init-db] 完成');
}

main().catch((e) => {
  console.error('[init-db] 失败:', e);
  process.exit(1);
});
