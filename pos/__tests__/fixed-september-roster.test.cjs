/* The September 2026 Base Coverage V8 sheets are an approved roster, not a
 * generator hint. This test locks every headline total and every rest date so
 * a later scheduling change cannot silently reshuffle the signed month. */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'app.fixed.jsx'), 'utf8');
const body = src.slice(src.indexOf('// ——— working shifts block'),
                       src.indexOf('// ——— end of the roster assistant block'));
const seed = src.slice(src.indexOf('var SHIFT_LOCATIONS ='),
                       src.indexOf('var SHIFT_STAFF =') + src.slice(src.indexOf('var SHIFT_STAFF =')).indexOf('\n];') + 3);
const M = new Function(body + seed + `; return {
  buildPublishedRoster, fixedRosterFor, LOCS: SHIFT_LOCATIONS, STAFF: SHIFT_STAFF
};`)();

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond || extra === undefined ? '' : '  → ' + extra));
  cond ? pass++ : fail++;
}

const published = M.buildPublishedRoster(M.LOCS, M.STAFF, 2026, 9);
const r = published.result;
const by = {}; r.summary.forEach((s) => { by[s.id] = s; });

console.log('September 2026 fixed Base Coverage V8');
ok('the fixed roster has 342 assigned duties',
   Object.values(r.cells).filter((c) => c && !c.closed).length === 342,
   Object.values(r.cells).filter((c) => c && !c.closed).length);
ok('all required cells are filled', r.validation.empty.length === 0, r.validation.empty.length);
ok('all names are authorised for their fixed shop/slot', r.validation.unauthorised.length === 0,
   JSON.stringify(r.validation.unauthorised.slice(0, 3)));
ok('nobody exceeds the approved duty total', r.validation.over.length === 0,
   JSON.stringify(r.validation.over));
ok('the fixed roster validates cleanly', r.validation.ok === true);

const expected = {
  amoe:[26,234], dylan:[26,234], rena:[23,207], palm:[26,234], mon:[26,234],
  steve:[21,189], bank:[0,0], raizo:[26,234], meng:[26,234], pok:[19,171],
  ploy:[25,225], mel:[26,234], alex:[26,208], jack:[26,226], honey:[20,172],
};
Object.keys(expected).forEach((id) => {
  ok(id + ' matches duties / roster hours', !!by[id] && by[id].shifts === expected[id][0] && by[id].hours === expected[id][1],
     by[id] && (by[id].shifts + ' / ' + by[id].hours));
});
ok('the staffing summary totals 342 duties',
   Object.keys(expected).reduce((n,id) => n + by[id].shifts, 0) === 342);

const rest = {
  amoe:'3,10,17,24', dylan:'5,11,18,25', rena:'3,9,16,17,23,24,30', palm:'6,13,18,25',
  mon:'4,10,17,24', steve:'2,4,9,16,20,23,27,29,30', bank:'1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30',
  raizo:'6,13,20,26', meng:'7,14,21,28', pok:'1,2,8,9,10,11,12,15,22,29,30',
  ploy:'1,8,15,22,27', mel:'5,12,19,26', alex:'7,14,21,28', jack:'7,14,21,28',
  honey:'1,2,3,8,15,16,19,22,23,29',
};
Object.keys(rest).forEach((id) => {
  const got = by[id].offDates.map((d) => +d.slice(-2)).join(',');
  ok(id + ' rest dates match the signed sheet', got === rest[id], got);
});

ok('Ploy has one integrated content duty on 10 September',
   by.ploy.duties.length === 1 && by.ploy.duties[0].date === '2026-09-10');
ok('content is not counted as a 26th shift', by.ploy.shifts === 25);
ok('every person has at most one shift per day across all businesses',
   r.summary.every((s) => new Set(s.dates).size === s.dates.length),
   r.summary.filter((s) => new Set(s.dates).size !== s.dates.length).map((s) => s.name).join(', '));
ok('the validator reports no same-day double shifts', r.validation.doubles.length === 0,
   JSON.stringify(r.validation.doubles));
const longestRun = (dates) => {
  const unique = Array.from(new Set(dates)).sort(); let run=0,best=0;
  unique.forEach((d,i) => { run=i && new Date(d)-new Date(unique[i-1])===86400000?run+1:1;best=Math.max(best,run); });
  return best;
};
ok('nobody works more than six consecutive days',
   r.summary.every((s) => longestRun(s.dates) <= 6),
   r.summary.map((s) => s.name + ':' + longestRun(s.dates)).join(', '));
ok('closed bar cells print as closed, not empty',
   r.cells['bar|2026-09-07|FSDAY'].closed === true &&
   !r.validation.empty.some((e) => e.loc === 'bar' && e.date === '2026-09-07'));
ok('spot checks preserve the photographed assignments',
   r.cells['ptk|2026-09-03|A1'].id === 'jack' &&
   r.cells['sat|2026-09-27|NIGHT'].id === 'raizo' &&
   r.cells['bar|2026-09-28|MONTHU'].id === 'honey');
ok('other months still use the generator', M.fixedRosterFor(2026, 10) === null);

if (fail) { console.error(`\nFAIL — ${pass} passed, ${fail} failed`); process.exit(1); }
console.log(`\nPASS — ${pass} fixed-roster checks`);
