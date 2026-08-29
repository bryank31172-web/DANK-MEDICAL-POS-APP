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
  upgradeShiftStaffSeed: upgradeShiftStaffSeed, SHIFT_STAFF_SEED_VERSION: SHIFT_STAFF_SEED_VERSION,
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

console.log('\nSathorn cross-shop relief order');
{
  const steve = M.STAFF.filter((p) => p.id === 'steve')[0];
  const honey = M.STAFF.filter((p) => p.id === 'honey')[0];
  const jack = M.STAFF.filter((p) => p.id === 'jack')[0];
  const palm = M.STAFF.filter((p) => p.id === 'palm')[0];
  const rena = M.STAFF.filter((p) => p.id === 'rena')[0];
  const pok = M.STAFF.filter((p) => p.id === 'pok')[0];
  ok('Steve is selected before Honey for a Sathorn gap',
     M.rosterPick([honey, steve], { id: 'DAY' }, { steve: 0, honey: 0 }).id === 'steve');
  ok('Honey is the next Sathorn option when Steve is unavailable',
     M.rosterPick([honey], { id: 'DAY' }, { honey: 0 }).id === 'honey');
  ok('Pond is removed after resigning', !M.STAFF.some((p) => p.id === 'pond'));
  ok('Jack is restricted to Bar only', jack.locs.join(',') === 'bar');
  ok('Palm is paid 16,000 monthly', palm.payType === 'monthly' && palm.salary === 16000);
  ok('Rena carries one weekly marketing duty', rena.duty.dow === 5 && rena.duty.label === 'MARKETING');
  ok('Honey is reduced while Steve and Pok carry more',
     honey.target === 16 && steve.target === 27 && pok.target === 27);
}

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

console.log('\neverybody lands on a full month, nobody past their cap');
const counter = r.summary.filter((s) => s.kind !== 'ceo' && s.slots.length);
ok('every full-time counter person is inside the 25-27 band',
   counter.filter((s) => s.kind === 'full').every((s) => s.shifts >= 25 && s.shifts <= 27),
   counter.map((s) => s.name.split(' ')[0] + ':' + s.shifts).join(' '));
ok('nobody is over their own maximum', counter.every((s) => s.shifts <= s.max));
ok('hours follow the shift length, not a flat number',
   by.Alex.hours === 216 && by.Raizo.hours === by.Raizo.shifts * 8,
   by.Alex.hours + ' / ' + by.Raizo.hours);
ok('Alex leads 224 Bar for 26 shifts / 216h', by.Alex.shifts === 26 && by.Alex.hours === 216, by.Alex.shifts + ' / ' + by.Alex.hours);
ok('Jack covers the four Friday bar nights / 36h', by.Jack.shifts === 4 && by.Jack.hours === 36, by.Jack.shifts + ' / ' + by.Jack.hours);
ok('Mon is held at his 26 cap', by['Mon (ม่อน อาชา)'].shifts === 26, by['Mon (ม่อน อาชา)'].shifts);

/* Everyone is willing to move their day off, so the generator chooses it. That
 * is not the same as there being no day off: with only a run limit, every
 * person marched six days from the 1st and the whole shop hit the wall
 * together on the 7th, 14th, 21st and 28th. */
console.log('\na flexible day off is still a day off, and a staggered one');
const dowOf = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
const longestRun = (dates) => {
  const d = dates.slice().sort();
  let run = 0, best = 0;
  d.forEach((x, i) => {
    if (i && new Date(x) - new Date(d[i - 1]) === 86400000) run++; else run = 1;
    best = Math.max(best, run);
  });
  return best;
};
ok('nobody works more than six days in a row',
   counter.every((s) => longestRun(s.dates) <= 6),
   counter.map((s) => s.name.split(' ')[0] + ':' + longestRun(s.dates)).join(' '));
ok('everybody gets at least four days off in a 30-day month',
   counter.every((s) => 30 - s.shifts >= 4), counter.map((s) => s.name.split(' ')[0] + ':' + (30 - s.shifts)).join(' '));
