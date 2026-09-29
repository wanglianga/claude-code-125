// 把构建产物静态资源与 public 拷入 standalone 目录，使 `npm start` 可直接运行
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const copy = (from, to) => {
  if (existsSync(from)) {
    mkdirSync(path.dirname(to), { recursive: true });
    cpSync(from, to, { recursive: true });
    console.log(`[copy-standalone] ${path.relative(root, from)} -> ${path.relative(root, to)}`);
  }
};
copy(path.join(root, '.next', 'static'), path.join(root, '.next', 'standalone', '.next', 'static'));
copy(path.join(root, 'public'), path.join(root, '.next', 'standalone', 'public'));
