/* Reads the working-shifts engine out of app.fixed.jsx.
 *
 * The month roster used to be a spreadsheet, and the four mistakes it made
 * were all countable: a required shift with nobody on it, one person booked
 * twice on a day, somebody rostered to a shop they are not cleared for, and a
 * full-timer quietly carried past their cap. Every one of those is asserted
 * here, because a generator that produces a plausible-looking grid with a hole
 * in it is worse than no generator — the hole is only found at 01:00.
 *
 *   node pos/__tests__/roster.test.cjs
 */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'app.fixed.jsx'), 'utf8');
const body = src.slice(src.indexOf('// ——— working shifts block'),
                       src.indexOf('// ——— end of the roster assistant block'));
const seed = src.slice(src.indexOf('var SHIFT_LOCATIONS ='),
                       src.indexOf('var SHIFT_STAFF =') + src.slice(src.indexOf('var SHIFT_STAFF =')).indexOf('\n];') + 3);
const M = new Function(body + seed + `; return {
  buildRoster: buildRoster, shiftHours: shiftHours, monthDates: monthDates,
  slotRunsOn: slotRunsOn, rosterPick: rosterPick, rosterAsk: rosterAsk,
  LOCS: SHIFT_LOCATIONS, STAFF: SHIFT_STAFF };`)();

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond || extra === undefined ? '' : '  → ' + extra));
  cond ? pass++ : fail++;
};

/* ── hours ──────────────────────────────────────────────────────────────── */
console.log('shift length');
ok('a daytime shift is its plain duration', M.shiftHours('09:00-18:00') === 9);
ok('an overnight shift does not go negative', M.shiftHours('17:00-02:00') === 9, M.shiftHours('17:00-02:00'));
ok('the bar early-close is eight, not sixteen', M.shiftHours('17:00-01:00') === 8, M.shiftHours('17:00-01:00'));
ok('Sathorn early is eight', M.shiftHours('01:00-09:00') === 8);
ok("the CEO's part window is five", M.shiftHours('21:00-02:00') === 5, M.shiftHours('21:00-02:00'));
ok('a shift ending at its start time is a full day, not zero', M.shiftHours('09:00-09:00') === 24);
ok('nonsense is zero rather than NaN', M.shiftHours('later') === 0);

/* ── the calendar ───────────────────────────────────────────────────────── */
console.log('\nthe month');
const sep = M.monthDates(2026, 9);
ok('September has 30 days', sep.length === 30, sep.length);
ok('it starts on the 1st', sep[0].date === '2026-09-01');
ok('it ends on the 30th', sep[29].date === '2026-09-30');
ok('1 Sep 2026 is a Tuesday', sep[0].dow === 2, sep[0].dow);
ok('February 2028 has 29 days', M.monthDates(2028, 2).length === 29);
ok('February 2026 has 28', M.monthDates(2026, 2).length === 28);
ok('December rolls into the next year cleanly', M.monthDates(2026, 12).length === 31);

console.log('\nwhich days a slot runs');
const bar = M.LOCS.filter((l) => l.id === 'bar')[0];
const fsNight = bar.slots.filter((s) => s.id === 'FSNIGHT')[0];
const monThu = bar.slots.filter((s) => s.id === 'MONTHU')[0];
ok('the bar Fri-Sun night runs on Saturday', M.slotRunsOn(fsNight, 6));
ok('it does not run on Tuesday', !M.slotRunsOn(fsNight, 2));
ok('Mon-Thu PM runs on Wednesday', M.slotRunsOn(monThu, 3));
ok('Mon-Thu PM does not run on Sunday', !M.slotRunsOn(monThu, 0));
ok('a slot with no day list runs every day', M.slotRunsOn({ id: 'x', label: '09:00-18:00' }, 4));

/* ── the real month ─────────────────────────────────────────────────────── */
console.log('\nSeptember 2026, all three shops');
const r = M.buildRoster(M.LOCS, M.STAFF, 2026, 9);
const v = r.validation;
const by = {}; r.summary.forEach((s) => { by[s.name] = s; });

