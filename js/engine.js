/* ============================================================================
 * engine.js — FIFA 2026 World Cup standings + tiebreak engine
 *
 * Pure logic, no DOM. Implements the EXACT criteria from the official
 * "Regulations for the FIFA World Cup 26", Articles 12 & 13.
 *
 * WITHIN-GROUP RANKING (Article 13). Teams are first ranked by points.
 * Among teams LEVEL ON POINTS, in this order:
 *   Step 1 (head-to-head among the tied teams):
 *     a) points in matches between the tied teams
 *     b) goal difference in those matches
 *     c) goals scored in those matches
 *   Step 2: re-apply a–c to any still-tied subset; if still level, fall to
 *           overall statistics:
 *     d) overall goal difference
 *     e) overall goals scored
 *     f) team conduct (fair-play) score
 *   Step 3:
 *     g) most recent FIFA/Coca-Cola Men's World Ranking (then preceding editions)
 *
 *   NOTE — 2026 CHANGES vs 2022: head-to-head (a–c) now precedes overall goal
 *   difference, and "drawing of lots" has been REMOVED (final fallback is the
 *   FIFA World Ranking).
 *
 * THIRD-PLACED RANKING (Article 13): the 12 third-placed teams did not play one
 * another, so they are compared on OVERALL statistics only, in order:
 *   1) points  2) goal difference  3) goals scored
 *   4) team conduct score  5) FIFA World Ranking
 *
 * FAIR-PLAY / TEAM CONDUCT (negative; least-negative ranks higher; only ONE
 * deduction per player per match — the largest applicable):
 *   yellow = -1 · indirect red (two yellows) = -3 · direct red = -4 ·
 *   yellow + direct red = -5
 * ==========================================================================*/

