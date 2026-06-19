/* ============================================================================
 * bracket.js — Builds the full knockout bracket from group results.
 *
 * R32 matchups come straight from the regulations (Article 12.6) + the official
 * Annexe C allocation of the 8 best thirds (WC_ALLOCATIONS). The R16 → Final
 * tree is Article 12.7–12.11.
 *
 * Knockout WINNERS are a projection: by default the better FIFA ranking
 * advances; the app may pass explicit picks (opts.knockoutPicks) to simulate.
 * R32 matchups themselves are exact per the regulations.
 * ==========================================================================*/

(function (global) {
  'use strict';

  // Round of 32 (Article 12.6). For third slots, `wThird` names the winner-group
  // whose Annexe-C entry gives the opponent; `pool` is shown before allocation.
  const R32 = [
    { no: 73, a: { t: 2, g: 'A' }, b: { t: 2, g: 'B' } },
    { no: 74, a: { t: 1, g: 'E' }, b: { t: 3, wThird: 'E', pool: 'ABCDF' } },
    { no: 75, a: { t: 1, g: 'F' }, b: { t: 2, g: 'C' } },
    { no: 76, a: { t: 1, g: 'C' }, b: { t: 2, g: 'F' } },
    { no: 77, a: { t: 1, g: 'I' }, b: { t: 3, wThird: 'I', pool: 'CDFGH' } },
    { no: 78, a: { t: 2, g: 'E' }, b: { t: 2, g: 'I' } },
    { no: 79, a: { t: 1, g: 'A' }, b: { t: 3, wThird: 'A', pool: 'CEFHI' } },
    { no: 80, a: { t: 1, g: 'L' }, b: { t: 3, wThird: 'L', pool: 'EHIJK' } },
    { no: 81, a: { t: 1, g: 'D' }, b: { t: 3, wThird: 'D', pool: 'BEFIJ' } },
    { no: 82, a: { t: 1, g: 'G' }, b: { t: 3, wThird: 'G', pool: 'AEHIJ' } },
    { no: 83, a: { t: 2, g: 'K' }, b: { t: 2, g: 'L' } },
    { no: 84, a: { t: 1, g: 'H' }, b: { t: 2, g: 'J' } },
    { no: 85, a: { t: 1, g: 'B' }, b: { t: 3, wThird: 'B', pool: 'EFGIJ' } },
    { no: 86, a: { t: 1, g: 'J' }, b: { t: 2, g: 'H' } },
    { no: 87, a: { t: 1, g: 'K' }, b: { t: 3, wThird: 'K', pool: 'DEIJL' } },
    { no: 88, a: { t: 2, g: 'D' }, b: { t: 2, g: 'G' } },
  ];

  // Feeders for later rounds (Article 12.7–12.11). Values are match numbers.
  const FEED = {
    89: [74, 77], 90: [73, 75], 91: [76, 78], 92: [79, 80],
    93: [83, 84], 94: [81, 82], 95: [86, 88], 96: [85, 87],
    97: [89, 90], 98: [93, 94], 99: [91, 92], 100: [95, 96],
    101: [97, 98], 102: [99, 100],
    104: [101, 102], // Final
  };

  // Column layout for display (tree-aligned where possible).
  const R32_ORDER = [74, 77, 73, 75, 76, 78, 79, 80, 83, 84, 81, 82, 86, 88, 85, 87];
  const R16_ORDER = [89, 91, 90, 92, 93, 95, 94, 96];
  const QF_ORDER = [97, 99, 98, 100];
  const SF_ORDER = [101, 102];

  function build(standings, thirdsRanked, teamsById, opts) {
    opts = opts || {};
    const complete = opts.groupComplete || {};      // { gid: true } when all 6 group matches have a result
    const allComplete = !!opts.allGroupsComplete;    // every group decided -> thirds + Annexe C are final

    const pos = (g, i) => {
      const r = standings.get(g);
      return r && r[i] ? r[i].team : null;
    };

    // Best-8 thirds + Annexe C from the CURRENT standings (provisional until the
    // whole group stage finishes, but always computable from the entered results).
    const qualGroups = thirdsRanked.filter((t) => t.qualifies).map((t) => t.group);
    const alloc = global.WC_ALLOCATIONS ? global.WC_ALLOCATIONS.allocate(qualGroups) : null;

    const T = global.WCI18N;
    const teamSlot = (team, seed, provisional) => ({
      id: team.id, name: T ? T.teamName(team) : team.name, flag: team.flag, seed, provisional,
    });

    // Fill each R32 slot from the current standings. A slot is "provisional"
    // (rendered with a dashed underline) while the group(s) it depends on are
    // not yet complete — the team there can still change. No winners are guessed.
    const i18n = (k, a) => (T ? (a !== undefined ? T.t(k, a) : T.t(k)) : k);

    function resolveR32(slot) {
      if (slot.t === 1) {
        const tm = pos(slot.g, 0);
        if (tm) return teamSlot(tm, '1' + slot.g, !complete[slot.g]);
        return { placeholder: i18n('ph_winner', slot.g), seed: '1' + slot.g };
      }
      if (slot.t === 2) {
        const tm = pos(slot.g, 1);
        if (tm) return teamSlot(tm, '2' + slot.g, !complete[slot.g]);
        return { placeholder: i18n('ph_runner', slot.g), seed: '2' + slot.g };
      }
      // third-placed slot (depends on the full cross-group ranking)
      if (alloc && alloc[slot.wThird]) {
        const tg = alloc[slot.wThird];
        const tm = pos(tg, 2);
        if (tm) return teamSlot(tm, '3' + tg, !allComplete);
      }
      return { placeholder: i18n('ph_third', slot.pool), seed: '3rd' };
    }

    const r32ByNo = {};
    R32.forEach((m) => {
      r32ByNo[m.no] = { home: resolveR32(m.a), away: resolveR32(m.b), meta: 'M' + m.no };
    });

    // Knockout ties just show which match feeds each slot — filled in only once
    // those matches are actually played (which is beyond the group-stage data).
    const feederTie = (no, label, extra) => {
      const [a, b] = FEED[no];
      return Object.assign({
        home: { placeholder: i18n('ph_wmatch', a) },
        away: { placeholder: i18n('ph_wmatch', b) },
        meta: label || ('M' + no),
      }, extra || {});
    };

    const r32 = (n) => r32ByNo[n];
    const finalTie = feederTie(104, i18n('final_meta'), { final: true });
    const thirdTie = {
      home: { placeholder: i18n('ph_lmatch', 101) },
      away: { placeholder: i18n('ph_lmatch', 102) },
      meta: i18n('third_meta'),
      small: true,
    };

    // Mirrored bracket: Round of 32 on both outer edges, converging inward to the
    // Final in the centre. Left half = Semi-final 1 (M101), right half = SF2 (M102).
    const rounds = [
      { title: i18n('round_r32'), ties: [74, 77, 73, 75, 83, 84, 81, 82].map(r32) },
      { title: i18n('round_r16'), ties: [89, 90, 93, 94].map((n) => feederTie(n)) },
      { title: i18n('round_qf'),  ties: [97, 98].map((n) => feederTie(n)) },
      { title: i18n('round_sf'),  ties: [101].map((n) => feederTie(n)) },
      { title: i18n('round_final'), center: true, ties: [finalTie, { spacer: true }, thirdTie] },
      { title: i18n('round_sf'),  mirror: true, ties: [102].map((n) => feederTie(n)) },
      { title: i18n('round_qf'),  mirror: true, ties: [99, 100].map((n) => feederTie(n)) },
      { title: i18n('round_r16'), mirror: true, ties: [91, 92, 95, 96].map((n) => feederTie(n)) },
      { title: i18n('round_r32'), mirror: true, ties: [76, 78, 79, 80, 86, 88, 85, 87].map(r32) },
    ];

    const decided = Object.keys(complete).filter((g) => complete[g]).length;
    const note = i18n(allComplete ? 'bracket_note_done' : 'bracket_note_live', decided);

    return { note, rounds };
  }

  global.WCBracket = { build, R32, FEED };
})(typeof window !== 'undefined' ? window : globalThis);
