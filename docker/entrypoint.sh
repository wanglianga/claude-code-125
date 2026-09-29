#!/bin/bash
set -e

echo "[entrypoint] waiting for MySQL ${DB_HOST}:${DB_PORT} ..."
until node -e "
const net=require('net');
const s=net.connect({host:process.env.DB_HOST||'mysql',port:Number(process.env.DB_PORT||3306)},()=>{s.end();process.exit(0)});
s.on('error',()=>process.exit(1));
setTimeout(()=>process.exit(1),2000);
" 2>/dev/null; do
  sleep 2
done
echo "[entrypoint] MySQL is up."

# 初始化表结构（幂等）
node scripts/init-db.mjs

# SEED_DB=1 时，仅当 users 表为空才写入演示数据（重启不会清空已有数据）
if [ "${SEED_DB:-0}" = "1" ]; then
  EMPTY=$(node -e "
const mysql=require('mysql2/promise');
(async()=>{
  const c=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'uniform'});
  const [r]=await c.query('SELECT COUNT(*) n FROM users');
  console.log(r[0].n); await c.end();
})().catch(()=>console.log('0'));
")
  if [ "$EMPTY" = "0" ]; then
    echo "[entrypoint] empty database, seeding demo data ..."
    node scripts/seed.mjs
  else
    echo "[entrypoint] data exists ($EMPTY users), skip seeding."
  fi
fi

export HOSTNAME=0.0.0.0
export PORT=3000
exec node server.js
