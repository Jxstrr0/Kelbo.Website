// Tests for the Longlight Passport (spec: .github/PASSPORT.md).
// Plain node:test, no packages. Run: node --test .github/scripts/passport.test.mjs
// The Site check runs it on every pull request.
//
// Covers the stamp code (passport/js/codec.js), the stamp check
// (passport/js/validate.js), the registry, and a guard that the Passport's
// code never puts text on the page as markup.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const Codec = require(join(ROOT, "passport/js/codec.js"));
const Check = require(join(ROOT, "passport/js/validate.js"));
const registry = JSON.parse(readFileSync(join(ROOT, "passport/registry.json"), "utf8"));
const IDS = registry.games.map((g) => g.id);
const TODAY = "2026-11-25";

// The example stamp from the spec (section 4).
const example = () => ({
  v: 1,
  game: "pew",
  ver: "1.76.142.2",
  updated: "2026-11-24",
  headline: "Race-team career, season 4",
  stats: [
    { id: "best_hp", label: "Best engine", value: 1140, unit: "hp" },
    { id: "wins_24h", label: "24-hour wins", value: 2 },
  ],
  flags: ["career_complete"],
});

const check = (raw) => Check.check(raw, IDS, { today: TODAY });

// Builds a code around any bytes with a correct checksum (to test what
// happens after the checksum passes).
async function codeAround(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const packed = new Uint8Array(await new Response(stream).arrayBuffer());
  const payload = Codec.toBase64Url(packed);
  return Codec.PREFIX + payload + "." + Codec.checksum(Codec.PREFIX + payload);
}

// ---- the code ----------------------------------------------------------------

test("base64url round-trips every length", () => {
  for (let n = 0; n < 40; n++) {
    const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) & 255);
    assert.deepEqual(Codec.fromBase64Url(Codec.toBase64Url(bytes)), bytes);
  }
});

test("checksum is 7 base-36 characters", () => {
  for (const text of ["", "LLP1.", "LLP1.abc", "x".repeat(500)]) assert.match(Codec.checksum(text), /^[0-9a-z]{7}$/);
  assert.notEqual(Codec.checksum("LLP1.a"), Codec.checksum("LLP1.b"));
});

test("a stamp survives encode and decode unchanged", async () => {
  const code = await Codec.encode(example());
  assert.match(code, /^LLP1\.[A-Za-z0-9_-]+\.[0-9a-z]{7}$/);
  assert.deepEqual(await Codec.decode(code), example());
});

test("what chat apps do to a link is undone", async () => {
  const code = await Codec.encode(example());
  const mid = Math.floor(code.length / 2);
  const messy = " " + code.slice(0, mid) + "\n​" + code.slice(mid) + " ";
  assert.deepEqual(await Codec.decode(messy), example());
  assert.deepEqual(await Codec.decode(encodeURIComponent(code)), example());
});

test("a damaged, cut-off or foreign code is refused with a plain message", async () => {
  const code = await Codec.encode(example());
  const flipped = code.slice(0, 10) + (code[10] === "A" ? "B" : "A") + code.slice(11);
  await assert.rejects(Codec.decode(flipped), { name: "CodecError", code: "damaged" });
  await assert.rejects(Codec.decode(code.slice(0, code.length - 3)), { name: "CodecError", code: "cut-off" });
  await assert.rejects(Codec.decode(code.slice(0, 20)), { name: "CodecError", code: "cut-off" });
  await assert.rejects(Codec.decode("LMB1.abc.0000000"), { name: "CodecError", code: "not-a-stamp" });
  await assert.rejects(Codec.decode(""), { name: "CodecError", code: "empty" });
  await assert.rejects(Codec.decode(null), { name: "CodecError", code: "empty" });
});

