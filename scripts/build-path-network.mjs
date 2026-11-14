#!/usr/bin/env node
import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildPathNetwork } from '../src/path-network.js';
import { pathSourceDigest, validatePathNetwork } from '../src/paths.js';

const sourceUrl = new URL('../public/data/campus.json', import.meta.url);
const outputUrl = new URL('../public/data/path-network.json', import.meta.url);
const campus = JSON.parse(await readFile(sourceUrl, 'utf8'));

if (process.argv.includes('--check')) {
  const cached = JSON.parse(await readFile(outputUrl, 'utf8'));
  await validatePathNetwork(cached, campus.context);
  console.log(`Path network current: ${cached.counts.ways} OSM ways, ${cached.counts.mappedWidths} mapped widths.`);
} else {
  const network = {
    schemaVersion: 1, algorithmVersion: 1,
    sourceSha256: await pathSourceDigest(campus.context),
    generatedAt: new Date().toISOString(),
    sourceFile: 'campus.json / normalized outdoor OSM path records',
    generator: 'node scripts/build-path-network.mjs',
    attribution: '© OpenStreetMap contributors; ODbL 1.0. Derived display geometry.',
    ...buildPathNetwork(campus.context),
  };
  await validatePathNetwork(network, campus.context);
  const output = fileURLToPath(outputUrl), temporary = `${output}.tmp`;
  await writeFile(temporary, `${JSON.stringify(network)}\n`);
  await rename(temporary, output);
  console.log(`Generated ${output}: ${network.counts.ways} ways, ${network.counts.mappedWidths} mapped widths, ${network.counts.unknownWidths} centerlines.`);
}
