// Robot Timer: a Cloudflare Worker that starts the robots on time.
//
// GitHub's own timers ("schedule:" in a workflow) ran 3.5 to 7 hours late in
// November 2026, so the Morning Writer's brief came after the open. This
// Worker wakes every 5 minutes (one Cloudflare Cron Trigger, "*/5 * * * *")
// and, when a robot's time in TIMETABLE comes up, asks GitHub to run that
// workflow now (the same as pressing "Run workflow"). GitHub starts it within
// seconds. The robots themselves don't change.
//
// This copy is the reference. The live one is pasted into the Cloudflare
// dashboard (Workers & Pages > robot-timer); keep the two the same.
//
// Secret: GH_TOKEN, a fine-grained GitHub token for this repo only with
// "Actions: Read and write". It lives only in the Worker's settings, never
// here, in a log or in a chat. It expires a year after it was made.
//
// Safe to run twice: every robot skips without calling Claude when its work
// for the day is already done, and each has a queue so two copies never run
// at once. That's why each robot can have a backup try.

const REPO = "Jxstrr0/Kelbo.Website";

// Times are UTC ("HH:MM", on a 5-minute mark) because Cloudflare's timer runs
// on UTC. Saskatoon is always UTC-6 (no clock change), so subtract 6 hours.
// Days: 0 = Sunday, 1 = Monday ... 6 = Saturday, also in UTC, so a Sunday
// evening in Saskatoon after 6 pm is already Monday here.
const TIMETABLE = [
  // Morning Writer (pre-market brief): 6:30 am, backup 7:15 am, Mon-Fri.
  { name: "Morning Writer", file: "premarket-brief.yml", days: [1, 2, 3, 4, 5], at: ["12:30", "13:15"] },
  // Grader (report card): 4:45 pm, backup 5:45 pm, Mon-Fri.
  { name: "Grader", file: "postmarket-recap.yml", days: [1, 2, 3, 4, 5], at: ["22:45", "23:45"] },
  // Sunday robots. The batch ones send at the first time and collect the
  // answer at a later one, a few hours on (batches are cheaper but slow).
  // Scorekeeper: 11:35 am, 1:15 pm, 5:45 pm Sunday.
  { name: "Scorekeeper", file: "journal-grade.yml", days: [0], at: ["17:35", "19:15", "23:45"] },
  // Coach: 11:45 am send, 5:25 pm collect, Sunday.
  { name: "Coach", file: "brief-lessons.yml", days: [0], at: ["17:45", "23:25"] },
  // Devlog Writer: 11:20 am send, 5:15 pm collect, Sunday.
  { name: "Devlog Writer", file: "devlog-draft.yml", days: [0], at: ["17:20", "23:15"] },
  // Forecaster: 7:45 pm send, 9:15 pm collect Sunday; 4:35 am Monday for a
  // batch that's still waiting. (All three are Monday in UTC.)
  { name: "Forecaster", file: "journal-forecast.yml", days: [1], at: ["01:45", "03:15", "10:35"] },
];

// Asks GitHub to run one workflow on main. Logs only the robot's name and
// whether GitHub said yes, never the token.
async function startRobot(robot, env) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${robot.file}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "robot-timer",
      },
      body: JSON.stringify({ ref: "main" }),
    }
  );
  // 204 (or 200 on newer API versions) means the run was started.
  console.log(`${robot.name}: ${res.ok ? "started" : `failed (${res.status})`}`);
}

export default {
  // Runs on the 5-minute timer. scheduledTime is the planned minute, so a
  // wake-up that's a few seconds late still matches its slot.
  async scheduled(controller, env, ctx) {
    const when = new Date(controller.scheduledTime);
    const day = when.getUTCDay();
    const hhmm = when.toISOString().slice(11, 16); // e.g. "12:30"
    const due = TIMETABLE.filter((r) => r.days.includes(day) && r.at.includes(hhmm));
    if (!env.GH_TOKEN) {
      if (due.length) console.log("GH_TOKEN secret is missing: nothing started");
      return;
    }
    ctx.waitUntil(Promise.all(due.map((r) => startRobot(r, env))));
  },

  // The Worker has no web page. Visiting its address does nothing.
  async fetch() {
    return new Response("Nothing here.", { status: 404 });
  },
};
