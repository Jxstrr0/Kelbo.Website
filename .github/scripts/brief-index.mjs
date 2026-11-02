// The pre-market brief archive, split by month so no page ever downloads
// the whole list. premarket-brief.mjs calls updateIndex() after writing a
// brief; running this file on its own (node .github/scripts/brief-index.mjs)
// rebuilds the index from what's in briefs/ without adding anything.
//
// It writes:
//   briefs/index.json          { latest: {date, time, headline, tldr},
//                                months: [{ month: "2026-11", count: 14 }, ...] }
//                              newest first; small (about 15 bytes a month)
//   briefs/months/2026-11.json [{ date, time, headline, tldr }, ...] for that
//                              month, newest first; briefs.js loads one when
//                              its month is opened in the archive
//   briefs/latest.json         { date, time }: the only brief file every
//                              page fetches (the "new brief" dot)
// and keeps the folder under MAX_FOLDER_BYTES by removing the oldest briefs
// (git history still has them).

import { readFile, writeFile, mkdir, readdir, stat, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const BRIEFS_DIR = "briefs";
const MONTHS_DIR = `${BRIEFS_DIR}/months`;
// The briefs folder's size limit. At about 8 KB a brief this keeps roughly
// the last 15 years; older ones are removed from the folder and the
// archive, but stay in the repo's git history.
export const MAX_FOLDER_BYTES = 30 * 1024 * 1024;

const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

// Every archive entry on disk, in any order.
async function readEntries() {
  const index = await readJson(`${BRIEFS_DIR}/index.json`, null);
  // Before November 2026 index.json was the whole list in one file.
  if (Array.isArray(index)) return index;
  let files = [];
  try { files = await readdir(MONTHS_DIR); } catch { /* no months yet */ }
  const entries = [];
  for (const f of files.filter((f) => /^\d{4}-\d{2}\.json$/.test(f))) {
    const list = await readJson(`${MONTHS_DIR}/${f}`, []);
    if (Array.isArray(list)) entries.push(...list);
  }
  return entries;
}

// Adds newEntry (if given), trims the folder to size and rewrites the index.
export async function updateIndex(newEntry) {
  let entries = await readEntries();
  if (newEntry) entries.push(newEntry);

  // The brief files themselves, oldest first, with their sizes.
  await mkdir(BRIEFS_DIR, { recursive: true });
  const briefFiles = (await readdir(BRIEFS_DIR)).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort();
  const sizes = new Map();
  for (const f of briefFiles) sizes.set(f, (await stat(`${BRIEFS_DIR}/${f}`)).size);

  // One entry per date (the newest written wins), only for briefs that
  // exist, newest first.
  const byDate = new Map();
  for (const e of entries) {
    if (e && isDate(e.date) && sizes.has(`${e.date}.md`)) byDate.set(e.date, e);
  }
  if (newEntry) byDate.set(newEntry.date, newEntry);
  entries = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));

  // Keep the folder under its limit: drop the oldest briefs until it fits.
  // The index files are counted roughly (their JSON plus a little per file).
  const folderBytes = () =>
    [...sizes.values()].reduce((a, b) => a + b, 0) + Buffer.byteLength(JSON.stringify(entries, null, 2)) + 200 * 200;
  while (folderBytes() > MAX_FOLDER_BYTES && sizes.size > 1) {
    const oldest = sizes.keys().next().value; // names sort oldest first
    await unlink(`${BRIEFS_DIR}/${oldest}`);
    sizes.delete(oldest);
    entries = entries.filter((e) => `${e.date}.md` !== oldest);
    console.log(`Folder over ${MAX_FOLDER_BYTES / 1024 / 1024} MB: removed ${oldest} (still in git history).`);
  }
  console.log(`Briefs folder: ${sizes.size} briefs, about ${Math.round(folderBytes() / 1024)} KB of ${MAX_FOLDER_BYTES / 1024} KB.`);

  // Group by month ("2026-11"), newest first (entries are already sorted).
  const months = new Map();
  for (const e of entries) {
    const month = e.date.slice(0, 7);
    if (!months.has(month)) months.set(month, []);
    months.get(month).push(e);
  }

  await mkdir(MONTHS_DIR, { recursive: true });
  for (const [month, list] of months) {
    await writeFile(`${MONTHS_DIR}/${month}.json`, JSON.stringify(list, null, 2) + "\n");
  }
  // A month whose briefs have all been removed loses its file too.
  for (const f of await readdir(MONTHS_DIR)) {
    if (/^\d{4}-\d{2}\.json$/.test(f) && !months.has(f.slice(0, 7))) await unlink(`${MONTHS_DIR}/${f}`);
  }

  const latest = entries[0] || null;
  const index = {
    latest,
    months: [...months].map(([month, list]) => ({ month, count: list.length })),
  };
  await writeFile(`${BRIEFS_DIR}/index.json`, JSON.stringify(index, null, 2) + "\n");
  if (latest) {
    await writeFile(`${BRIEFS_DIR}/latest.json`, JSON.stringify({ date: latest.date, time: latest.time }) + "\n");
  }
  return entries;
}

// Run on its own: rebuild the index from the files in briefs/.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await updateIndex();
}