ok('no required shift is left empty', v.empty.length === 0,
   v.empty.slice(0, 3).map((e) => e.date + ' ' + e.loc + '/' + e.slot).join(', '));
ok('nobody works twice on one day', v.doubles.length === 0,
   v.doubles.slice(0, 3).map((d) => d.name + ' ' + d.date).join(', '));
ok('nobody is rostered outside their authorised shop or shift', v.unauthorised.length === 0,
   v.unauthorised.slice(0, 3).map((u) => u.name + ' ' + u.loc + '/' + u.slot).join(', '));
ok('nobody exceeds their own maximum', v.over.length === 0,
   v.over.map((o) => o.name + ' ' + o.shifts + '>' + o.max).join(', '));
ok('the run reports itself clean', v.ok === true);

console.log('\nthe totals the shop already knows');
ok('Amoe works 26 shifts for 234h', by.Amoe.shifts === 26 && by.Amoe.hours === 234, by.Amoe.shifts + ' / ' + by.Amoe.hours);
ok('Alex works 26 for 234h', by.Alex.shifts === 26 && by.Alex.hours === 234, by.Alex.shifts + ' / ' + by.Alex.hours);
ok('Rena works 26 for 234h', by.Rena.shifts === 26 && by.Rena.hours === 234, by.Rena.shifts + ' / ' + by.Rena.hours);
ok('Raizo works 26 for 208h', by.Raizo.shifts === 26 && by.Raizo.hours === 208, by.Raizo.shifts + ' / ' + by.Raizo.hours);
ok('Ploy works 26 for 208h', by.Ploy.shifts === 26 && by.Ploy.hours === 208, by.Ploy.shifts + ' / ' + by.Ploy.hours);
ok('Jack works 26 for 220h', by.Jack.shifts === 26 && by.Jack.hours === 220, by.Jack.shifts + ' / ' + by.Jack.hours);
ok('Mon is held at his 26 cap', by.Mon.shifts === 26, by.Mon.shifts);

/* The owner sets this: Bryan and Keneth cover four nights a month at
 * Phatthanakarn, both on the same night — Keneth stands 17:00-21:00 and hands
 * over to Bryan for 21:00-02:00. One name per cell would either drop one of
 * them from the printed sheet or invent a second shift on a one-shift night. */
console.log('\nthe CEO split: two windows, one night, four nights a month');
ok('Bryan works 4 nights', by['Bryan (CEO)'].shifts === 4, by['Bryan (CEO)'].shifts);
ok('Keneth works the same 4', by.Keneth.shifts === 4, by.Keneth.shifts);
ok('Bryan is charged 5h a night, not 9', by['Bryan (CEO)'].hours === 20, by['Bryan (CEO)'].hours);
ok('Keneth is charged 4h a night, not 9', by.Keneth.hours === 16, by.Keneth.hours);
ok('they are rostered on the same dates',
   by['Bryan (CEO)'].dates.join() === by.Keneth.dates.join(),
   by['Bryan (CEO)'].dates.join(' ') + '  vs  ' + by.Keneth.dates.join(' '));
const split = by['Bryan (CEO)'].dates.map((d) => r.cells['ptk|' + d + '|C2']);
ok('each shared night shows both names on the sheet',
   split.every((c) => c && c.extra && c.extra.length === 1), JSON.stringify(split[0]));
ok('…with Keneth first and Bryan picking up where he stops',
   split.every((c) => c.window === '17:00-21:00' && c.extra[0].window === '21:00-02:00'),
   split[0] && split[0].window + ' -> ' + split[0].extra[0].window);
ok('the two windows tile the 17:00-02:00 slot exactly',
   M.shiftHours('17:00-21:00') + M.shiftHours('21:00-02:00') === M.shiftHours('17:00-02:00'));

console.log('\nan optional slot never starves a required one');
ok('every 17:00-02:00 night at Phatthanakarn is covered',
   r.days.every((d) => !!r.cells['ptk|' + d.date + '|C2']),
   r.days.filter((d) => !r.cells['ptk|' + d.date + '|C2']).map((d) => d.date).join(', '));