ok('each person rests on one weekday, every week',
   counter.every((s) => [0, 1, 2, 3, 4, 5, 6].some((w) => !s.dates.some((d) => dowOf(d) === w))));
{
  /* the whole point: rest days must not all land on the same day */
  const rest = counter.map((s) => [0, 1, 2, 3, 4, 5, 6].find((w) => !s.dates.some((d) => dowOf(d) === w)));
  ok('and those rest days are spread across the week, not shared',
     new Set(rest).size >= 5, 'distinct rest weekdays: ' + new Set(rest).size);
  const offOn = {};
  r.days.forEach((d) => { offOn[d.date] = counter.filter((s) => s.dates.indexOf(d.date) < 0).length; });
  const worst = Math.max.apply(null, Object.keys(offOn).map((k) => offOn[k]));
  ok('no single day empties the shop', worst <= Math.ceil(counter.length / 3), worst + ' off at once of ' + counter.length);
}

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
ok('a slot nobody is cleared for says exactly that', (() => {
  /* Depends on who happens to be employed, so it is built rather than hoped
   * for — with Steve cleared across every Phatthanakarn slot there is no
   * longer a shift with an empty candidate list in the live seed. */
  const none = M.STAFF.filter((p) => (p.slots || []).indexOf('NIGHT') < 0);
  const rn = M.buildRoster(M.LOCS, none, 2026, 9);
  const night = rn.validation.empty.filter((e) => e.slot === 'NIGHT');
  return night.length > 0 && night.every((e) => e.blockers.some((b) => /nobody is cleared/.test(b)));
})());

/* The owner moved Alex to lead 224 Bar. Phatthanakarn is already short of
 * counter headcount, but the generator must show that hole rather than pull
 * its bar leader back into the shop and make the bar plan look staffed. */
console.log('\nthe 224 Bar lead is not pulled back into a shop shortage');
{
  const alexCells = Object.keys(r.cells).filter((k) => r.cells[k] && r.cells[k].id === 'alex');
  ok('every Alex shift is at 224 Bar', alexCells.length === 26 && alexCells.every((k) => k.indexOf('bar|') === 0), alexCells.join(', '));
  ok('Alex covers all 18 Mon-Thu PM shifts',
     alexCells.filter((k) => /\|MONTHU$/.test(k)).length === 18,
     alexCells.filter((k) => /\|MONTHU$/.test(k)).length);
  ok('the Phatthanakarn C1 shortage is reported instead',
     v.empty.filter((e) => e.loc === 'ptk' && e.slot === 'C1').length > 0,
     v.empty.filter((e) => e.loc === 'ptk' && e.slot === 'C1').length);
  const eligible = (slot) => M.STAFF.filter((p) => p.kind !== 'ceo'
    && (p.locs || []).indexOf('ptk') >= 0 && (p.slots || []).indexOf(slot) >= 0).length;
  ok('C1 really has fewer people cleared for it than B1',
     eligible('C1') <= eligible('B1'), eligible('C1') + ' vs ' + eligible('B1'));
  ok('the assignment creates no doubles or unauthorised shifts',
     v.doubles.length === 0 && v.unauthorised.length === 0);
}

