---
name: ship
description: Build, test, commit, push and publish ClinicWorks POS + website, then report the live links. Use when the user says ship, deploy, publish, push, ปล่อย, ขึ้นเว็บ, or asks for a link to the finished work.
---

# Ship ClinicWorks

One command from source to live, with the links at the end. Never skip the test
gate — a red sweep means do not push.

## 1 · Build

The deployed `index.html` at repo root is **compiled**. Never hand-edit it —
edit `pos/app.fixed.jsx`, then:

```bash
cd pos && bash build.sh
```

`esbuild` may not be on PATH. Fall back to:

```bash
cd pos
npx --yes esbuild app.fixed.jsx --jsx=transform --target=es2017 --charset=ascii --outfile=app.compiled.js
cat head23.txt app.compiled.js foot.txt > ../index.html
cat testrun/head17.txt app.compiled.js testrun/foot.txt > testrun/test2.html
rm app.compiled.js
```

`pos/app.compiled.js` and `pos/testrun/test2.html` are generated and gitignored —
never commit them.

## 2 · Test gate (blocking)

Run the sweep below. **Zero page errors is the bar.** If anything fails, fix it
and rebuild before going further — do not push a red build.

```js
// node with: /opt/node22/lib/node_modules/playwright
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const errs=[]; const b=await chromium.launch();
for (const [vp,tag] of [[{width:1280,height:900},'desktop'],[{width:430,height:932},'mobile']]) {
  const p=await b.newPage({viewport:vp});
  p.on('pageerror',e=>errs.push(`${tag}: ${e.message.slice(0,140)}`));
  await p.goto('file:///home/user/DANK-MEDICAL-POS-APP/pos/testrun/test2.html');
  await p.waitForTimeout(2200);
  for (const d of '110114') await p.click(`button:has-text("${d}")`).catch(()=>{});
  await p.waitForTimeout(1400);
  for (const code of ['th','en','zh','ja','my']) {          // every language
    await p.selectOption('select', code).catch(()=>{});
    await p.waitForTimeout(1400);
    // click tabs positionally so the sweep is language-agnostic
    const n=await p.evaluate(()=>{ window.__t=[...document.querySelectorAll('button')]
      .filter(b=>{const r=b.getBoundingClientRect();return r.top<210&&r.top>60&&r.width>30&&r.height>30;});
      return window.__t.length; });
    for (let i=0;i<Math.min(n,14);i++){
      await p.evaluate(i=>{const b=window.__t[i]; b&&b.click();},i).catch(()=>{});
      await p.waitForTimeout(360);
    }
  }
  await p.close();
}
console.log('ERRORS:', errs.length?errs:'none');
await b.close(); process.exit(errs.length?1:0);
```

Also load `clinicworks/index.html` and assert zero `pageerror` + zero console
errors — the loader must reach `.done`, and `svg.cwlogo` must be present.

Login PIN for the harness is **110114** (master / CEO).

## 3 · Commit and push

Always develop and push on the session's designated branch (never `main`
directly unless the user says so).

```bash
git add index.html pos/app.fixed.jsx pos/head23.txt pos/testrun/head17.txt clinicworks/
git commit -m "<what changed and why>"
git push -u origin <branch>
```

On network failure retry up to 4 times with backoff 2s, 4s, 8s, 16s.

## 4 · Publish

Vercel auto-deploys from `main`. So "published" means merged to `main`:

- If the user asked to publish/deploy → open a PR and merge it (squash or merge
  commit), then confirm `main` moved.
- If they only asked to push → stop after the push and say the change is on the
  branch, not yet live.

Ask before merging to `main` if the user has not already said publish/deploy —
merging is what makes it live for staff across all branches.

## 5 · Always end with the links

Every ship report ends with this block, filled in:

```
🔗 Links
• POS (live):      https://dank-medical-pos-app.vercel.app
• Website (live):  https://dank-medical-pos-app.vercel.app/clinicworks
• Branch:          https://github.com/bryank31172-web/DANK-MEDICAL-POS-APP/tree/<branch>
• PR:              <url, or "—">
• Commit:          <short sha> <subject>
```

State the test result plainly next to it: tabs swept, languages covered, error
count. If something was skipped or is still red, say so — do not round up to
"done".

## Reply style

The owner writes Thai/English mixed — reply in Thai, keep technical terms in
English.
