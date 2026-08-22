/* Reads teamWorkload out of app.fixed.jsx.
 *
 * The Work board could say which jobs were late but not who was carrying them,
 * so the two questions a manager actually asks — who is doing well, who is
 * buried — had no answer. This covers the roll-up behind that view, and in
 * particular the honesty of the on-time rate: a job with no doneAt must not be
 * counted as on time, because that would flatter everyone at once.
 *
 *   node pos/__tests__/team-workload.test.cjs
 */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'app.fixed.jsx'), 'utf8');
const body = src.slice(src.indexOf('function teamWorkload('),
                       src.indexOf('// ——— end of the team workload block'));
const { teamWorkload } = new Function(body + '; return {teamWorkload:teamWorkload};')();

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond || extra === undefined ? '' : '  → ' + extra));
  cond ? pass++ : fail++;
};

const TODAY = '2026-08-22';
const staff = [
  { id: 'a', name: 'Nok' },
  { id: 'b', name: 'Ploy' },
  { id: 'c', name: 'Somchai' },
  { id: 'z', name: 'Left The Shop', approved: false },
];
const T = (o) => Object.assign({ id: Math.random().toString(36).slice(2), updates: [] }, o);
const tasks = [
  /* Nok: buried and behind */
  T({ assigneeId: 'a', assigneeName: 'Nok', deadline: '2026-08-10' }),
  T({ assigneeId: 'a', assigneeName: 'Nok', deadline: '2026-08-15' }),
  T({ assigneeId: 'a', assigneeName: 'Nok', deadline: '2026-08-23' }),
  T({ assigneeId: 'a', assigneeName: 'Nok', deadline: '2026-09-30' }),
  T({ assigneeId: 'a', assigneeName: 'Nok', status: 'done', deadline: '2026-08-20', doneAt: '2026-08-19' }),
  T({ assigneeId: 'a', assigneeName: 'Nok', status: 'done', deadline: '2026-08-12', doneAt: '2026-08-18' }),
  /* Ploy: light, delivers, one blocker */
  T({ assigneeId: 'b', assigneeName: 'Ploy', deadline: '2026-09-01', updates: [{ type: 'issue', resolved: false }] }),
  T({ assigneeId: 'b', assigneeName: 'Ploy', status: 'done', deadline: '2026-08-05', doneAt: '2026-08-05' }),
  /* Somchai: nothing at all */
  /* history from before doneAt existed, plus one nobody owns */
  T({ assigneeId: 'c', assigneeName: 'Somchai', status: 'done', deadline: '2026-07-01' }),
  T({ assigneeId: '', deadline: '2026-08-01' }),
];

const rows = teamWorkload(tasks, staff, TODAY);
const by = Object.fromEntries(rows.map((r) => [r.name, r]));

console.log('everyone is on the board');
ok('a staff member with no tasks still appears', !!by.Somchai);
ok('a de-activated staff member does not', !by['Left The Shop']);
ok('an unassigned task gets its own row', !!by['ยังไม่มอบหมาย'], Object.keys(by).join(', '));

console.log('\ncounting');
ok('open counts only what is not done', by.Nok.open === 4, by.Nok.open);
ok('overdue is open and past the deadline', by.Nok.overdue === 2, by.Nok.overdue);
ok('due-soon is the next two days, not the far future', by.Nok.dueSoon === 1, by.Nok.dueSoon);
ok('a far-off deadline is neither overdue nor due soon', by.Nok.open - by.Nok.overdue - by.Nok.dueSoon === 1);
ok('done counts everything finished', by.Nok.done === 2, by.Nok.done);
ok('an unresolved blocker is counted', by.Ploy.issues === 1);
ok('a resolved blocker is not', teamWorkload([T({ assigneeId: 'b', updates: [{ type: 'issue', resolved: true }] })], staff, TODAY).find((r) => r.id === 'b').issues === 0);

console.log('\nthe on-time rate is honest');
ok('finished before the deadline counts as on time', by.Nok.onTime === 1, by.Nok.onTime);
ok('finished after it counts as late', by.Nok.late === 1, by.Nok.late);
ok('the rate is out of the rated jobs only', by.Nok.onTimePct === 50, by.Nok.onTimePct);
ok('a job with no doneAt is NOT counted as on time', by.Somchai.unknown === 1 && by.Somchai.onTime === 0);
ok('and it is left out of the rate entirely', by.Somchai.onTimePct === null, by.Somchai.onTimePct);
ok('someone with nothing finished has no rate rather than 0%', by['ยังไม่มอบหมาย'].onTimePct === null);
ok('done exactly on the deadline is on time', by.Ploy.onTime === 1 && by.Ploy.onTimePct === 100);

console.log('\nwho to talk to first');
ok('the most overdue person sorts first', rows[0].name === 'Nok', rows.map((r) => r.name).join(' → '));
ok('someone with nothing to do sinks', rows[rows.length - 1].name === 'Somchai', rows.map((r) => r.name).join(' → '));

console.log('\noverload is relative to the team');
ok('Nok is flagged as carrying too much', by.Nok.overloaded === true);
ok('Ploy is not', by.Ploy.overloaded === false);
const flat = teamWorkload(
  [T({ assigneeId: 'a' }), T({ assigneeId: 'b' }), T({ assigneeId: 'c' })], staff, TODAY);
ok('a team where everyone has one job flags nobody', flat.every((r) => !r.overloaded));
const tiny = teamWorkload([T({ assigneeId: 'a' }), T({ assigneeId: 'a' })], [staff[0], staff[1]], TODAY);
ok('two jobs across two people does not flag anyone', tiny.every((r) => !r.overloaded),
  JSON.stringify(tiny.map((r) => [r.name, r.open, r.overloaded])));

console.log('\nedge cases');
ok('no tasks and no staff is not a crash', teamWorkload([], [], TODAY).length === 0);
ok('null arguments are safe', teamWorkload(null, null, TODAY).length === 0);
ok('junk entries are skipped', teamWorkload([null, undefined], staff, TODAY).length === 3);
ok('a task with no deadline is open but not overdue', (function () {
  const r = teamWorkload([T({ assigneeId: 'a' })], staff, TODAY).find((x) => x.id === 'a');
  return r.open === 1 && r.overdue === 0 && r.dueSoon === 0;
})());

console.log('\nthe wiring is in place');
ok('completing a task stamps doneAt', /if\(n\.status==="done"&&!n\.doneAt\)n\.doneAt=/.test(src));
ok('re-opening a task clears it', /if\(n\.status!=="done"&&n\.doneAt\)delete n\.doneAt/.test(src));
ok('the team chip is manager-only', /concat\(canEdit\?\[\["team","👥 ทีม Team"\]\]:\[\]\)/.test(src));
ok('the task list is hidden while the team view shows', /workFilter!=="team"&&list\.map/.test(src));

console.log(`\n${fail ? 'FAIL' : 'PASS'} — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