test("bytes that aren't JSON are refused after the checksum passes", async () => {
  await assert.rejects(Codec.decode(await codeAround("not json {")), { name: "CodecError", code: "damaged" });
  // A correct checksum around rubbish that isn't deflate at all.
  const payload = "AAAA_bad_";
  await assert.rejects(Codec.decode(Codec.PREFIX + payload + "." + Codec.checksum(Codec.PREFIX + payload)), { name: "CodecError" });
});

test("a code that unpacks to more than 2 KB is stopped (no zip bombs)", async () => {
  const bomb = await codeAround(JSON.stringify({ v: 1, pad: "0".repeat(200000) }));
  assert.ok(bomb.length < 4096, "the bomb is small when packed");
  await assert.rejects(Codec.decode(bomb), { name: "CodecError", code: "too-big" });
  await assert.rejects(Codec.decode("LLP1." + "A".repeat(20000) + ".0000000"), { name: "CodecError", code: "too-big" });
});

test("encode refuses a stamp over 2 KB", async () => {
  await assert.rejects(Codec.encode({ ...example(), headline: "x".repeat(3000) }), { name: "CodecError", code: "too-big" });
});

// ---- the stamp check ---------------------------------------------------------

test("the spec's example stamp passes", () => {
  const result = check(example());
  assert.equal(result.ok, true);
  assert.deepEqual(result.stamp, example());
});

test("unknown fields are dropped, text is trimmed", () => {
  const raw = { ...example(), seed: 12345, save: "PEW1:...", headline: "  Season 4  " };
  raw.stats = [{ ...raw.stats[0], colour: "red" }];
  const { ok, stamp } = check(raw);
  assert.equal(ok, true);
  assert.equal(stamp.seed, undefined);
  assert.equal(stamp.save, undefined);
  assert.equal(stamp.headline, "Season 4");
  assert.deepEqual(Object.keys(stamp.stats[0]).sort(), ["id", "label", "unit", "value"]);
});

