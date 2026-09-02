const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "..", "app.fixed.jsx"), "utf8");

function openingButtonTags(text) {
  const tags = [];
  let cursor = 0;

  while ((cursor = text.indexOf("<button", cursor)) >= 0) {
    const start = cursor;
    let quote = "";
    let escaped = false;
    let braceDepth = 0;
    let foundEnd = false;

    for (cursor += 7; cursor < text.length; cursor += 1) {
      const character = text[cursor];

      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = "";
        continue;
      }

      if (character === '"' || character === "'" || character === "`") {
        quote = character;
      } else if (character === "{") {
        braceDepth += 1;
      } else if (character === "}") {
        braceDepth -= 1;
      } else if (character === ">" && braceDepth === 0) {
        tags.push({ start, text: text.slice(start, cursor + 1) });
        cursor += 1;
        foundEnd = true;
        break;
      }
    }

    // Ignore a literal "<button" inside a string/comment and keep scanning.
    if (!foundEnd) cursor = start + 7;
  }

  return tags;
}

const tags = openingButtonTags(source);
const inert = tags.filter(({ text }) =>
  !/\bonClick\s*=/.test(text) &&
  !/\btype\s*=\s*["']submit["']/.test(text)
);

if (tags.length < 500) {
  throw new Error(`Expected the full POS button surface; parsed only ${tags.length} buttons`);
}

if (inert.length) {
  const details = inert.map(({ start, text }) => {
    const line = source.slice(0, start).split("\n").length;
    return `line ${line}: ${text.slice(0, 180)}`;
  }).join("\n");
  throw new Error(`Found ${inert.length} button(s) without onClick or submit behavior:\n${details}`);
}

console.log(`PASS — ${tags.length} buttons have click or submit behavior`);