ok('Mon is still held to his 26', by.Mon.shifts === 26, by.Mon.shifts);

console.log('\nBank is four at each shop, not eight at either');
const bankAt = (l) => Object.keys(r.cells).filter((k) => k.split('|')[0] === l && r.cells[k] && r.cells[k].id === 'bank').length;
ok('4 at Phatthanakarn', bankAt('ptk') === 4, bankAt('ptk'));
ok('4 at Sathorn', bankAt('sat') === 4, bankAt('sat'));
ok('8 in total', by.Bank.shifts === 8, by.Bank.shifts);

console.log('\npay: hourly from the monthly salary, OT at 1.5x');
ok('Amoe on 26000 over 26x9h is 111.11/h', by.Amoe.pay.hourly === 111.11, by.Amoe.pay.hourly);
ok('his normal month is 234h', by.Amoe.pay.normalHours === 234, by.Amoe.pay.normalHours);
ok('he worked exactly that, so no OT', by.Amoe.pay.otHours === 0, by.Amoe.pay.otHours);
ok('Raizo on 24000 over 26x8h is 115.38/h', by.Raizo.pay.hourly === 115.38, by.Raizo.pay.hourly);
ok('a 9h shift and an 8h shift do not share a divisor',
   by.Amoe.pay.normalHours !== by.Raizo.pay.normalHours, by.Amoe.pay.normalHours + ' vs ' + by.Raizo.pay.normalHours);
ok('the OT rate is exactly 1.5x the hourly',
   Math.abs(by.Amoe.pay.otRate - by.Amoe.pay.hourly * 1.5) < 0.01, by.Amoe.pay.otRate);
ok('nobody under their target is charged negative OT', r.summary.every((s) => s.pay.otHours >= 0));
ok('no OT means pay is just the salary', by.Amoe.pay.totalPay === 26000, by.Amoe.pay.totalPay);
{
  /* one extra shift past the target has to show up as 9h of OT, not 9h of nothing */
  const pushed = M.STAFF.map((p) => (p.id === 'amoe' ? Object.assign({}, p, { off: [], target: 26, max: 28 }) : p));
  const rp = M.buildRoster(M.LOCS, pushed, 2026, 9);
  const a = rp.summary.filter((s) => s.name === 'Amoe')[0];
  ok('working past the target creates OT hours', a.pay.otHours > 0, a.shifts + ' shifts, OT ' + a.pay.otHours + 'h');
  ok('OT is paid at 1.5x, not 1x',
     Math.abs(a.pay.otPay - a.pay.otHours * a.pay.hourly * 1.5) < 0.02, a.pay.otPay);
  ok('total pay is salary plus OT',
     Math.abs(a.pay.totalPay - (a.pay.salary + a.pay.otPay)) < 0.02, a.pay.totalPay);
}
ok('somebody with no salary on file gets a zero rate rather than NaN',
   by.Steve.pay.hourly === 0 && by.Steve.pay.otPay === 0, by.Steve.pay.hourly);

console.log('\na duty inside a shift is recorded, never counted twice');
ok("Rena's Wednesday marketing is written down", by.Rena.duties.length === 5, by.Rena.duties.length);
ok('…on Wednesdays only', by.Rena.duties.every((d) => new Date(d.date + 'T00:00:00Z').getUTCDay() === 3));
ok('…and adds no shifts: 26 stands', by.Rena.shifts === 26);
ok('…and adds no hours: 26 × 9h = 234h stands', by.Rena.hours === 234);
ok("Ploy's weekend media duty is recorded too", by.Ploy.duties.length === 4, by.Ploy.duties.length);
ok('…without inflating her 26', by.Ploy.shifts === 26 && by.Ploy.hours === 208);

