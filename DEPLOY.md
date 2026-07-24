# DANK BKK — one project, shop + POS together

This folder is the **whole thing**: the shop, the staff console, the Build Your
Joint page, the BRYAN POS app, and the `api/` folder that connects them.

Everything runs from one GitHub repo and one Vercel project.

| Address | What it is |
|---|---|
| `/` | The DANK BKK shop (customers) |
| `/pos.html` | BRYAN POS (staff, PIN protected) |
| `/staff.html` | Staff console — chats, orders, free gram, stock count |
| `/build-your-joint.html` | Build Your Joint |
| `/api/…` | The 35 files that make orders, menu sync, members and payments work |

---

## 1 · Upload every file to GitHub

Repo: **bryank31172-web/DANK-MEDICAL-POS-APP**

1. Unzip this folder somewhere you can see it.
2. Open the repo on github.com → **Add file** → **Upload files**.
3. Open the unzipped folder, press **Ctrl+A** (Windows) or **Cmd+A** (Mac) to
   select everything — the loose files **and** the `api` and `assets` folders —
   and drag the whole selection onto the upload page in one go.
4. Wait until the list on screen shows `api/` with files inside it. **If you
   don't see the `api` folder listed, stop and drag it in again** — that folder
   is the part that makes orders reach the POS, and it is the piece that went
   missing last time.
5. Commit.

Anything already in the repo with the same name is replaced automatically. If
there is an old `dank medical pos.zip` sitting in the repo, delete it — a zip
file does nothing on Vercel, only the unzipped files count.

## 2 · Set four things in Vercel

Vercel → your project → **Settings** → **Environment Variables**.

| Name | Value |
|---|---|
| `STAFF_KEY` | `DANK-STAFF-E03AACA4` |
| `UPSTASH_REDIS_REST_URL` | from your Upstash database |
| `UPSTASH_REDIS_REST_TOKEN` | from your Upstash database |
| `POS_APP_URL` | `https://dank-medical-pos-app.vercel.app` |

**The Upstash pair is not optional.** Without it an order can be taken by one
server and then asked for by a different one, and it disappears. Upstash has a
free plan: upstash.com → create a Redis database → copy the REST URL and REST
token.

Optional extras (`STOREHUB_TOKEN`, `LINE_CHANNEL_ACCESS_TOKEN`,
`GOOGLE_MAPS_API_KEY`, payment keys…) are listed with explanations in
`.env.example`. The shop works without them.

After saving, go to **Deployments** and redeploy, otherwise the new variables
aren't picked up.

## 3 · Put the staff key into the POS, once

Open `/pos.html` → Settings → **API / Website Integration**.

Under *Website URL* there is a **Staff Key** box. Paste
`DANK-STAFF-E03AACA4` into it and save. That is the only setting you need —
the POS now finds the website by itself, because they live at the same address.

(The *API KEY* box below it is a different thing and you can leave it empty.)

## 4 · Point the domain

Vercel → Settings → **Domains** → add `dankbkk.com` and `www.dankbkk.com`.
When that's done the shop is at dankbkk.com and the POS is at
dankbkk.com/pos.html.

---

## Check it's alive

- `/api/health` → shows `{"ok":true …}`
- `/api/menu-version` → after the POS has been open ~1 minute, `"source":"pos"`
- Place a test order on the shop, wait 30 seconds, look at the POS Orders tab.

## If orders still don't arrive

1. Open `/api/orders?key=DANK-STAFF-E03AACA4` in a browser.
   - `{"orders":[…]}` → the website has them, the problem is in the POS.
   - `401` → `STAFF_KEY` in Vercel doesn't match the key you typed.
   - `404` → the `api/` folder didn't upload. Back to step 1.
2. In the POS, check the Staff Key box actually has the key saved in it.
3. Check the Upstash variables are set and you redeployed after setting them.
