#!/bin/bash
# BRYAN POS build pipeline — JSX source -> deployable index.html
# Requires: npm i -g esbuild   (or npx esbuild)
set -e
cd "$(dirname "$0")"
esbuild app.fixed.jsx --jsx=transform --target=es2017 --charset=ascii --outfile=app.compiled.js
cat head23.txt app.compiled.js foot.txt > index.html
cat testrun/head17.txt app.compiled.js testrun/foot.txt > testrun/test2.html
echo "built: index.html ($(wc -c < index.html) bytes)  +  testrun/test2.html (offline test harness)"
echo "deploy: commit index.html to github.com/bryank31172-web/dank-medical-pos-app (root) — Vercel auto-deploys"
