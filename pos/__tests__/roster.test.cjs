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
  slotRunsOn: slotRunsOn, rosterPick: rosterPick, rosterAsk: rosterAsk, rosterVisits: rosterVisits, rosterPayroll: rosterPayroll,
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

/* The seed is now the shop's own wage sheet, and four people who stood shifts
 * in September are not on it. Removing them opens real holes — asserted as
 * "there are some and each one explains itself" rather than a number, because
 * the number is a fact about who is employed this month, not about the code. */
ok('the holes left by unstaffed shifts are reported, not hidden', v.empty.length > 0, v.empty.length);
ok('every hole names who was blocked and why',
   v.empty.every((e) => e.blockers && e.blockers.length));
ok('nobody works twice on one day', v.doubles.length === 0,
   v.doubles.slice(0, 3).map((d) => d.name + ' ' + d.date).join(', '));
ok('nobody is rostered outside their authorised shop or shift', v.unauthorised.length === 0,
   v.unauthorised.slice(0, 3).map((u) => u.name + ' ' + u.loc + '/' + u.slot).join(', '));
ok('nobody exceeds their own maximum', v.over.length === 0,
   v.over.map((o) => o.name + ' ' + o.shifts + '>' + o.max).join(', '));
ok('and the run refuses to call itself clean while they stand', v.ok === false);

console.log('\nthe totals the shop already knows');
ok('Amoe works 26 shifts for 234h', by.Amoe.shifts === 26 && by.Amoe.hours === 234, by.Amoe.shifts + ' / ' + by.Amoe.hours);
ok('Alex works 26 for 234h', by.Alex.shifts === 26 && by.Alex.hours === 234, by.Alex.shifts + ' / ' + by.Alex.hours);
ok('Mon works 26 for 234h', by['Mon (ม่อน อาชา)'].shifts === 26, by['Mon (ม่อน อาชา)'].shifts);
ok('Raizo works 26 for 208h', by.Raizo.shifts === 26 && by.Raizo.hours === 208, by.Raizo.shifts + ' / ' + by.Raizo.hours);
ok('Ploy works 26 for 208h', by['Ploy (พลอย)'].shifts === 26 && by['Ploy (พลอย)'].hours === 208, by['Ploy (พลอย)'].shifts + ' / ' + by['Ploy (พลอย)'].hours);
ok('Jack works 26 for 220h', by.Jack.shifts === 26 && by.Jack.hours === 220, by.Jack.shifts + ' / ' + by.Jack.hours);
ok('Mon is held at his 26 cap', by['Mon (ม่อน อาชา)'].shifts === 26, by['Mon (ม่อน อาชา)'].shifts);

/* Bryan and Keneth are CEOs. They come in once a week to look over the shop.
 * That is oversight, not cover — and the difference is not cosmetic: while it
 * was modelled as cover, the generator quietly leaned four nights of the
 * 17:00-02:00 slot on the two people least likely to actually stand behind
 * the counter, and the shop could not see it was short. */
console.log('\nCEOs check in weekly; they do not stand shifts');
const bryan = by['Bryan (CEO)'], ken = by['Keneth (CEO)'];
ok('Bryan is rostered to no shop shift', bryan.shifts === 0, bryan.shifts);
ok('Keneth is rostered to no shop shift', ken.shifts === 0, ken.shifts);
ok('no shop hours are charged to them', bryan.hours === 0 && ken.hours === 0);
ok('a CEO is never placed in a slot',
   Object.keys(r.cells).every((k) => {
     const c = r.cells[k];
     if (!c || c.closed) return true;
     return ['bryan', 'keneth'].indexOf(c.id) < 0 && (c.extra || []).every((e) => ['bryan', 'keneth'].indexOf(e.id) < 0);
   }));
ok('each of them visits once per week', bryan.visits.length === 5 && ken.visits.length === 5,
   bryan.visits.length + ' / ' + ken.visits.length);
ok('…no two visits fall in the same week', (() => {
  const wk = (d) => Math.floor((new Date(d + 'T00:00:00Z') - new Date('2026-08-30T00:00:00Z')) / (7 * 86400000));
  return new Set(bryan.visits.map(wk)).size === bryan.visits.length;
})(), bryan.visits.join(' '));
ok('…and both come on the same day', bryan.visits.join() === ken.visits.join(),
   bryan.visits.join(' ') + '  vs  ' + ken.visits.join(' '));