test("a newer stamp version gets the friendly note", () => {
  const result = check({ ...example(), v: 2 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "newer");
  assert.match(result.message, /newer version of the Passport/);
});

const refusals = {
  "not an object": () => "a string",
  "an array": () => [],
  "no version number": () => ({ ...example(), v: undefined }),
  "v as text": () => ({ ...example(), v: "1" }),
  "an unknown game": () => ({ ...example(), game: "tetris" }),
  "a prototype as the game": () => ({ ...example(), game: "__proto__" }),
  "a version with letters": () => ({ ...example(), ver: "1.0<script>" }),
  "no version": () => ({ ...example(), ver: undefined }),
  "a date that isn't real": () => ({ ...example(), updated: "2026-02-30" }),
  "a date in another shape": () => ({ ...example(), updated: "24/11/2026" }),
  "a date years ahead": () => ({ ...example(), updated: "2031-01-01" }),
  "a headline over 60": () => ({ ...example(), headline: "x".repeat(61) }),
  "a headline that isn't text": () => ({ ...example(), headline: 42 }),
  "no stats": () => ({ ...example(), stats: [] }),
  "seven stats": () => ({ ...example(), stats: Array.from({ length: 7 }, (_, i) => ({ id: "s" + i, label: "L", value: i })) }),
  "a label over 32": () => ({ ...example(), stats: [{ id: "a", label: "x".repeat(33), value: 1 }] }),
  "an empty label": () => ({ ...example(), stats: [{ id: "a", label: "  ", value: 1 }] }),
  "a unit over 8": () => ({ ...example(), stats: [{ id: "a", label: "L", value: 1, unit: "horsepowr" }] }),
  "a text value over 24": () => ({ ...example(), stats: [{ id: "a", label: "L", value: "x".repeat(25) }] }),
  "a value that isn't a number": () => ({ ...example(), stats: [{ id: "a", label: "L", value: NaN }] }),
  "an infinite value": () => ({ ...example(), stats: [{ id: "a", label: "L", value: Infinity }] }),
  "a value that's an object": () => ({ ...example(), stats: [{ id: "a", label: "L", value: { x: 1 } }] }),
  "a stat id with capitals": () => ({ ...example(), stats: [{ id: "BestHP", label: "L", value: 1 }] }),
  "the same stat twice": () => ({ ...example(), stats: [{ id: "a", label: "L", value: 1 }, { id: "a", label: "M", value: 2 }] }),
  "nine flags": () => ({ ...example(), flags: Array.from({ length: 9 }, (_, i) => "f" + i) }),
  "a flag with spaces": () => ({ ...example(), flags: ["career complete"] }),
  "a control character": () => ({ ...example(), headline: "Season\u0007 4" }),
  "a right-to-left trick": () => ({ ...example(), headline: "Season ‮4" }),
  "more than 2 KB": () => ({ ...example(), extra: "x".repeat(2100) }),
};
for (const [name, make] of Object.entries(refusals)) {
  test(`refused: ${name}`, () => {
    const result = check(make());
    assert.equal(result.ok, false);
    assert.equal(typeof result.message, "string");
  });
}

test("text values and missing optional fields are fine", () => {
  const raw = { v: 1, game: "scrapline", ver: "0.1.68.5", updated: "2026-11-25", stats: [{ id: "title", label: "Open title", value: "Champion" }] };
  const { ok, stamp } = check(raw);
  assert.equal(ok, true);
  assert.equal(stamp.headline, undefined);
  assert.equal(stamp.flags, undefined);
});

test("tomorrow's date is allowed (time zones), the day after isn't", () => {
  assert.equal(check({ ...example(), updated: "2026-11-26" }).ok, true);
  assert.equal(check({ ...example(), updated: "2026-11-27" }).ok, false);
});

// ---- the replace rule ----------------------------------------------------------

test("versions compare number by number", () => {
  assert.equal(Check.compareVersions("1.10.0.0", "1.9.0.0"), 1);
  assert.equal(Check.compareVersions("1.2", "1.2.0.0"), 0);
  assert.equal(Check.compareVersions("0.1.68.4", "0.1.68.5"), -1);
});

test("a newer date or the same date with a newer version replaces; nothing else does", () => {
  const old = example();
  assert.equal(Check.isNewer(old, null), true);
  assert.equal(Check.isNewer({ ...old, updated: "2026-11-25" }, old), true);
  assert.equal(Check.isNewer({ ...old, ver: "1.76.143.0" }, old), true);
  assert.equal(Check.isNewer({ ...old }, old), false);
  assert.equal(Check.isNewer({ ...old, updated: "2026-11-23", ver: "9.0.0.0" }, old), false);
  assert.equal(Check.isNewer({ ...old, ver: "1.76.142.1" }, old), false);
});

// ---- the registry and the page code -----------------------------------------------

test("every registry entry has a unique id, a title and a stamp key", () => {
  assert.equal(new Set(IDS).size, IDS.length);
  for (const g of registry.games) {
    assert.match(g.id, /^[a-z0-9]+$/);
    assert.ok(g.title, `${g.id} has a title`);
    assert.ok(g.stampKey && /passport$/.test(g.stampKey), `${g.id} has a stamp key`);
    assert.ok(g.bridgeUrl === null || /^https:\/\/[a-z0-9-]+\.longlight\.games\//.test(g.bridgeUrl), `${g.id} bridge is null or a longlight.games address`);
  }
});

test("the Passport's code never writes markup and only touches kelbo.passport.* storage", () => {
  const files = ["passport/passport.js", ...readdirSync(join(ROOT, "passport/js")).map((f) => "passport/js/" + f)];
  for (const f of files.filter((f) => f.endsWith(".js"))) {
    const code = readFileSync(join(ROOT, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/, `${f} must put text on the page with textContent`);
    for (const m of code.matchAll(/["'](kelbo\.[^"']*)["']/g)) assert.ok(m[1].startsWith("kelbo.passport."), `${f} uses ${m[1]}`);
    assert.doesNotMatch(code, /localStorage\.clear|fetch\([^)]*(https?:)/, `${f} clears all storage or calls out`);
  }
});
