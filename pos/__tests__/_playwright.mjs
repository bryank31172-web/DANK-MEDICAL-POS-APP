/* The managed test image has moved Playwright between runtime directories.
 * Resolve a local install first, then known managed-runtime locations. */
const candidates=[
  'playwright',
  '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  '/opt/node22/lib/node_modules/playwright/index.mjs'
];
let api,lastError;
for(const specifier of candidates){
  try{api=await import(specifier);break;}catch(e){lastError=e;}
}
if(!api)throw lastError||new Error('Playwright is not installed');
export const chromium=api.chromium;
