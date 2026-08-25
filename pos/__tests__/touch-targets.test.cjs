const fs = require('node:fs');
const assert = require('node:assert/strict');

const src = fs.readFileSync('pos/app.fixed.jsx', 'utf8');

for (const token of ['btn:', 'btnLg:', 'chip:']) {
  const start = src.indexOf(token);
  assert.notEqual(start, -1, `${token} token exists`);
  const body = src.slice(start, start + 1100);
  assert.match(body, /minHeight:44/, `${token} has a 44px minimum height`);
  assert.match(body, /minWidth:44/, `${token} has a 44px minimum width`);
}

const inputStart = src.indexOf('input:{');
assert.notEqual(inputStart, -1, 'input token exists');
assert.match(src.slice(inputStart, inputStart + 700), /minHeight:44/, 'input token has a 44px minimum height');

assert.match(src, /<select aria-label="Language"[\s\S]*?minHeight:44,minWidth:44/, 'language control is at least 44px');
assert.match(src, /aria-label=\{props\.label\|\|props\.title\|\|"Toggle setting"\}/, 'toggle has an accessible name');
assert.match(src, /style=\{\{width:44,height:44,[^}]*background:"transparent"/, 'toggle uses a 44px transparent hit area');

const iconOnly = /<button\b([^>]*)>([^<>{}]*)<\/button>/g;
const unlabeled = [];
let match;
while ((match = iconOnly.exec(src))) {
  const text = match[2].trim();
  if (text && !/[\p{L}\p{N}]/u.test(text) && !/aria-label=/.test(match[1])) {
    unlabeled.push(text);
  }
}
assert.deepEqual(unlabeled, [], `icon-only buttons need aria-label: ${unlabeled.join(', ')}`);

console.log('touch-target assertions passed');