ok('the visit is recorded on the result', r.visits.length === 10, r.visits.length);
ok('each visit names a shop and a window',
   r.visits.every((v) => v.loc && v.window && v.label), JSON.stringify(r.visits[0]));
ok('visit hours are tracked separately from shift hours',
   bryan.visitHours === 25 && ken.visitHours === 20, bryan.visitHours + ' / ' + ken.visitHours);
ok('a visit never lands on a leave date', (() => {
  const withLeave = M.STAFF.map((p) => (p.id === 'bryan' ? Object.assign({}, p, { leave: ['2026-09-04'] }) : p));
  const rv = M.buildRoster(M.LOCS, withLeave, 2026, 9);
  const b2 = rv.summary.filter((s) => s.id === 'bryan')[0];
  return b2.visits.indexOf('2026-09-04') < 0 && b2.visits.length === 5;
})());

console.log('\nholes are reported with the reason, not papered over');
ok('each empty shift says who was blocked and why',
   v.empty.every((e) => e.blockers && e.blockers.length), JSON.stringify(v.empty[0] && v.empty[0].blockers));
ok('a blocker line names a person and a reason',
   v.empty.every((e) => e.blockers.every((b) => /: |nobody is cleared/.test(b))),
   v.empty[0].blockers.join(' | '));
ok('it never lists somebody who was not trained for that shift', (() => {
  const bySlot = {};
  M.STAFF.forEach((p) => (p.slots || []).forEach((sl) => { (bySlot[sl] = bySlot[sl] || []).push(p.name); }));
  return v.empty.every((e) => e.blockers.every((b) => {
    if (/nobody is cleared/.test(b)) return true;
    return (bySlot[e.slot] || []).some((n) => b.indexOf(n) === 0);
  }));
})(), v.empty[0].blockers.join(' | '));
ok('a slot nobody is cleared for says exactly that',
   v.empty.some((e) => e.blockers.some((b) => /nobody is cleared/.test(b))));

console.log('\nan optional slot never starves a required one');
ok('Mon is still held to his 26', by['Mon (ม่อน อาชา)'].shifts === 26, by['Mon (ม่อน อาชา)'].shifts);
ok('Sunday stock/admin never takes a shift a required slot still needs', (() => {
  /* staff every open Phatthanakarn slot and the holes must close completely —
   * which only happens if nothing optional got in ahead of a required shift */
  const plus = M.STAFF.concat([
    { id: 'n1', name: 'N1', kind: 'full', locs: ['ptk'], slots: ['C1'], off: [], target: 26, max: 30 },
    { id: 'n2', name: 'N2', kind: 'full', locs: ['ptk'], slots: ['B1'], off: [], target: 26, max: 30 },
    { id: 'n3', name: 'N3', kind: 'full', locs: ['ptk'], slots: ['C2'], off: [], target: 26, max: 30 },
    { id: 'n4', name: 'N4', kind: 'full', locs: ['ptk'], slots: ['A1', 'A2', 'B2'], off: [], target: 26, max: 30 },
    { id: 'n5', name: 'N5', kind: 'full', locs: ['sat'], slots: ['PEAK'], off: [], target: 26, max: 30 },
  ]);
  const rp2 = M.buildRoster(M.LOCS, plus, 2026, 9);
  return rp2.validation.empty.length === 0;
})());

/* "Four at Phatthanakarn and four at Sathorn" is two limits, not one of eight.
 * A single total lets the generator spend all eight in whichever shop it fills
 * first and leave the other short. Nobody in the current wage sheet is split
 * across shops, so the rule is exercised with a person built for it. */
console.log('\na per-shop cap is two limits, not one total');
{
  const split = M.STAFF.concat([{
    id: 'twoshop', name: 'TwoShop', kind: 'part', relief: true,
    locs: ['ptk', 'sat'], slots: ['B2', 'PEAK'], off: [],
    target: 8, max: 8, locMax: { ptk: 4, sat: 4 },
    payType: 'daily', dailyRate: 600,
  }]);
  const rs = M.buildRoster(M.LOCS, split, 2026, 9);
  const at = (l) => Object.keys(rs.cells).filter((k) => k.split('|')[0] === l && rs.cells[k] && rs.cells[k].id === 'twoshop').length;
  ok('no more than 4 at Phatthanakarn', at('ptk') <= 4, at('ptk'));
  ok('no more than 4 at Sathorn', at('sat') <= 4, at('sat'));
  ok('and never more than 8 altogether', at('ptk') + at('sat') <= 8, at('ptk') + at('sat'));
  ok('the cap is what stops them, not a lack of work',
     at('ptk') + at('sat') === 8, at('ptk') + ' + ' + at('sat'));
}