console.log('\nfixed days off are honoured');
const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
ok('Amoe never works a Saturday', by.Amoe.dates.every((d) => dow(d) !== 6));
ok('Alex never works a Thursday', by.Alex.dates.every((d) => dow(d) !== 4));
ok('Rena never works a Friday', by.Rena.dates.every((d) => dow(d) !== 5));
ok('Dylan never works a Wednesday or a Sunday', by.Dylan.dates.every((d) => dow(d) !== 3 && dow(d) !== 0));
ok('Raizo never works a Monday', by.Raizo.dates.every((d) => dow(d) !== 1));
ok('Pok never works a Wednesday or a Friday', by.Pok.dates.every((d) => dow(d) !== 3 && dow(d) !== 5));

console.log('\nJack works only at the bar');
const jackCells = Object.keys(r.cells).filter((k) => r.cells[k] && r.cells[k].id === 'jack');
ok('every one of his shifts is a bar shift', jackCells.every((k) => k.split('|')[0] === 'bar'), jackCells.length + ' shifts');
ok('and he has 26 of them', jackCells.length === 26, jackCells.length);

console.log('\nthe bar prints a dash rather than a hole');
const closed = Object.keys(r.cells).filter((k) => r.cells[k] && r.cells[k].closed);
ok('slots that do not run that day are marked closed', closed.length > 0, closed.length);
ok('a closed slot is never reported as an empty shift',
   v.empty.every((e) => !(e.loc === 'bar' && e.slot === 'FSNIGHT' && [1, 2, 3, 4].indexOf(dow(e.date)) >= 0)));

/* ── the rules under pressure ───────────────────────────────────────────── */
console.log('\nleave is applied before anything else');
const withLeave = M.STAFF.map((p) => (p.id === 'amoe'
  ? Object.assign({}, p, { leave: ['2026-09-07', '2026-09-08', '2026-09-09'] }) : p));
const rl = M.buildRoster(M.LOCS, withLeave, 2026, 9);
const amoe2 = rl.summary.filter((s) => s.name === 'Amoe')[0];
ok('Amoe is not rostered on any of his leave dates',
   ['2026-09-07', '2026-09-08', '2026-09-09'].every((d) => amoe2.dates.indexOf(d) < 0));
ok('his shifts drop by the days he was away', amoe2.shifts === 23, amoe2.shifts);
ok('and his shift is still covered by somebody', rl.validation.empty.filter((e) => e.slot === 'A1').length === 0,
   rl.validation.empty.filter((e) => e.slot === 'A1').length + ' A1 holes');

console.log('\nan unauthorised person is left out, and the hole is reported');
const noCover = M.STAFF.filter((p) => ['steve', 'pond', 'mel', 'honey', 'bank'].indexOf(p.id) < 0);
const rn = M.buildRoster(M.LOCS, noCover, 2026, 9);
ok('with every reliever removed, holes appear', rn.validation.empty.length > 0, rn.validation.empty.length);
ok('but nobody is shoved into a shop they are not cleared for', rn.validation.unauthorised.length === 0);
ok('and still nobody works twice in a day', rn.validation.doubles.length === 0);

console.log('\nthe cap is a cap');
const greedy = M.STAFF.map((p) => (p.id === 'amoe' ? Object.assign({}, p, { off: [], max: 28 }) : p));
const rg = M.buildRoster(M.LOCS, greedy, 2026, 9);
const amoe3 = rg.summary.filter((s) => s.name === 'Amoe')[0];
ok('Amoe with no day off still cannot pass 28', amoe3.shifts <= 28, amoe3.shifts);
ok('over-cap is empty because the cap held', rg.validation.over.length === 0);

console.log('\nunder-24 flags full-timers only');
ok('Dylan is flagged at 21', v.under.some((u) => u.name === 'Dylan'), JSON.stringify(v.under));
ok('part-timers are not flagged for being part-time',
   !v.under.some((u) => ['Steve', 'Pond', 'Bank', 'Honey'].indexOf(u.name) >= 0));
ok('nor is the CEO', !v.under.some((u) => /Bryan|Keneth/.test(u.name)));

