/**
 * Time helpers — single source of truth for New York (Eastern) wall-clock time.
 *
 * Kill zones and ICT session windows are defined in ET (9:30 open, 4:00 close,
 * etc.). Previously these were hardcoded as fixed UTC offsets, which is only
 * correct during US daylight time (EDT). During standard time (EST, ~Nov–Mar)
 * every window was an hour off. Using Intl with timeZone 'America/New_York'
 * makes the wall-clock math correct year-round (it handles DST automatically).
 */

// Cache one formatter; constructing Intl.DateTimeFormat repeatedly is costly
// and these are called on the per-second tick path.
let _nyFmt = null;
function nyFormatter() {
  if (!_nyFmt) {
    try {
      _nyFmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      _nyFmt = null;
    }
  }
  return _nyFmt;
}

/**
 * Current New York wall-clock time as a decimal hour (e.g. 9:30 AM → 9.5,
 * 4:00 PM → 16.0). Correct across DST. Falls back to UTC decimal hour if the
 * Intl timezone lookup is unavailable in the environment.
 */
export function etHour(time = Date.now()) {
  const d = new Date(time);
  const fmt = nyFormatter();
  if (fmt) {
    try {
      const parts = fmt.formatToParts(d);
      let h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? 'NaN', 10);
      const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
      // hour12:false can render midnight as "24"; normalize to 0.
      if (h === 24) h = 0;
      if (Number.isFinite(h)) return h + (Number.isFinite(m) ? m / 60 : 0);
    } catch {
      /* fall through to UTC fallback */
    }
  }
  // Fallback: UTC decimal hour (better than crashing; only hit if Intl TZ fails).
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}
