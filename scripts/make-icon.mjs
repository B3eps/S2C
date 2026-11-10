import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';

const source = await readFile('public/brand/s2c-mark.svg', 'utf8');
const png = new Resvg(source, { fitTo: { mode: 'width', value: 256 } }).render().asPng();
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(header.length, 18);
await mkdir('electron/assets', { recursive: true });
await Promise.all([
  writeFile('electron/assets/s2c.png', png),
  writeFile('electron/assets/s2c.ico', Buffer.concat([header, png])),
]);
