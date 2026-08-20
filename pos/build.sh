#!/bin/bash
# BRYAN POS build pipeline — JSX source -> deployable index.html
# Requires: npm i -g esbuild   (or npx esbuild)
set -e
cd "$(dirname "$0")"
# a global esbuild if there is one, otherwise fetch it on the fly, so the
# build works on a machine that has never installed it
if command -v esbuild >/dev/null 2>&1; then ESBUILD=(esbuild); else ESBUILD=(npx --yes esbuild); fi
"${ESBUILD[@]}" app.fixed.jsx --jsx=transform --target=es2017 --charset=ascii --outfile=app.compiled.js
cat head23.txt app.compiled.js foot.txt > index.html
cat testrun/head17.txt app.compiled.js testrun/foot.txt > testrun/test2.html
echo "built: index.html ($(wc -c < index.html) bytes)  +  testrun/test2.html (offline test harness)"
echo "deploy: commit index.html to github.com/bryank31172-web/dank-medical-pos-app (root) — Vercel auto-deploys"