(function (global) {
  'use strict';

  const FAIRPLAY = {
    yellow: -1,
    secondYellowRed: -3,
    directRed: -4,
    yellowAndDirectRed: -5,
  };

  function blankStats(teamId) {
    return {
      teamId,
      played: 0, won: 0, drawn: 0, lost: 0,
      gf: 0, ga: 0, gd: 0, points: 0,
      fairPlay: 0,          // conduct score (<= 0), the tiebreak value
      yellow: 0, red: 0,    // shown card counts (display)
    };
  }

  /**
   * Compute overall stats for every team from a set of matches.
   * matches: [{ home, away, homeGoals, awayGoals, played, cards? }]
   * Returns Map<teamId, stats>
   */
  function computeStats(matches, teamIds) {
    const table = new Map();
    teamIds.forEach((id) => table.set(id, blankStats(id)));

    for (const m of matches) {
      if (!table.has(m.home)) table.set(m.home, blankStats(m.home));
      if (!table.has(m.away)) table.set(m.away, blankStats(m.away));
      if (m.cards) applyCards(table, m.cards);
      if (!m.played) continue;

      const hg = +m.homeGoals || 0;
      const ag = +m.awayGoals || 0;
      const H = table.get(m.home);
      const A = table.get(m.away);

      H.played++; A.played++;
      H.gf += hg; H.ga += ag;
      A.gf += ag; A.ga += hg;

      if (hg > ag) { H.won++; H.points += 3; A.lost++; }
      else if (hg < ag) { A.won++; A.points += 3; H.lost++; }
      else { H.drawn++; A.drawn++; H.points++; A.points++; }
    }

    for (const s of table.values()) s.gd = s.gf - s.ga;
    return table;
  }

  function applyCards(table, cards) {
    for (const [teamId, c] of Object.entries(cards)) {
      if (!table.has(teamId)) table.set(teamId, blankStats(teamId));
      const s = table.get(teamId);
      const yellow = c.yellow || 0;
      const secondYellowRed = c.secondYellowRed || 0;
      const directRed = c.directRed || 0;
      const yellowAndDirectRed = c.yellowAndDirectRed || 0;
      s.fairPlay +=
        yellow * FAIRPLAY.yellow +
        secondYellowRed * FAIRPLAY.secondYellowRed +
        directRed * FAIRPLAY.directRed +
        yellowAndDirectRed * FAIRPLAY.yellowAndDirectRed;
      // Shown counts: a yellow+red player shows both a yellow and a red; a
      // second-yellow (indirect) red is counted as one red.
      s.yellow += yellow + yellowAndDirectRed;
      s.red += secondYellowRed + directRed + yellowAndDirectRed;
    }
  }

  /** Head-to-head sub-table among a subset of teams (matches between them only). */
  function headToHead(subsetIds, matches) {
    const set = new Set(subsetIds);
    const mini = new Map();
    subsetIds.forEach((id) => mini.set(id, { points: 0, gd: 0, gf: 0 }));
    for (const m of matches) {
      if (!m.played) continue;
      if (!set.has(m.home) || !set.has(m.away)) continue;
      const hg = +m.homeGoals || 0, ag = +m.awayGoals || 0;
      const H = mini.get(m.home), A = mini.get(m.away);
      H.gf += hg; A.gf += ag;
      H.gd += hg - ag; A.gd += ag - hg;
      if (hg > ag) H.points += 3;
      else if (hg < ag) A.points += 3;
      else { H.points++; A.points++; }
    }
    return mini;
  }

  const rankOf = (opts, id) => (opts && opts.fifaRank && opts.fifaRank[id]) || 999;

  /**
   * Rank teams within a single group using the full Article-13 procedure.
   * teamIds: ids in the group · statsMap: overall stats · groupMatches: matches
   * opts.fifaRank: { teamId -> number } (lower = better) used as the final tiebreak.
   * Returns ordered [{ stats, rank }].
   */
  function rankGroup(teamIds, statsMap, groupMatches, opts) {
    const teams = teamIds.map((id) => statsMap.get(id));
    // Primary: points descending. Ties (equal points) resolved per FIFA below.
    teams.sort((a, b) => b.points - a.points);

    const ordered = [];
    let i = 0;
    while (i < teams.length) {
      let j = i + 1;
      while (j < teams.length && teams[j].points === teams[i].points) j++;
      const cluster = teams.slice(i, j);
      if (cluster.length === 1) ordered.push(cluster[0]);
      else sortTiedOnPoints(cluster, groupMatches, opts).forEach((t) => ordered.push(t));
      i = j;
    }
    return ordered.map((s, idx) => ({ stats: s, rank: idx + 1 }));
  }

  /**
   * Resolve a set of teams level on points.
   * Step 1/2: head-to-head among them; recurse on still-tied proper subsets;
   * else fall to overall criteria (d,e,f) then FIFA ranking.
   */
  function sortTiedOnPoints(teams, matches, opts) {
    if (teams.length === 1) return teams;
    const ids = teams.map((t) => t.teamId);
    const h2h = headToHead(ids, matches);

    teams.sort((a, b) => {
      const ha = h2h.get(a.teamId), hb = h2h.get(b.teamId);
      if (ha.points !== hb.points) return hb.points - ha.points;
      if (ha.gd !== hb.gd) return hb.gd - ha.gd;
      if (ha.gf !== hb.gf) return hb.gf - ha.gf;
      return 0;
    });

    const out = [];
    let i = 0;
    while (i < teams.length) {
      let j = i + 1;
      while (j < teams.length && h2hTied(h2h.get(teams[i].teamId), h2h.get(teams[j].teamId))) j++;
      const sub = teams.slice(i, j);
      if (sub.length === 1) {
        out.push(sub[0]);
      } else if (sub.length === teams.length) {
        // Head-to-head did not separate anyone -> overall criteria are decisive.
        sortByOverall(sub, opts).forEach((t) => out.push(t));
      } else {
        // Proper subset still tied on H2H -> re-apply H2H to just this subset.
        sortTiedOnPoints(sub, matches, opts).forEach((t) => out.push(t));
      }
      i = j;
    }
    return out;
  }

  function h2hTied(a, b) {
    return a.points === b.points && a.gd === b.gd && a.gf === b.gf;
  }

  /** Overall criteria (d,e,f) then FIFA World Ranking. */
  function sortByOverall(teams, opts) {
    return teams.slice().sort((a, b) => {
      if (a.gd !== b.gd) return b.gd - a.gd;            // d) overall GD
      if (a.gf !== b.gf) return b.gf - a.gf;            // e) overall goals
      if (a.fairPlay !== b.fairPlay) return b.fairPlay - a.fairPlay; // f) conduct
      return rankOf(opts, a.teamId) - rankOf(opts, b.teamId);       // g) FIFA ranking
    });
  }

  /**
   * Rank the third-placed teams across all groups (OVERALL criteria only).
   * thirds: [{ group, stats }] · advancing: how many qualify (8).
   * Returns ordered array with rank + qualifies flag.
   */
  function rankThirds(thirds, advancing, opts) {
    const sorted = thirds.slice().sort((a, b) => {
      const A = a.stats, B = b.stats;
      if (A.points !== B.points) return B.points - A.points;
      if (A.gd !== B.gd) return B.gd - A.gd;
      if (A.gf !== B.gf) return B.gf - A.gf;
      if (A.fairPlay !== B.fairPlay) return B.fairPlay - A.fairPlay;
      return rankOf(opts, A.teamId) - rankOf(opts, B.teamId);
    });
    return sorted.map((t, idx) => ({ ...t, rank: idx + 1, qualifies: idx < advancing }));
  }

  /**
   * Mathematical elimination within a group. A team is "eliminated" when it can
   * no longer finish in the group's TOP 3 in any completion of the remaining
   * matches — i.e. it is guaranteed to finish 4th, so it can be neither a top-2
   * team nor a best third.
   *
   * Exact method: enumerate the remaining results AND scorelines that the team
   * cannot control, give the team uncapped wins in its own games (so it wins every
   * goal-based tiebreak it can still influence — this keeps the test from ever
   * producing a false positive), and rank each completion with the real Article-13
   * procedure. If the team never reaches the top 3 in any completion, it is out.
   * The full ranker is used (not a points/head-to-head shortcut), so eliminations
   * settled by head-to-head or overall goal difference are caught too.
   *
   * When the team cannot control too many matches to enumerate their scorelines,
   * fall back to a cheaper but still sound head-to-head-points test (this only
   * happens early in the group when nobody can actually be eliminated yet).
   *
   * Returns Set<teamId> of eliminated teams.
   */
  const ELIM_MAXG = 8;        // goal range (0..8) for the matches the team can't control
  const ELIM_BIGWIN = 50;     // the team's own wins dominate every goal-based tiebreak
  const ELIM_CAP = 20000;     // scenario ceiling before using the cheaper sound fallback

  function groupEliminated(teamIds, groupMatches, opts) {
    const out = new Set();
    for (const T of teamIds) {
      if (!canReachTop3(T, teamIds, groupMatches, opts)) out.add(T);
    }
    return out;
  }

  function splitMatches(T, groupMatches) {
    const fixed = [], tGames = [], others = [];
    for (const m of groupMatches) {
      if (m.played) fixed.push({ home: m.home, away: m.away, played: true, homeGoals: +m.homeGoals || 0, awayGoals: +m.awayGoals || 0 });
      else if (m.home === T || m.away === T) tGames.push(m);
      else others.push(m);
    }
    return { fixed, tGames, others };
  }

  function canReachTop3(T, teamIds, groupMatches, opts) {
    const { fixed, tGames, others } = splitMatches(T, groupMatches);
    const G = ELIM_MAXG + 1, per = G * G;
    const total = Math.pow(per, others.length);
    if (total > ELIM_CAP) return canReachTop3Optimistic(T, teamIds, fixed, tGames, others, opts);
    // The team wins its own remaining games by a dominant margin.
    const tWins = tGames.map((m) => ({ home: m.home, away: m.away, played: true,
      homeGoals: m.home === T ? ELIM_BIGWIN : 0, awayGoals: m.away === T ? ELIM_BIGWIN : 0 }));
    for (let s = 0; s < total; s++) {
      const sim = []; let x = s;
      for (let k = 0; k < others.length; k++) {
        const code = x % per; x = Math.floor(x / per);
        sim.push({ home: others[k].home, away: others[k].away, played: true, homeGoals: Math.floor(code / G), awayGoals: code % G });
      }
      const scenario = fixed.concat(tWins, sim);
      const stats = computeStats(scenario, teamIds);
      const ranked = rankGroup(teamIds, stats, scenario, opts);
      if (ranked[0].stats.teamId === T || ranked[1].stats.teamId === T || ranked[2].stats.teamId === T) return true;
    }
    return false;              // never reaches the top 3 -> eliminated
  }

  // Cheaper sound fallback (used only when there are too many uncontrolled matches
  // to enumerate scorelines — i.e. early in the group, where nobody is out yet).
  // Counts a rival as ahead only on points or head-to-head points; optimistic on
  // every goal-based tiebreak, so it never false-positives (may under-flag).
  function canReachTop3Optimistic(T, teamIds, fixed, tGames, others, opts) {
    const tWins = tGames.map((m) => ({ home: m.home, away: m.away, played: true,
      homeGoals: m.home === T ? 1 : 0, awayGoals: m.away === T ? 1 : 0 }));
    const combos = Math.pow(3, others.length);
    for (let c = 0; c < combos; c++) {
      const sim = []; let x = c;
      for (let k = 0; k < others.length; k++) {
        const o = x % 3; x = Math.floor(x / 3);
        sim.push({ home: others[k].home, away: others[k].away, played: true, homeGoals: o === 0 ? 1 : 0, awayGoals: o === 2 ? 1 : 0 });
      }
      const scenario = fixed.concat(tWins, sim);
      const stats = computeStats(scenario, teamIds);
      const ptsT = stats.get(T).points;
      const tiedIds = teamIds.filter((id) => stats.get(id).points === ptsT);
      const h2h = headToHead(tiedIds, scenario);
      const h2hT = h2h.get(T).points;
      let ahead = 0;
      for (const id of teamIds) {
        if (id === T) continue;
        const p = stats.get(id).points;
        if (p > ptsT || (p === ptsT && h2h.get(id).points > h2hT)) ahead++;
      }
      if (ahead <= 2) return true;
    }
    return false;
  }

  /**
   * Which of the top-2 group positions are LOCKED: a position is locked when only
   * one team can occupy it across every completion of the remaining matches
   * (results AND scorelines enumerated, ranked with the real Article-13 procedure).
   * Used to render a bracket slot solid instead of provisional once it's certain
   * (e.g. a team that has beaten both rivals has clinched 1st even mid-group).
   * Returns { p1: <teamId|null>, p2: <teamId|null> }.
   */
  function groupLockedTop2(teamIds, groupMatches, opts) {
    const fixed = [], remaining = [];
    for (const m of groupMatches) {
      if (m.played) fixed.push({ home: m.home, away: m.away, played: true, homeGoals: +m.homeGoals || 0, awayGoals: +m.awayGoals || 0 });
      else remaining.push(m);
    }
    const G = ELIM_MAXG + 1, per = G * G;
    const total = Math.pow(per, remaining.length);
    if (total > ELIM_CAP) return { p1: null, p2: null };
    const at1 = new Set(), at2 = new Set();
    for (let s = 0; s < total; s++) {
      const sim = []; let x = s;
      for (let k = 0; k < remaining.length; k++) {
        const code = x % per; x = Math.floor(x / per);
        sim.push({ home: remaining[k].home, away: remaining[k].away, played: true, homeGoals: Math.floor(code / G), awayGoals: code % G });
      }
      const scenario = fixed.concat(sim);
      const stats = computeStats(scenario, teamIds);
      const ranked = rankGroup(teamIds, stats, scenario, opts);
      at1.add(ranked[0].stats.teamId);
      at2.add(ranked[1].stats.teamId);
      if (at1.size > 1 && at2.size > 1) break;   // neither can be locked anymore
    }
    return {
      p1: at1.size === 1 ? [...at1][0] : null,
      p2: at2.size === 1 ? [...at2][0] : null,
    };
  }

  global.WCEngine = {
    FAIRPLAY,
    blankStats,
    computeStats,
    headToHead,
    rankGroup,
    rankThirds,
    groupEliminated,
    groupLockedTop2,
  };
})(typeof window !== 'undefined' ? window : globalThis);