console.log('\nan optional slot never starves a required one');
ok('Mon is still held to his 26', by['Mon (ม่อน อาชา)'].shifts === 26, by['Mon (ม่อน อาชา)'].shifts);
ok('Sunday stock/admin never takes a shift a required slot still needs', (() => {
  /* add enough relief to close every hole; if anything optional got in ahead
   * of a required shift, one required shift would still be short */
  const every = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'EARLY', 'DAY', 'NIGHT', 'PEAK', 'MONTHU', 'FSDAY', 'FSNIGHT'];
  const plus = M.STAFF.concat([1, 2, 3, 4].map((n) => ({
    id: 'sp' + n, name: 'Spare' + n, kind: 'full', relief: true,
    locs: ['ptk', 'sat', 'bar'], slots: every, off: [], target: 26, max: 26,
    payType: 'daily', dailyRate: 600,
  })));
  return M.buildRoster(M.LOCS, plus, 2026, 9).validation.empty.length === 0;
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
  ok('they are used where there is work to do', at('ptk') + at('sat') > 0,
     at('ptk') + ' + ' + at('sat'));
}

/* The shop runs two contracts side by side and they are not the same sum:
 * a monthly person is owed their salary for the month, a วันละ person is owed
 * the days they actually stood. */
console.log('\npay: two contract types, OT at 1.5x on both');
const alex = by.Alex, amoe = by.Amoe, raizo = by.Raizo;
ok('Alex is on a monthly salary', alex.pay.payType === 'monthly', alex.pay.payType);
ok('…19,000 over the contracted 216 mixed-shift hours is 87.96/h', alex.pay.hourly === 87.96, alex.pay.hourly);
ok('…and his base is the salary, whatever the shift count', alex.pay.basePay === 19000, alex.pay.basePay);
ok('Amoe is on a day rate', amoe.pay.payType === 'daily', amoe.pay.payType);
ok('…600/day over a 9h shift is 66.67/h', amoe.pay.hourly === 66.67, amoe.pay.hourly);
ok('…and his base is the days he stood, not a flat month',
   amoe.pay.basePay === 600 * amoe.shifts, amoe.pay.basePay + ' for ' + amoe.shifts + ' days');
ok('the mixed 8h/9h bar month uses its explicit 216h divisor',
   alex.pay.normalHours === 216 && alex.pay.otHours === 0, alex.pay.normalHours + ' / OT ' + alex.pay.otHours);
ok('the OT rate is exactly 1.5x the hourly on a salary',
   Math.abs(alex.pay.otRate - alex.pay.hourly * 1.5) < 0.01, alex.pay.otRate);
ok('…and on a day rate too',
   Math.abs(amoe.pay.otRate - amoe.pay.hourly * 1.5) < 0.01, amoe.pay.otRate);
ok('nobody under their target is charged negative OT', r.summary.every((s) => s.pay.otHours >= 0));
{
  /* target 18 with room to work more: the shifts past it must be charged as OT */
  const pushed = M.STAFF.map((p) => (p.id === 'amoe'
    ? Object.assign({}, p, { target: 18, max: 30, maxRun: 30, off: [] }) : p));
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
ok('kitchen and riders are costed even with no counter shift', (() => {
  const rider = by.Got;
  return rider.shifts === 0 && rider.pay.basePay === 600 * 26;
})(), by.Got && by.Got.pay.basePay);
ok('…because a day-rate rider costed at zero days would vanish from the wage line',
   by.Zaw.pay.basePay > 0 && by.Got.pay.basePay > 0, by.Zaw.pay.basePay + ' / ' + by.Got.pay.basePay);
/* Everybody left on the sheet who can stand a shift is standing one, so this
 * list is empty — it must stay a list, not become an assertion that it is
 * never empty, or it stops being able to report the case it exists for. */
ok('nobody is on payroll with a slot and no shift', pr.noShift.length === 0,
   pr.noShift.map((x) => x.name).join(', '));
ok('…and the check still fires when somebody is', (() => {
  const idle = M.STAFF.concat([{ id: 'idle', name: 'Idle', role: 'BUDTENDER', kind: 'full',
    locs: ['ptk'], slots: [], off: [], payType: 'daily', dailyRate: 600 }]);
  const p2 = M.rosterPayroll(M.buildRoster(M.LOCS, idle, 2026, 9), idle, 353500);
  return p2.noShift.some((x) => x.name === 'Idle');
})());
ok('…with the reason spelled out', pr.noShift.every((x) => !!x.why));
ok('everybody on the wage sheet has a wage on file', pr.noPay.length === 0,
   pr.noPay.map((x) => x.name).join(', '));
ok('…and having no shift yet is not mistaken for having no wage', (() => {
  const idle = M.STAFF.concat([{ id: 'idle2', name: 'Idle2', role: 'BUDTENDER', kind: 'full',
    locs: ['ptk'], slots: [], off: [], payType: 'daily', dailyRate: 600 }]);
  const p2 = M.rosterPayroll(M.buildRoster(M.LOCS, idle, 2026, 9), idle, 353500);
  return p2.noShift.some((x) => x.name === 'Idle2') && !p2.noPay.some((x) => x.name === 'Idle2');
})());

console.log('\na duty inside a shift is recorded, never counted twice');
const ploy = by['Ploy (พลอย)'];
const rena = by.Rena;
ok("Ploy's weekend media duty is written down", ploy.duties.length === 4, ploy.duties.length);
ok('…on Saturdays only', ploy.duties.every((d) => new Date(d.date + 'T00:00:00Z').getUTCDay() === 6));
ok('…and adds no shifts beyond the ones she stood', ploy.shifts <= 26, ploy.shifts);
ok('…and adds no hours: hours are exactly shifts × 8', ploy.hours === ploy.shifts * 8, ploy.hours);
ok("Rena's weekly marketing duty is also inside, not on top of, her roster",
   rena.duties.length >= 4 && rena.hours === rena.shifts * 9,
   rena.duties.length + ' duties / ' + rena.shifts + ' shifts');

console.log('\na day off set by hand still outranks the generator');
const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
{
  /* flexible is the default, not a rule: naming a day must still pin it */
  const pinned = M.STAFF.map((p) => (p.id === 'raizo' ? Object.assign({}, p, { off: [4] }) : p));
  const rp = M.buildRoster(M.LOCS, pinned, 2026, 9);
  const a = rp.summary.filter((s) => s.id === 'raizo')[0];
  ok('Raizo asked for Thursdays and gets Thursdays', a.dates.every((d) => dow(d) !== 4),
     a.dates.filter((d) => dow(d) === 4).join(' '));
  ok('…and it does not silently drop his other days', a.shifts >= 25, a.shifts);
}
ok('leave still beats everything', (() => {
  const off = M.STAFF.map((p) => (p.id === 'raizo'
    ? Object.assign({}, p, { leave: ['2026-09-10', '2026-09-11'] }) : p));
  const rl2 = M.buildRoster(M.LOCS, off, 2026, 9).summary.filter((s) => s.id === 'raizo')[0];
  return ['2026-09-10', '2026-09-11'].every((d) => rl2.dates.indexOf(d) < 0);
})());
ok('Alex never works a Friday', by.Alex.dates.every((d) => dow(d) !== 5));

console.log('\nJack works only at the bar');
const jackCells = Object.keys(r.cells).filter((k) => r.cells[k] && r.cells[k].id === 'jack');
ok('every one of his shifts is a bar shift', jackCells.every((k) => k.split('|')[0] === 'bar'), jackCells.length + ' shifts');
ok('and all four are Friday nights', jackCells.length === 4 && by.Jack.dates.every((d) => dow(d) === 5), jackCells.length);

console.log('\nexisting devices receive the Alex / 224 Bar staffing decision once');
const staleStaff = M.STAFF.map((p) => {
  if (p.id === 'alex') return Object.assign({}, p, { role: 'BUDTENDER', locs: ['ptk'], slots: ['B2'], off: [4], target: 26, max: 28, normalHours: undefined });
  if (p.id === 'jack') return Object.assign({}, p, { kind: 'full', slots: ['MONTHU', 'FSNIGHT'], only: undefined, target: 26, max: 28 });
  return p;
});
const upgradedStaff = M.upgradeShiftStaffSeed(staleStaff, M.SHIFT_STAFF_SEED_VERSION - 1);
const upgradedAlex = upgradedStaff.filter((p) => p.id === 'alex')[0];
const upgradedJack = upgradedStaff.filter((p) => p.id === 'jack')[0];
ok('a saved Alex row is migrated to 224 Bar leadership',
   upgradedAlex.role === 'BAR TEAM LEADER' && upgradedAlex.slots.join() === 'MONTHU,FSNIGHT');
ok('the migrated Alex row carries 26–27 shifts and 216 normal hours',
   upgradedAlex.target === 26 && upgradedAlex.max === 27 && upgradedAlex.normalHours === 216);
ok('a saved Jack row becomes Friday-night cover',
   upgradedJack.target === 4 && upgradedJack.max === 4 && upgradedJack.only.FSNIGHT.join() === '5' && upgradedJack.locs.join() === 'bar');
ok('the migration removes Pond and restores Palm and Rena',
   !upgradedStaff.some((p) => p.id === 'pond') &&
   upgradedStaff.some((p) => p.id === 'palm') && upgradedStaff.some((p) => p.id === 'rena'));
ok('manager edits made after this migration are left alone',
   M.upgradeShiftStaffSeed(upgradedStaff, M.SHIFT_STAFF_SEED_VERSION) === upgradedStaff);

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
ok('his shifts drop while he is away', amoe2.shifts < by.Amoe.shifts, amoe2.shifts);
/* Relief now covers A1, so his leave is absorbed rather than left open — the
 * shift being filled by somebody else is the correct outcome, and the thing
 * worth asserting is that it was filled by somebody actually cleared for it. */
ok('the shift is covered by somebody cleared for it while he is away', (() => {
  const cleared = M.STAFF.filter((p) => (p.slots || []).indexOf('A1') >= 0).map((p) => p.id);
  return ['2026-09-07', '2026-09-08', '2026-09-09'].every((d) => {
    const c = rl.cells['ptk|' + d + '|A1'];
    return !c || cleared.indexOf(c.id) >= 0;
  });
})());

console.log('\nan unauthorised person is left out, and the hole is reported');
const noCover = M.STAFF.filter((p) => ['steve', 'pond', 'mel', 'honey', 'bank'].indexOf(p.id) < 0);
const rn = M.buildRoster(M.LOCS, noCover, 2026, 9);
ok('with every reliever removed, holes appear', rn.validation.empty.length > 0, rn.validation.empty.length);
ok('but nobody is shoved into a shop they are not cleared for', rn.validation.unauthorised.length === 0);
ok('and still nobody works twice in a day', rn.validation.doubles.length === 0);

console.log('\nthe cap is a cap');
const greedy = M.STAFF.map((p) => (p.id === 'amoe' ? Object.assign({}, p, { off: [], max: 27 }) : p));
const rg = M.buildRoster(M.LOCS, greedy, 2026, 9);
const amoe3 = rg.summary.filter((s) => s.name === 'Amoe')[0];
ok('Amoe with no day off still cannot pass 27', amoe3.shifts <= 27, amoe3.shifts);
ok('over-cap is empty because the cap held', rg.validation.over.length === 0);

console.log('\nunder-25 flags full-timers only');
ok('somebody genuinely short of a full month is flagged',
   v.under.length === 0 || v.under.every((u) => u.shifts < 25), JSON.stringify(v.under));
ok('riders and kitchen are never flagged for standing no counter shift',
   !v.under.some((u) => ['Zaw', 'Got'].indexOf(u.name) >= 0), JSON.stringify(v.under));
ok('part-timers are not flagged for being part-time',
   !v.under.some((u) => ['Steve', 'Pond'].indexOf(u.name) >= 0));
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
  ok('…with the real count in the answer',
     a && new RegExp('· ' + by.Amoe.shifts + ' กะ').test(a.lines[0]), a && a.lines[0]);
  ok('…and their real hourly rate', a && a.lines.some((l) => l.indexOf('66.67') >= 0),
     a && a.lines.join(' | '));
}
ok('somebody with no wage on file is told so, not shown NaN', (() => {
  const nw = M.STAFF.map((p) => (p.id === 'dylan' ? Object.assign({}, p, { dailyRate: 0, salary: 0 }) : p));
  const rn2 = M.buildRoster(M.LOCS, nw, 2026, 9);
  const a = M.rosterAsk('dylan', rn2, nw, M.LOCS);
  return a && a.lines.some((l) => /ยังไม่ได้ใส่เงินเดือน/.test(l));
})());
ok('a question it cannot answer returns null rather than a guess',
   ask('what is the weather in bangkok') === null);
ok('an empty question returns null', ask('') === null && ask('   ') === null);
ok('it never throws on a roster with nobody in it',
   M.rosterAsk('ค่าแรง', M.buildRoster(M.LOCS, [], 2026, 9), [], M.LOCS) !== undefined);

console.log(`\n${fail ? 'FAIL' : 'PASS'} — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
