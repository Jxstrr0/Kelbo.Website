// =====================================================================
// US STOCK MARKET DAYS (shared by the Grader, the Forecaster and the
// Scorekeeper)
// ---------------------------------------------------------------------
// The NYSE's full-day holidays, worked out from the calendar so nothing
// needs updating each year. A holiday on a Saturday is taken the Friday
// before, on a Sunday the Monday after (except New Year's Day on a
// Saturday, which isn't moved back into December).
// =====================================================================

function easterSunday(year) {
  // The "anonymous Gregorian" method: gives month (3 or 4) and day.
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}
export function marketHolidays(year) {
  const ymd = (d) => d.toISOString().slice(0, 10);
  const date = (m, d) => new Date(Date.UTC(year, m - 1, d));
  // The nth weekday of a month (weekday 0 = Sunday); n = -1 for the last.
  const nth = (m, weekday, n) => {
    if (n > 0) {
      const first = date(m, 1);
      return date(m, 1 + ((weekday - first.getUTCDay() + 7) % 7) + 7 * (n - 1));
    }
    const last = new Date(Date.UTC(year, m, 0));
    return new Date(Date.UTC(year, m - 1, last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7)));
  };
  const observed = (d, newYears = false) => {
    const w = d.getUTCDay();
    if (w === 6) return newYears ? null : new Date(d.getTime() - 864e5);
    if (w === 0) return new Date(d.getTime() + 864e5);
    return d;
  };
  const goodFriday = new Date(easterSunday(year).getTime() - 2 * 864e5);
  return [
    observed(date(1, 1), true), // New Year's Day
    nth(1, 1, 3), // Martin Luther King Jr. Day: 3rd Monday of January
    nth(2, 1, 3), // Washington's Birthday: 3rd Monday of February
    goodFriday,
    nth(5, 1, -1), // Memorial Day: last Monday of May
    observed(date(6, 19)), // Juneteenth
    observed(date(7, 4)), // Independence Day
    nth(9, 1, 1), // Labor Day: 1st Monday of September
    nth(11, 4, 4), // Thanksgiving: 4th Thursday of November
    observed(date(12, 25)), // Christmas
  ].filter(Boolean).map(ymd);
}

// Is "2026-11-27" a day the US market is open (a weekday, not a holiday)?
export function isMarketDay(ymd) {
  const day = new Date(ymd + "T12:00:00Z").getUTCDay();
  return day !== 0 && day !== 6 && !marketHolidays(Number(ymd.slice(0, 4))).includes(ymd);
}

// "2026-11-07" plus n days, as "YYYY-MM-DD".
export function addDays(ymd, n) {
  return new Date(Date.parse(ymd + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
}
