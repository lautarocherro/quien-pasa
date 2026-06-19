/* ============================================================================
 * live.js — pulls live/finished scores from ESPN's public scoreboard API.
 *
 * The endpoint is CORS-open, so the browser can poll it directly. We map ESPN
 * team abbreviations (verified against all 48 WC teams) to our team ids and
 * report each event's state: 'pre' (scheduled), 'in' (live), 'post' (final).
 * ==========================================================================*/

(function (global) {
  'use strict';

  const API = (d) =>
    `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${d}`;

  // ESPN abbreviation -> our team id (verified against the live scoreboard).
  const ABBR2ID = {
    MEX: 'mex', RSA: 'rsa', KOR: 'kor', CZE: 'cze',
    CAN: 'can', BIH: 'bih', QAT: 'qat', SUI: 'sui',
    BRA: 'bra', MAR: 'mar', HAI: 'hai', SCO: 'sco',
    USA: 'usa', PAR: 'par', AUS: 'aus', TUR: 'tur',
    GER: 'ger', CUW: 'cuw', CIV: 'civ', ECU: 'ecu',
    NED: 'ned', JPN: 'jpn', SWE: 'swe', TUN: 'tun',
    BEL: 'bel', EGY: 'egy', IRN: 'irn', NZL: 'nzl',
    ESP: 'esp', CPV: 'cpv', KSA: 'ksa', URU: 'uru',
    FRA: 'fra', SEN: 'sen', IRQ: 'irq', NOR: 'nor',
    ARG: 'arg', ALG: 'alg', AUT: 'aut', JOR: 'jor',
    POR: 'por', COD: 'cod', UZB: 'uzb', COL: 'col',
    ENG: 'eng', CRO: 'cro', GHA: 'gha', PAN: 'pan',
  };

  function parseEvents(json) {
    const out = [];
    (json.events || []).forEach((e) => {
      const comp = e.competitions && e.competitions[0];
      if (!comp) return;
      const st = (e.status && e.status.type) || {};
      const scores = {};
      let ok = true;
      (comp.competitors || []).forEach((c) => {
        const abbr = ((c.team && c.team.abbreviation) || '').toUpperCase();
        const id = ABBR2ID[abbr];
        if (!id) { ok = false; return; }
        scores[id] = parseInt(c.score, 10) || 0;
      });
      const ids = Object.keys(scores);
      if (!ok || ids.length !== 2) return;
      out.push({
        id: String(e.id),
        a: ids[0],
        b: ids[1],
        scores: scores,
        state: st.state || 'pre',          // 'pre' | 'in' | 'post'
        detail: st.shortDetail || st.detail || '',
      });
    });
    return out;
  }

  // Extract per-team disciplinary breakdown from a match summary, applying the
  // FIFA "one deduction per player" rule: a red on an already-booked player is a
  // second-yellow (indirect) red; otherwise it's a straight red.
  // Returns { myTeamId: { yellow, secondYellowRed, directRed, yellowAndDirectRed } }.
  function parseCards(summary) {
    const espn2my = {};
    ((summary.boxscore && summary.boxscore.teams) || []).forEach((t) => {
      const my = ABBR2ID[((t.team && t.team.abbreviation) || '').toUpperCase()];
      if (my && t.team && t.team.id != null) espn2my[String(t.team.id)] = my;
    });
    const byTeam = {};       // my -> { athleteId -> {y, r} }
    let saw = false;
    (summary.keyEvents || []).forEach((e) => {
      const tp = e.type && e.type.type;
      if (tp !== 'yellow-card' && tp !== 'red-card') return;
      const my = espn2my[String(e.team && e.team.id)];
      if (!my) return;
      saw = true;
      const ath = (e.participants && e.participants[0] && e.participants[0].athlete &&
        e.participants[0].athlete.id) || ('n' + e.id);
      const rec = (byTeam[my] = byTeam[my] || {});
      const a = (rec[ath] = rec[ath] || { y: 0, r: 0 });
      if (tp === 'yellow-card') a.y++; else a.r++;
    });
    const out = {};
    Object.keys(byTeam).forEach((my) => {
      let yellow = 0, secondYellowRed = 0, directRed = 0;
      Object.keys(byTeam[my]).forEach((ath) => {
        const a = byTeam[my][ath];
        if (a.r > 0) { if (a.y > 0) secondYellowRed++; else directRed++; }
        else if (a.y > 0) yellow++;
      });
      out[my] = { yellow, secondYellowRed, directRed, yellowAndDirectRed: 0 };
    });
    // Fallback: no key events but boxscore has totals -> treat reds as direct.
    if (!saw) {
      ((summary.boxscore && summary.boxscore.teams) || []).forEach((t) => {
        const my = ABBR2ID[((t.team && t.team.abbreviation) || '').toUpperCase()];
        if (!my) return;
        const num = (n) => parseInt(((t.statistics.find((s) => s.name === n) || {}).displayValue) || '0', 10) || 0;
        const y = num('yellowCards'), r = num('redCards');
        if (y || r) out[my] = { yellow: y, secondYellowRed: 0, directRed: r, yellowAndDirectRed: 0 };
      });
    }
    return out;
  }

  async function fetchCards(eventId) {
    try {
      const r = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${eventId}`);
      if (!r.ok) return null;
      return parseCards(await r.json());
    } catch (e) { return null; }
  }

  // Poll a list of YYYYMMDD date strings; returns a flat list of match updates.
  async function pollDates(dates) {
    const all = [];
    await Promise.all(dates.map(async (d) => {
      try {
        const r = await fetch(API(d));
        if (!r.ok) return;
        const j = await r.json();
        parseEvents(j).forEach((u) => all.push(u));
      } catch (e) { /* offline / blocked — degrade gracefully */ }
    }));
    return all;
  }

  global.WCLive = { pollDates, fetchCards, parseCards, ABBR2ID };
})(typeof window !== 'undefined' ? window : globalThis);