/* The shop runs two contracts side by side and they are not the same sum:
 * a monthly person is owed their salary for the month, a วันละ person is owed
 * the days they actually stood. */
console.log('\npay: two contract types, OT at 1.5x on both');
const alex = by.Alex, amoe = by.Amoe, raizo = by.Raizo;
ok('Alex is on a monthly salary', alex.pay.payType === 'monthly', alex.pay.payType);
ok('…19,000 over 26x9h is 81.20/h', alex.pay.hourly === 81.2, alex.pay.hourly);
ok('…and his base is the salary, whatever the shift count', alex.pay.basePay === 19000, alex.pay.basePay);
ok('Amoe is on a day rate', amoe.pay.payType === 'daily', amoe.pay.payType);
ok('…600/day over a 9h shift is 66.67/h', amoe.pay.hourly === 66.67, amoe.pay.hourly);
ok('…and his base is the days he stood, not a flat month',
   amoe.pay.basePay === 600 * amoe.shifts, amoe.pay.basePay + ' for ' + amoe.shifts + ' days');
ok('a 9h shift and an 8h shift do not share a divisor',
   alex.pay.normalHours !== raizo.pay.normalHours, alex.pay.normalHours + ' vs ' + raizo.pay.normalHours);
ok('the OT rate is exactly 1.5x the hourly on a salary',
   Math.abs(alex.pay.otRate - alex.pay.hourly * 1.5) < 0.01, alex.pay.otRate);
ok('…and on a day rate too',
   Math.abs(amoe.pay.otRate - amoe.pay.hourly * 1.5) < 0.01, amoe.pay.otRate);
ok('nobody under their target is charged negative OT', r.summary.every((s) => s.pay.otHours >= 0));
{
  const pushed = M.STAFF.map((p) => (p.id === 'amoe' ? Object.assign({}, p, { off: [], target: 26, max: 28 }) : p));
  const a = M.buildRoster(M.LOCS, pushed, 2026, 9).summary.filter((s) => s.id === 'amoe')[0];
  ok('working past the target creates OT hours', a.pay.otHours > 0, a.shifts + ' shifts, OT ' + a.pay.otHours + 'h');
  ok('OT is paid at 1.5x, not 1x',
     Math.abs(a.pay.otPay - a.pay.otHours * a.pay.hourly * 1.5) < 0.02, a.pay.otPay);
  ok('a day-rate person is paid for the extra day AND the OT on it',
     a.pay.basePay === 600 * a.shifts && a.pay.totalPay > a.pay.basePay, a.pay.totalPay);
}
ok('somebody with no wage on file gets a zero rate rather than NaN', (() => {
  const nw = M.STAFF.map((p) => (p.id === 'alex' ? Object.assign({}, p, { salary: 0, dailyRate: 0, payType: 'monthly' }) : p));
  const a = M.buildRoster(M.LOCS, nw, 2026, 9).summary.filter((s) => s.id === 'alex')[0];
  return a.pay.hourly === 0 && a.pay.otPay === 0 && a.pay.totalPay === 0;
})());

console.log('\npayroll rolls up and reconciles against the wage line');
const pr = M.rosterPayroll(r, M.STAFF, 353500);
ok('the bill is the base plus the OT', pr.total === pr.base + pr.ot, pr.base + ' + ' + pr.ot + ' = ' + pr.total);
ok('it compares against the Wages budget', pr.diff === pr.total - 353500, pr.diff);
ok('CEOs are owners, not payroll', Math.abs(pr.total - r.summary.filter((s) => s.kind !== 'ceo')
   .reduce((a, s) => a + s.pay.totalPay, 0)) < 1, pr.total);
ok('…and a CEO contributes nothing to the wage bill',
   r.summary.filter((s) => s.kind === 'ceo').every((s) => s.pay.totalPay === 0));
