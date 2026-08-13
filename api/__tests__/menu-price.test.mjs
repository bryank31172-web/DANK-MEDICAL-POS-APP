/* StoreHub returns unitPrice excluding VAT, so the ฿200 shelf price arrives as
 * 186.91588785046727. The menu feed used to pass that straight through and the
 * storefront quoted 7% under the counter — with the float tail still on it.
 * Caught live: /api/health was serving exactly these five numbers.
 *
 *   node api/__tests__/menu-price.test.mjs
 */
import { normalize, groupTiers, withVat } from "../_storehub.js";

let pass = 0, fail = 0;
const is = (got, want, note) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? "✓" : "✗"}  ${note}: got ${got}, want ${want}`);
};

// the exact values /api/health was serving in production
for (const [ex, shelf] of [
  [186.91588785046727, 200],
  [205.60747663551402, 220],
  [1682.2429906542054, 1800],
  [1401.8691588785045, 1500],
  [93.45794392523364, 100],
]) is(withVat(ex), shelf, `${ex} -> shelf price`);

is(withVat(0), 0, "zero stays zero");
is(withVat(undefined), 0, "missing price is not NaN");
is(withVat(null), 0, "null price is not NaN");

const p = normalize({ id: "x1", sku: "SKU1", name: "Crispy Boy lager Can", unitPrice: 205.60747663551402 }, {});
is(p.price, 220, "normalize() price is VAT-inclusive and round");
is(p.member, 198, "normalize() member price derives from the VAT-inclusive price");
is(Number.isInteger(p.price), true, "no float tail reaches the storefront");

// tiers are built from normalize()'s price, so they inherit the fix
const tiers = groupTiers([
  normalize({ id: "a", sku: "og-1g", name: "OG Kush 1g", unitPrice: 186.91588785046727, unit: "g" }, {}),
]);
is(tiers.length, 1, "grouping keeps the single product");
is(tiers[0].price, 200, "tier price is VAT-inclusive");

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
