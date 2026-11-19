/**
 * Regenerasi server/seed/catalog.js dari src/data/products.ts.
 *
 * Kenapa ada skrip ini: sebelumnya catalog.js diperbarui manual, dan itu
 * pernah menyebabkan seed tertinggal dari products.ts (galeri hilang, harga
 * lama). Dengan skrip ini, products.ts selalu jadi satu-satunya sumber
 * kebenaran.
 *
 * Cara pakai: npm run seed:catalog
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundlePath = path.join(root, 'node_modules/.cache/products-seed.mjs');
const outPath = path.join(root, 'server/seed/catalog.js');

fs.mkdirSync(path.dirname(bundlePath), { recursive: true });

// products.ts memakai import.meta.env milik Vite, jadi perlu di-bundle dulu.
execFileSync(
  path.join(root, 'node_modules/.bin/esbuild'),
  [
    path.join(root, 'src/data/products.ts'),
    '--bundle',
    '--format=esm',
    '--platform=node',
    '--define:import.meta.env={}',
    `--outfile=${bundlePath}`
  ],
  { stdio: 'inherit' }
);

const { PRODUCTS, CATEGORIES, KAOS_SIZE_CHART } = await import(
  `file://${bundlePath}?t=${Date.now()}`
);

const seedProducts = PRODUCTS.map((p) => ({ ...p, active: true }));

const out = `/**
 * Seed katalog produk Cilegon Enggih (hasil generate dari src/data/products.ts).
 * Dipakai backend saat admin menekan "Reset Katalog". JANGAN diedit manual.
 *
 * Regenerate dengan: npm run seed:catalog
 */

export const SEED_PRODUCTS = ${JSON.stringify(seedProducts, null, 2)};

export const SEED_CATEGORIES = ${JSON.stringify(CATEGORIES, null, 2)};

export const SEED_SIZE_CHART = ${JSON.stringify(KAOS_SIZE_CHART, null, 2)};
`;

fs.writeFileSync(outPath, out);

console.log(`[seed] ${seedProducts.length} produk → server/seed/catalog.js`);
for (const p of seedProducts) {
  console.log(`  ${String((p.galleryImages || []).length).padStart(2)} foto · ${p.slug} · ${p.price}`);
}