console.log('\nhours by location add up');
const sumStaffHours = r.summary.reduce((a, s) => a + s.hours, 0);
const sumLocHours = Object.keys(v.hoursByLoc).reduce((a, k) => a + v.hoursByLoc[k], 0);
ok('the per-shop total equals the per-person total', Math.abs(sumStaffHours - sumLocHours) < 0.5,
   sumStaffHours + ' vs ' + sumLocHours);
ok('all three shops have hours', Object.keys(v.hoursByLoc).length === 3);
ok('Phatthanakarn carries the most', v.hoursByLoc.ptk > v.hoursByLoc.sat && v.hoursByLoc.sat > v.hoursByLoc.bar,
   JSON.stringify(v.hoursByLoc));

console.log('\nan empty roster does not throw');
const rz = M.buildRoster(M.LOCS, [], 2026, 9);
ok('every required shift is reported empty', rz.validation.empty.length > 0, rz.validation.empty.length);
ok('the summary is empty rather than broken', rz.summary.length === 0);
ok('and it does not claim to be ok', rz.validation.ok === false);

/* The assistant has to answer from the grid, never from a guess — a roster
 * question answered with an invented name sends somebody to the wrong shop. */
console.log('\nthe assistant answers from the roster, with no AI key');
const ask = (q) => M.rosterAsk(q, r, M.STAFF, M.LOCS);
{
  const a = ask('ใครทำงานวันที่ 2026-09-14');
  ok('who is on a given day', a && a.kind === 'onduty', a && a.kind);
  ok('…and it lists real shifts', a && a.lines.length > 5, a && a.lines.length);
  ok('…every line names a shop and a slot', a && a.lines.every((l) => /—/.test(l)));
}
ok('a date written 14/9 is understood', (ask('ใครทำงาน 14/9') || {}).kind === 'onduty');
{
  const a = ask('ใครว่างแทนได้วันที่ 2026-09-14');
  ok('who can cover a day', a && a.kind === 'free', a && a.kind);
  ok('…nobody offered is already working that day',
     a && a.lines.every((l) => {
       const nm = (l.split('—')[0] || '').replace('·', '').trim();
       if (!nm) return true;
       const s = r.summary.filter((x) => x.name === nm)[0];
       return !s || s.dates.indexOf('2026-09-14') < 0;
     }));
}
{
  const a = ask('ค่าแรงเดือนนี้เท่าไหร่');
  ok('the labour bill', a && a.kind === 'cost', a && a.kind);
  ok('…it separates salary from OT', a && a.lines.some((l) => /OT/.test(l)) && a.lines.some((l) => /เงินเดือนรวม/.test(l)));
  ok('…and says 1.5 เท่า out loud', a && a.lines.some((l) => /1\.5/.test(l)));
}
ok('an OT question is answered', (ask('ใครมี OT บ้าง') || {}).kind === 'ot');
ok('a balance question is answered', (ask('ใครทำเกิน ใครทำน้อย') || {}).kind === 'balance');
{
  const a = ask('amoe ทำกี่กะ');
  ok('one person by name', a && a.kind === 'person' && a.title === 'Amoe', a && a.title);
  ok('…with the real count in the answer', a && a.lines[0].indexOf('26 กะ') >= 0, a && a.lines[0]);
  ok('…and their real hourly rate', a && a.lines.some((l) => l.indexOf('111.11') >= 0));
}
ok('somebody with no salary is told so, not shown NaN',
   (ask('steve') || { lines: [] }).lines.some((l) => /ยังไม่ได้ใส่เงินเดือน/.test(l)));
ok('a question it cannot answer returns null rather than a guess',
   ask('what is the weather in bangkok') === null);
ok('an empty question returns null', ask('') === null && ask('   ') === null);
ok('it never throws on a roster with nobody in it',
   M.rosterAsk('ค่าแรง', M.buildRoster(M.LOCS, [], 2026, 9), [], M.LOCS) !== undefined);

console.log(`\n${fail ? 'FAIL' : 'PASS'} — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
