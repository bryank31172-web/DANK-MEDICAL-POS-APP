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
# The script cd's into pos/, so the bundle above lands at pos/index.html — and
# that file is gitignored build output. The one Vercel serves is the ROOT
# index.html, and it is committed. Leaving the copy to whoever ran the build
# meant a green test run against pos/testrun/test2.html could sit on top of a
# root index.html that was days older, with nothing to show anything was wrong.
cp index.html ../index.html
echo "built: pos/index.html ($(wc -c < index.html) bytes)  +  testrun/test2.html (offline test harness)"
echo "copied to repo root: index.html  <- this is the file that deploys"
echo "deploy: commit the ROOT index.html to github.com/bryank31172-web/dank-medical-pos-app — Vercel auto-deploys"
