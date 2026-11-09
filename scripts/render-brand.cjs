const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const jobs = [
  ['public/brand/s2c-emblem.svg', 'public/brand/s2c-emblem.png', 2048, null],
  ['public/brand/s2c-emblem.svg', 'public/brand/s2c-emblem-dark.png', 2048, '#121110'],
  ['public/brand/s2c-mark.svg', 'public/brand/s2c-mark-512.png', 512, null],
];
for (const [src, out, w, bg] of jobs) {
  const r = new Resvg(fs.readFileSync(src, 'utf8'), { fitTo: { mode: 'width', value: w }, background: bg || undefined });
  fs.writeFileSync(out, r.render().asPng());
  console.log('wrote', out);
}
