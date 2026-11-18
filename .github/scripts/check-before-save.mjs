// Check before save.
//
// Each robot's workflow runs this after the robot has written its files
// and before they are saved (committed) to main:
//
//   node .github/scripts/check-before-save.mjs
//
// It runs the Site check (check-site.mjs, which holds the privacy scan)
// on the files as they are now, with the robot's new work in them.
//
//   No errors              -> fine, the workflow goes on and saves.
//   Errors the robot made  -> this script fails, so the workflow stops
//                             and nothing is saved. Everything in the
//                             repo is public for good, so text the
//                             privacy scan flags must never land in it.
//   Errors that were on    -> not the robot's doing, so it saves as usual
//   main already              (with a warning). Throwing its work away
//                             wouldn't fix anything.
//
// To tell the last two apart it makes a clean copy of main as it was
// before the robot wrote anything, runs the same check there, and only
// counts errors that are new.
//
// What it prints is public (run logs can be read by anyone), so it never
// prints the text an error is about: anything in "quotes" is hidden.
// Plain Node, no packages.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CHECK = resolve(".github/scripts/check-site.mjs");

// Runs the Site check in a folder and returns its error lines, each like
// "ERROR    briefs/2026-11-18.md: Looks like a phone number ...".
function errorsIn(folder) {
  let out = "";
  let failed = false;
  try {
    // GITHUB_ACTIONS is blanked so the check prints plain "ERROR ..."
    // lines instead of commands for GitHub; this script prints its own.
    out = execFileSync(process.execPath, [CHECK], { cwd: folder, encoding: "utf8", env: { ...process.env, GITHUB_ACTIONS: "" }, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    failed = true;
    out = String(e.stdout || "");
  }
  const errors = out.split("\n").filter((line) => line.startsWith("ERROR "));
  // The check stopped without naming an error: it broke, so don't guess.
  if (failed && !errors.length) throw new Error("the Site check itself stopped without finishing");
  return errors;
}

// One error line, made safe to print: on one line, quoted text hidden.
const hidden = (line) => line.replace(/^ERROR\s+/, "").replace(/[\r\n]+/g, " ").replace(/"[^"]*"/g, '"…"');

let now;
try {
  now = errorsIn(".");
} catch (e) {
  console.log(`::error title=Not saved::Couldn't run the Site check (${e.message}), so the robot's work was not saved.`);
  process.exit(1);
}
if (!now.length) {
  console.log("Site check passed, so the robot's work can be saved.");
  process.exit(0);
}

// There are errors. Which ones were already there? Check a clean copy of
// main without the robot's changes. ("git worktree" makes that copy.)
let before = [];
const copy = mkdtempSync(join(tmpdir(), "main-before-"));
try {
  execFileSync("git", ["worktree", "add", "--detach", "--force", copy, "HEAD"], { stdio: "pipe" });
  before = errorsIn(copy);
} catch (e) {
  // No clean copy to compare with: treat every error as new (the safe side).
  console.log("Couldn't check main as it was before this run, so every error counts as new.");
} finally {
  try { execFileSync("git", ["worktree", "remove", "--force", copy], { stdio: "pipe" }); } catch {}
  rmSync(copy, { recursive: true, force: true });
}

const fresh = now.filter((line) => !before.includes(line));
if (!fresh.length) {
  console.log(`::warning title=Site check::main already had ${now.length} problem(s) before this run. They aren't from this robot, so its work is saved as usual, but the site won't update until they are fixed.`);
  process.exit(0);
}

for (const line of fresh) console.log(`::error title=Not saved::${hidden(line)}`);
console.log(`The robot's new work has ${fresh.length} problem(s) the Site check won't let through, so it was NOT saved. Nothing new went into the repo or onto the site.`);
process.exit(1);
