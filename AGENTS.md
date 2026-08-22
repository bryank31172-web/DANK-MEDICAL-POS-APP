# AGENTS.md — BRYAN POS / ClinicWorks POS

Point-of-sale for Dank Cannabis Clinic Bangkok (Pattanakarn, Sathorn,
Petchaboon, Phuket, Bars). Live at https://dank-medical-pos-app.vercel.app —
Vercel deploys the default branch automatically.

`CLAUDE.md` in this repo is the long-form project brain: architecture, what is
already done, what is still pending. **Read it before making non-trivial
changes.** This file is the short version plus the rules that break the build
if you get them wrong.

**`docs/NEXT-FOR-CODEX.md` is the work queue** — what to pick up next, in
order, each with a measurable pass mark and a note on what is the owner's job
rather than a coding one.

---

## The one rule that matters most

**`index.html` at the repo root is a build artifact. Never edit it by hand.**

The source is `pos/app.fixed.jsx` — a single ~1.4MB ES5-style React file with
one component, `GreenPOS`. Edit the JSX, then rebuild:

```bash
bash pos/build.sh          # needs esbuild: npm i -g esbuild
npm run pos:build          # the same thing
```

The script is deliberately **not** called `build`. Vercel runs an npm `build`
script automatically if one exists, and esbuild is not installed on the build
image, so naming it that fails the deploy with exit 127. There is nothing to
build at deploy time — `index.html` is committed already compiled — and
`vercel.json` pins `buildCommand: ""` to say so.

That compiles the JSX and concatenates it into `index.html` (the deployed app)
and `pos/testrun/test2.html` (the offline test harness). A hand-edit to
`index.html` is silently destroyed by the next build.

`pos/app.compiled.js` and `pos/testrun/test2.html` are generated and
gitignored. Do not commit them. **Do commit `index.html`** — that is the
deploy.

---

## Working in app.fixed.jsx

The file has extremely long lines; whole-file reads and naive editors choke on
it. Work with `grep -n`, `sed -n 'X,Yp'`, and exact-string replacement that
asserts it matched exactly once:

```python
c = src.count(old); assert c == 1, f"anchor matched {c} times"
src = src.replace(old, new)
```

A replacement that silently matches twice corrupts the app in a way the build
will not catch.

---

## Tests

```bash
node api/__tests__/<name>.test.mjs      # all upstream calls are mocked, costs nothing
node pos/__tests__/<name>.test.cjs      # static analysis of the JSX
```

Browser tests (`bar-recipes`, `claim-pin`, `shift-checklist`) drive the harness
with Playwright and **need the app served over HTTP** — under `file://` the
app's `fetch("/api/...")` cannot resolve and every test fails for the wrong
reason:

```bash
bash pos/build.sh
python3 -m http.server 8799 &            # must serve the REPO ROOT
node pos/__tests__/shift-checklist.test.mjs
```

The harness login PIN is seeded by `pos/testrun/head17.txt` for the harness
only; it is not in the shipped bundle.

Shipping a change to the POS means: rebuild → Playwright sweep with zero
pageerror → commit `index.html`.

---

## Layout

| Path | What |
|---|---|
| `pos/app.fixed.jsx` | the POS, source of truth |
| `index.html` | compiled POS, deployed |
| `api/**` | serverless functions — **only this folder deploys** |
| `products.json` | 53-item curated catalogue, read by the POS *and* the customer site |
| `assets/products/` | product artwork; filename is the product `id` |
| `handoff/` | artwork brief + scripts for generating the remaining images |
| `docs/` | SOP deck, setup guide, image prompts |
| `clinicworks/`, `landing/` | separate static pages served at `/clinicworks`, `/landing` |

---

## Data and state

- Products and transactions come live from StoreHub through the
  `/api/storehub/*` proxy. Everything else lives in `localStorage` under keys
  prefixed `dank_` (staff, backstock, expenses, audit, customer extras).
- StoreHub stores `unitPrice` **ex-VAT**. `withVat()` in `api/_storehub.js`
  adds the 7% back. Skipping it quotes every price under the counter — that
  was a real bug, do not reintroduce it.
- `/api/grok` is the AI behind every 🤖 button. It accepts the Anthropic
  Messages shape the POS speaks and calls xAI underneath.
- Every mutation calls `addAudit(action, detail, user)`.
- `p.stock` is Active (sellable) stock; `backstock` in localStorage is
  Inactive. Received goods land in Inactive first.

---

## Non-negotiables

- **Never commit secrets.** StoreHub credentials, `STAFF_KEY`, `XAI_API_KEY`,
  `MASTER_PIN` and all staff PINs live only in Vercel environment variables.
  `.env.example` lists the full set of names. This repository is **public**.
- Do not weaken the auth on `/api/storehub/*`, `/api/staff-auth` or
  `/api/pos-feed`. Each rejects unauthenticated callers on purpose, and
  `pos-feed` in particular guards the ability to replace the entire shop
  catalogue including prices.
- Keep light text off light fills. `inkOn(bg, fg)` in the token layer exists
  because measuring the tabs turned up product names rendering at 1.05:1.
- An over-count in a stock check is a **mismatch**, not OK. Only an exact
  match is OK.
- The scale prints the exact weight. `0.039` stays `0.039` — do not round.

---

## Conventions

- The owner writes Thai mixed with English; reply in Thai and keep technical
  terms in English. UI strings are bilingual, Thai first.
- Commit messages explain *why*, in prose. The diff already shows what.