ok('kitchen, riders and back office are costed even with no counter shift', (() => {
  const rider = by['Martin (มาร์ติน)'];
  return rider.shifts === 0 && rider.pay.basePay === 700 * 26;
})(), by['Martin (มาร์ติน)'].pay.basePay);
ok('…because a day-rate rider costed at zero days would vanish from the wage line',
   by.Zaw.pay.basePay > 0 && by.Soe.pay.basePay > 0);
ok('anyone on payroll with no shift is named', pr.noShift.length > 0,
   pr.noShift.map((x) => x.name).join(', '));
ok('…and Beer and Gus are in that list, since no shift is assigned to them yet',
   ['Beer', 'Gus'].every((n) => pr.noShift.some((x) => x.name === n)),
   pr.noShift.map((x) => x.name).join(', '));
ok('…with the reason spelled out', pr.noShift.every((x) => !!x.why));
ok('everybody on the wage sheet has a wage on file', pr.noPay.length === 0,
   pr.noPay.map((x) => x.name).join(', '));
ok('…and having no shift yet is not mistaken for having no wage',
   pr.noShift.some((x) => x.name === 'Beer') && !pr.noPay.some((x) => x.name === 'Beer'));

console.log('\na duty inside a shift is recorded, never counted twice');
const ploy = by['Ploy (พลอย)'];
ok("Ploy's weekend media duty is written down", ploy.duties.length === 4, ploy.duties.length);
ok('…on Saturdays only', ploy.duties.every((d) => new Date(d.date + 'T00:00:00Z').getUTCDay() === 6));
ok('…and adds no shifts: 26 stands', ploy.shifts === 26, ploy.shifts);
ok('…and adds no hours: 26 × 8h = 208h stands', ploy.hours === 208, ploy.hours);

console.log('\nfixed days off are honoured');
const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
ok('Amoe never works a Saturday', by.Amoe.dates.every((d) => dow(d) !== 6));
ok('Alex never works a Thursday', by.Alex.dates.every((d) => dow(d) !== 4));
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
/* Amoe is now the only person cleared for A1, so his leave leaves the shift
 * open — and the report has to say so rather than quietly reassign it. */
ok('the days he is away are reported as open, not silently filled',
   rl.validation.empty.filter((e) => e.slot === 'A1' && ['2026-09-07', '2026-09-08', '2026-09-09'].indexOf(e.date) >= 0).length === 3,
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
ok('nor is a CEO, who stands no shifts at all', !v.under.some((u) => /Bryan|Keneth/.test(u.name)));

console.log('\nhours by location add up');
const sumStaffHours = r.summary.reduce((a, s) => a + s.hours, 0);
const sumLocHours = Object.keys(v.hoursByLoc).reduce((a, k) => a + v.hoursByLoc[k], 0);
ok('the per-shop total equals the per-person total', Math.abs(sumStaffHours - sumLocHours) < 0.5,
   sumStaffHours + ' vs ' + sumLocHours);
ok('CEO check-in hours are NOT in the shop labour total',
   r.summary.filter((s) => s.kind === 'ceo').every((s) => s.hours === 0 && s.visitHours > 0));
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
  ok('…and their real hourly rate', a && a.lines.some((l) => l.indexOf('66.67') >= 0),
     a && a.lines.join(' | '));
}
ok('somebody with no wage on file is told so, not shown NaN', (() => {
  const nw = M.STAFF.map((p) => (p.id === 'gus' ? Object.assign({}, p, { dailyRate: 0 }) : p));
  const rn2 = M.buildRoster(M.LOCS, nw, 2026, 9);
  const a = M.rosterAsk('gus', rn2, nw, M.LOCS);
  return a && a.lines.some((l) => /ยังไม่ได้ใส่เงินเดือน/.test(l));
})());
ok('a question it cannot answer returns null rather than a guess',
   ask('what is the weather in bangkok') === null);
ok('an empty question returns null', ask('') === null && ask('   ') === null);
ok('it never throws on a roster with nobody in it',
   M.rosterAsk('ค่าแรง', M.buildRoster(M.LOCS, [], 2026, 9), [], M.LOCS) !== undefined);

console.log(`\n${fail ? 'FAIL' : 'PASS'} — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
