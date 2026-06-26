/* ============================================================================
 * app.js — UI rendering + real-time recalculation.
 *
 * Finished matches (data flag `finished: true`) hold real, locked results and
 * are not editable. Upcoming matches are edited freely by the user. Nothing is
 * randomised. Every edit recalculates standings, best thirds, and the bracket.
 *
 * Depends on: WCEngine (engine.js), WCDATA (data.js), WCBracket (bracket.js)
 * ==========================================================================*/

(function () {
  'use strict';

  const LS_KEY = 'wc2026-state-v2';  // v2: locked real results + user predictions
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // -------- State --------
  let MATCHES = [];            // mutable working copy
  let teamsById = new Map();
  let groupsById = new Map();
  const ENGINE_OPTS = () => ({ fifaRank: WCDATA.fifaRank });

  // Goal alerts (sound + desktop notification)
  let audioCtx = null;
  let alertsOn = (function () {
    try { return localStorage.getItem('wc2026-alerts') !== '0'; } catch (e) { return true; }
  })();

  // PWA install: capture the browser's install prompt (Chrome/Edge/Android).
  // Registered at load so it fires even before the Install tab is opened.
  let deferredPrompt = null;
  let installOutcome = null;            // 'done' | 'dismissed' | null
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    renderInstall();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installOutcome = 'done';
    renderInstall();
  });

  // teamId -> 3-letter code (e.g. mex -> MEX), for the compact bracket.
  const ID2CODE = (function () {
    const m = {};
    const t = (window.WCLive && window.WCLive.ABBR2ID) || {};
    Object.keys(t).forEach((ab) => { m[t[ab]] = ab; });
    return m;
  })();
  const codeFor = (id, name) => ID2CODE[id] || (name || '').slice(0, 3).toUpperCase();

  // i18n shortcuts
  const t = (...a) => (window.WCI18N ? window.WCI18N.t(...a) : a[0]);
  const tn = (team) => (window.WCI18N ? window.WCI18N.teamName(team) : team.name);

  // Fixtures view: ESPN data (kickoff time, venue, live state) keyed by team pair.
  const LIVE_FIX = {};
  const fixKey = (a, b) => [a, b].sort().join('-');
  let fixMode = (function () {
    try { return localStorage.getItem('wc2026-fixmode') === 'previous' ? 'previous' : 'upcoming'; }
    catch (e) { return 'upcoming'; }
  })();
  const openFix = new Set();   // fixKeys of finished games the user has expanded
  let fixSearch = '';          // fixtures country search query

  // Knockout simulation: { matchNo: winningTeamId } picked by the user.
  let knockoutPicks = (function () {
    try { return JSON.parse(localStorage.getItem('wc2026-knockout')) || {}; } catch (e) { return {}; }
  })();
  const saveKnockout = () => { try { localStorage.setItem('wc2026-knockout', JSON.stringify(knockoutPicks)); } catch (e) {} };
  let lastBracket = null;      // last built bracket (for the share image)

  function init() {
    WCDATA.groups.forEach((g) => {
      groupsById.set(g.id, g);
      g.teams.forEach((t) => teamsById.set(t.id, t));
    });
    if (window.WCI18N) document.documentElement.lang = window.WCI18N.lang();
    applyStaticI18n();
    loadState();
    bindUI();
    renderAll();
    renderInstall();
    startLive();
    loadFixtures();
  }

  // Translate static markup tagged with data-i18n / data-i18n-html.
  function applyStaticI18n() {
    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
    $$('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
  }

  // -------- Persistence --------
  function loadState() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) {}
    const base = WCDATA.matches.map((m) => ({ ...m }));
    const byId = saved && Array.isArray(saved.matches)
      ? new Map(saved.matches.map((m) => [m.id, m])) : new Map();
    MATCHES = base.map((m) => {
      if (m.finished) return m;          // real, locked result is authoritative
      const s = byId.get(m.id);          // restore the user's prediction, if any
      if (s && s.played) return { ...m, homeGoals: s.homeGoals, awayGoals: s.awayGoals, played: true };
      return m;
    });
  }
  // Clear the user's entered scores for upcoming matches (real and live results
  // are untouched), then re-render everything.
  function resetGroupPicks() {
    let changed = false;
    MATCHES.forEach((m) => {
      if (m.played && !m.finished && !m.live) {
        m.played = false; m.homeGoals = 0; m.awayGoals = 0; changed = true;
      }
    });
    if (!changed) return;
    renderAll();   // re-renders groups/thirds/bracket and persists the cleared state
  }

  // Persist only the user's predictions for non-finished matches.
  function saveState() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        matches: MATCHES.filter((m) => !m.finished && !m.live && m.played)
          .map((m) => ({ id: m.id, homeGoals: m.homeGoals, awayGoals: m.awayGoals, played: true })),
      }));
    } catch (e) {}
  }

  // -------- Computation --------
  function matchesForGroup(gid) {
    return MATCHES.filter((m) => m.group === gid);
  }

  /** Returns Map<gid, rankedArray> where each entry is { stats, rank, team }. */
  function computeGroupStandings() {
    const out = new Map();
    for (const g of WCDATA.groups) {
      const ids = g.teams.map((t) => t.id);
      const gm = matchesForGroup(g.id);
      const stats = WCEngine.computeStats(gm, ids);
      const ranked = WCEngine.rankGroup(ids, stats, gm, ENGINE_OPTS()).map((r) => ({
        ...r,
        team: teamsById.get(r.stats.teamId),
      }));
      out.set(g.id, ranked);
    }
    return out;
  }

  function computeThirds(standings) {
    const thirds = [];
    for (const g of WCDATA.groups) {
      const ranked = standings.get(g.id);
      const third = ranked[2];
      if (third) thirds.push({ group: g.id, stats: third.stats, team: third.team });
    }
    return WCEngine.rankThirds(thirds, WCDATA.advancingThirds, ENGINE_OPTS());
  }

  // Eliminated teams across the whole tournament: can't reach the group top 3, OR
  // can only reach 3rd but that 3rd can't be one of the 8 best thirds.
  function computeEliminated() {
    const groupList = WCDATA.groups.map((g) => ({
      id: g.id, teamIds: g.teams.map((tm) => tm.id), matches: matchesForGroup(g.id),
    }));
    return WCEngine.tournamentEliminated(groupList, { fifaRank: WCDATA.fifaRank, advancingThirds: WCDATA.advancingThirds });
  }

  // Monte Carlo chance each team reaches the Round of 32. Cached by a signature of
  // all results so the simulation only re-runs when something actually changes.
  let probCache = { sig: null, probs: null };
  function computeAdvanceProb() {
    const sig = MATCHES.map((m) => (m.played ? m.id + ':' + m.homeGoals + '-' + m.awayGoals : m.id + ':-')).join('|');
    if (probCache.sig === sig && probCache.probs) return probCache.probs;
    let seed = 1;
    for (let i = 0; i < sig.length; i++) seed = (seed * 31 + sig.charCodeAt(i)) | 0;
    const groupList = WCDATA.groups.map((g) => ({
      id: g.id, teamIds: g.teams.map((tm) => tm.id), matches: matchesForGroup(g.id),
    }));
    const probs = WCEngine.advanceProbabilities(groupList,
      { fifaRank: WCDATA.fifaRank, advancingThirds: WCDATA.advancingThirds }, 6000, seed >>> 0);
    probCache = { sig, probs };
    return probs;
  }

  // -------- Rendering --------
  function renderAll() {
    const standings = computeGroupStandings();
    const thirds = computeThirds(standings);
    renderGroups(standings, thirds);
    renderThirds(thirds);
    renderBracket(standings, thirds);
    renderRules();
    saveState();
  }

  const qualifiedSet = (thirds) =>
    new Set(thirds.filter((t) => t.qualifies).map((t) => t.group));

  function renderGroups(standings, thirds) {
    const grid = $('#groupsGrid');
    const qThirds = qualifiedSet(thirds);
    const dead = computeEliminated();
    const r32opp = computeR32Opponents(standings, thirds);
    grid.innerHTML = '';
    for (const g of WCDATA.groups) {
      const ranked = standings.get(g.id);
      const gm = matchesForGroup(g.id);
      const playedCount = gm.filter((m) => m.played).length;

      const card = document.createElement('div');
      card.className = 'group-card';
      card.dataset.group = g.id;
      card.innerHTML = `
        <div class="group-head">
          <span class="gname">${t('group_label')} ${g.id}</span>
          <span class="gmeta">${t('played_count', playedCount, gm.length)}</span>
        </div>
        <div class="std-scroll"><table class="standings">
          <thead><tr>
            <th class="left">${t('col_team')}</th>
            <th>${t('col_p')}</th><th>${t('col_w')}</th><th>${t('col_d')}</th><th>${t('col_l')}</th><th>${t('col_gf')}</th><th>${t('col_ga')}</th><th>${t('col_gd')}</th>
            <th title="${t('tip_yellow')}">🟨</th><th title="${t('tip_red')}">🟥</th><th>${t('col_pts')}</th>
            <th title="${t('tip_r32')}">${t('col_r32')}</th>
          </tr></thead>
          <tbody>
            ${standingsBody(ranked, g.id, qThirds, gm, dead, r32opp)}
          </tbody>
        </table></div>
        <div class="matches">
          ${gm.map((m) => matchRow(m)).join('')}
        </div>`;
      grid.appendChild(card);
    }
    // wire editable score inputs (finished matches are disabled)
    $$('.score-input:not([disabled])', grid).forEach((inp) => {
      inp.addEventListener('change', onScoreChange);
      inp.addEventListener('focus', (e) => e.target.select());
    });
    updateGroupsResetBtn();
  }

  // Enable the reset button only when the user has entered at least one prediction.
  function updateGroupsResetBtn() {
    const rb = $('#groupsReset');
    if (rb) rb.disabled = !MATCHES.some((m) => m.played && !m.finished && !m.live);
  }

  // Update standings tables in place WITHOUT rebuilding the match inputs, so a
  // value the user is typing isn't wiped while the match is still half-filled.
  function refreshStandings(standings, thirds) {
    const qThirds = qualifiedSet(thirds);
    const dead = computeEliminated();
    const r32opp = computeR32Opponents(standings, thirds);
    for (const g of WCDATA.groups) {
      const card = document.querySelector(`.group-card[data-group="${g.id}"]`);
      if (!card) continue;
      const ranked = standings.get(g.id);
      const gm = matchesForGroup(g.id);
      card.querySelector('.standings tbody').innerHTML = standingsBody(ranked, g.id, qThirds, gm, dead, r32opp);
      const meta = card.querySelector('.gmeta');
      if (meta) meta.textContent = t('played_count', gm.filter((m) => m.played).length, gm.length);
    }
  }

  // Replace a single match row in place (used by live updates), re-wiring its
  // inputs if it's now editable.
  function updateMatchRow(m) {
    const el = document.querySelector(`.match-row[data-match="${m.id}"]`);
    if (!el) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = matchRow(m);
    const fresh = tmp.firstElementChild;
    el.replaceWith(fresh);
    $$('.score-input:not([disabled])', fresh).forEach((inp) => {
      inp.addEventListener('change', onScoreChange);
      inp.addEventListener('focus', (e) => e.target.select());
    });
  }

  function standingsRow(r, i, gid, qThirds, dead, r32opp) {
    const s = r.stats;
    let cls = '';
    if (i === 0) cls = 'q-winner';
    else if (i === 1) cls = 'q-runner';
    else if (i === 2) cls = qThirds.has(gid) ? 'q-third' : 'eliminated';
    else cls = 'eliminated';
    const isDead = dead && dead.has(s.teamId);
    if (isDead) cls += ' dead';
    const rank = WCDATA.fifaRank[r.team.id];
    const tag = isDead ? `<span class="elim-tag" title="${t('elim_tip')}">${t('elim_tag')}</span>` : '';
    // R32 opponent: the team this side would play in the Round of 32 (provisional
    // from current standings), or ✗ for sides that aren't currently advancing.
    const opp = r32opp ? r32opp.get(s.teamId) : null;
    let r32cell;
    if (opp && opp.id) {
      r32cell = `<td class="r32"><span class="r32-flag" title="${t('fix_vs')} ${opp.name}${opp.seed ? ' · ' + opp.seed : ''}">${opp.flag || ''}</span></td>`;
    } else if (opp) {
      r32cell = `<td class="r32"><span class="r32-tbd" title="${opp.placeholder || ''}">?</span></td>`;
    } else {
      r32cell = `<td class="r32"><span class="r32-x" title="${t('r32_out')}">✗</span></td>`;
    }
    return `<tr class="${cls}">
      <td class="left"><div class="team-cell"><span class="pos">${i + 1}</span><span class="flag">${r.team.flag || ''}</span><span class="tname">${tn(r.team)}</span><span class="rank-chip" title="${t('tip_rk')}">#${rank}</span>${tag}</div></td>
      <td>${s.played}</td><td>${s.won}</td><td>${s.drawn}</td><td>${s.lost}</td>
      <td>${s.gf}</td><td>${s.ga}</td><td>${s.gd > 0 ? '+' + s.gd : s.gd}</td>
      <td class="ycard ${s.yellow ? 'has' : ''}">${s.yellow || 0}</td><td class="rcard ${s.red ? 'has' : ''}">${s.red || 0}</td>
      <td class="pts">${s.points}</td>
      ${r32cell}
    </tr>`;
  }

  // Why team A (above) ranks over team B (directly below), when level on points.
  // Follows FIFA Article 13: head-to-head first, then overall GD/goals/fair-play,
  // then FIFA ranking. Returns null when points differ (then it's just points).
  function groupEdge(aRow, bRow, ranked, gm) {
    const A = aRow.stats, B = bRow.stats;
    if (A.points !== B.points) return null;
    const f = (n) => (n > 0 ? '+' + n : '' + n);
    const cluster = ranked.filter((r) => r.stats.points === A.points).map((r) => r.stats.teamId);
    const H = WCEngine.headToHead(cluster, gm);
    const ha = H.get(A.teamId), hb = H.get(B.teamId);
    if (ha && hb) {
      if (ha.points !== hb.points) return t('gedge_h2h_pts', A.points, ha.points, hb.points);
      if (ha.gd !== hb.gd) return t('gedge_h2h_gd', A.points, f(ha.gd), f(hb.gd));
      if (ha.gf !== hb.gf) return t('gedge_h2h_gf', A.points, ha.gf, hb.gf);
    }
    if (cluster.length > 2) {   // re-apply head-to-head to just this pair's match
      const P = WCEngine.headToHead([A.teamId, B.teamId], gm);
      const pa = P.get(A.teamId), pb = P.get(B.teamId);
      if (pa && pb) {
        if (pa.points !== pb.points) return t('gedge_h2h_pts', A.points, pa.points, pb.points);
        if (pa.gd !== pb.gd) return t('gedge_h2h_gd', A.points, f(pa.gd), f(pb.gd));
        if (pa.gf !== pb.gf) return t('gedge_h2h_gf', A.points, pa.gf, pb.gf);
      }
    }
    if (A.gd !== B.gd) return t('gedge_gd', A.points, f(A.gd), f(B.gd));
    if (A.gf !== B.gf) return t('gedge_gf', A.gf, B.gf);
    if (A.fairPlay !== B.fairPlay) return t('gedge_fp', A.fairPlay, B.fairPlay);
    return t('gedge_rank', WCDATA.fifaRank[A.teamId], WCDATA.fifaRank[B.teamId]);
  }

  // Standings rows + a tiebreak note inserted between teams level on points.
  // `dead` is the tournament-wide eliminated set (computed once per render).
  function standingsBody(ranked, gid, qThirds, gm, dead, r32opp) {
    let html = '';
    ranked.forEach((r, i) => {
      html += standingsRow(r, i, gid, qThirds, dead, r32opp);
      const next = ranked[i + 1];
      if (next && r.stats.points === next.stats.points) {
        const why = groupEdge(r, next, ranked, gm);
        if (why) html += `<tr class="tb-row"><td colspan="12"><span class="tb-box">${why}</span></td></tr>`;
      }
    });
    return html;
  }

  // Map each team to the team it would face in the Round of 32 (provisional, from
  // current standings + Annexe C). Teams not currently advancing aren't in the map.
  function computeR32Opponents(standings, thirds) {
    const map = new Map();
    if (!window.WCBracket || !WCBracket.build) return map;
    const br = WCBracket.build(standings, thirds, teamsById, {});
    (br.rounds || []).forEach((round) => (round.ties || []).forEach((tie) => {
      if (!tie || tie.no == null || tie.no < 73 || tie.no > 88) return;   // R32 ties only
      if (tie.home && tie.home.id) map.set(tie.home.id, tie.away);
      if (tie.away && tie.away.id) map.set(tie.away.id, tie.home);
    }));
    return map;
  }

  function matchRow(m) {
    const h = teamsById.get(m.home), a = teamsById.get(m.away);
    const playedCls = m.played ? 'played' : '';
    // Finished and live scores are read-only (ESPN-fed); upcoming is editable.
    const dis = (m.finished || m.live) ? 'disabled' : '';
    let status, rowCls;
    if (m.finished) {
      status = `<span class="mstatus date">${fmtDate(m.date)}</span>`;  // show date, not empty
      rowCls = 'locked';
    } else if (m.live) {
      status = `<span class="mstatus live" title="Live now"><span class="livedot"></span>${m.minute || 'LIVE'}</span>`;
      rowCls = 'islive';
    } else {
      status = `<span class="mstatus date">${fmtDate(m.date)}</span>`;
      rowCls = '';
    }
    return `<div class="match-row ${rowCls}" data-match="${m.id}">
      <div class="side home"><span class="flag">${h.flag || ''}</span><span>${tn(h)}</span></div>
      <div class="score-box">
        <input class="score-input ${playedCls}" data-match="${m.id}" data-side="home" type="number" min="0" max="20" value="${m.played ? m.homeGoals : ''}" placeholder="-" ${dis} />
        <span class="score-sep">:</span>
        <input class="score-input ${playedCls}" data-match="${m.id}" data-side="away" type="number" min="0" max="20" value="${m.played ? m.awayGoals : ''}" placeholder="-" ${dis} />
      </div>
      <div class="side away"><span>${tn(a)}</span><span class="flag">${a.flag || ''}</span></div>
      ${status}
    </div>`;
  }

  // "Jun 24" / "24 jun" style; empty if no date.
  function fmtDate(d) {
    if (!d) return '';
    const parts = String(d).split('-');
    if (parts.length !== 3) return d;
    const mon = window.WCI18N ? window.WCI18N.month(+parts[1] - 1) : parts[1];
    const day = +parts[2];
    return window.WCI18N && window.WCI18N.lang() === 'es' ? `${day} ${mon}` : `${mon} ${day}`;
  }

  function onScoreChange(e) {
    const id = e.target.dataset.match;
    const side = e.target.dataset.side;
    const m = MATCHES.find((x) => x.id === id);
    if (!m || m.finished) return;
    const row = e.target.closest('.match-row');
    const inputs = $$('.score-input', row);
    const clamp = (v) => Math.max(0, Math.min(20, parseInt(v, 10) || 0));
    const hv = inputs.find((i) => i.dataset.side === 'home').value;
    const av = inputs.find((i) => i.dataset.side === 'away').value;
    // store whatever's entered; a match only "counts" once BOTH sides are filled
    m.homeGoals = hv === '' ? 0 : clamp(hv);
    m.awayGoals = av === '' ? 0 : clamp(av);
    m.played = hv !== '' && av !== '';
    // Light refresh: recompute the tables/bracket but leave the match inputs
    // (and the user's focus / half-typed value) untouched.
    const standings = computeGroupStandings();
    const thirds = computeThirds(standings);
    refreshStandings(standings, thirds);
    renderThirds(thirds);
    renderBracket(standings, thirds);
    updateGroupsResetBtn();
    saveState();
  }

  const sgn = (n) => (n > 0 ? '+' + n : '' + n);

  // Explain why team `a` is ranked above the team directly below it (`b`):
  // find the first criterion (per FIFA third-place order) on which they differ.
  function thirdEdge(a, b) {
    if (!b) return { text: '' };   // last row: nothing below to compare against
    const A = a.stats, B = b.stats;
    if (A.points !== B.points)
      return { text: t('edge_points', tn(b.team), A.points, B.points) };
    if (A.gd !== B.gd)
      return { text: t('edge_gd', A.points, sgn(A.gd), sgn(B.gd)) };
    if (A.gf !== B.gf)
      return { text: t('edge_gf', A.gf, B.gf) };
    if (A.fairPlay !== B.fairPlay)
      return { text: t('edge_fp', A.fairPlay, B.fairPlay) };
    const ra = WCDATA.fifaRank[a.team.id], rb = WCDATA.fifaRank[b.team.id];
    return { text: t('edge_rank', ra, rb) };
  }

  // A coloured Round-of-32 chance: red (low) → amber → green (high).
  function probCell(p) {
    p = p || 0;
    let pct;
    if (p <= 0) pct = 0; else if (p >= 1) pct = 100; else { pct = Math.round(p * 100); if (pct === 0) pct = 1; if (pct === 100) pct = 99; }
    const color = `hsl(${Math.round(p * 130)}, 70%, 60%)`;
    return `<span class="qpct" style="color:${color}" title="${t('tip_chance')}">${pct}%</span>`;
  }

  function renderThirds(thirds) {
    const note = $('#thirdsNote');
    const playedTotal = MATCHES.filter((m) => m.played).length;
    note.innerHTML = t('thirds_note', WCDATA.advancingThirds, playedTotal, MATCHES.length);
    const probs = computeAdvanceProb();

    const tbl = $('#thirdsTable');
    tbl.innerHTML = `
      <thead><tr>
        <th>#</th><th class="left">${t('col_team')}</th><th class="left">${t('col_grp')}</th>
        <th title="${t('tip_played')}">${t('col_p')}</th>
        <th>${t('col_pts')}</th><th>${t('col_gd')}</th><th>${t('col_gf')}</th><th>${t('col_ga')}</th>
        <th title="${t('tip_yellow')}">🟨</th><th title="${t('tip_red')}">🟥</th>
        <th title="${t('tip_fp')}">${t('col_fp')}</th>
        <th title="${t('tip_rk')}">${t('col_rk')}</th><th title="${t('tip_chance')}">${t('col_chance')}</th>
        <th class="left">${t('col_decisive')}</th>
      </tr></thead>
      <tbody>
        ${thirds.map((row, i) => {
          const s = row.stats;
          const isCut = i === WCDATA.advancingThirds - 1;
          const cut = isCut ? 'cutline' : '';
          const edge = thirdEdge(row, thirds[i + 1]);
          const edgeCls = (edge.muted ? 'muted' : '') + (isCut ? ' edge-cut' : '');
          return `<tr class="${row.qualifies ? 'in' : ''} ${cut}">
            <td class="rank-num">${row.rank}</td>
            <td class="left"><div class="team-cell"><span class="flag">${row.team.flag || ''}</span><span class="tname">${tn(row.team)}</span></div></td>
            <td class="left">${row.group}</td>
            <td class="pl pl${s.played >= 3 ? '3' : s.played === 2 ? '2' : '1'}" title="${t('tip_played')}">${s.played}</td>
            <td class="pts">${s.points}</td>
            <td>${s.gd > 0 ? '+' + s.gd : s.gd}</td>
            <td>${s.gf}</td><td>${s.ga}</td>
            <td class="ycard ${s.yellow ? 'has' : ''}">${s.yellow || 0}</td><td class="rcard ${s.red ? 'has' : ''}">${s.red || 0}</td>
            <td>${s.fairPlay}</td>
            <td>#${WCDATA.fifaRank[row.team.id]}</td>
            <td>${probCell(probs[row.team.id])}</td>
            <td class="left edge-cell">${edge.text ? `<span class="edge-box ${edgeCls}">${edge.text}</span>` : ''}</td>
          </tr>`;
        }).join('')}
      </tbody>`;
  }

  function renderBracket(standings, thirds) {
    const note = $('#bracketNote');
    // A group is "decided" once all its matches have a result (real or entered).
    // A group's R32 slots only become FINAL (solid) once all its matches are
    // real finished results; live/predicted scores keep them provisional.
    const groupComplete = {};
    const lockedPos = {};
    WCDATA.groups.forEach((g) => {
      const gm = matchesForGroup(g.id);
      groupComplete[g.id] = gm.every((m) => m.finished);
      // Positions that are already mathematically settled (e.g. a team that beat
      // both rivals has clinched 1st) — these render solid, not provisional.
      lockedPos[g.id] = WCEngine.groupLockedTop2(g.teams.map((t) => t.id), gm, ENGINE_OPTS());
    });
    const allGroupsComplete = Object.values(groupComplete).every(Boolean);
    const bracket = WCBracket.build(standings, thirds, teamsById, {
      groupComplete,
      allGroupsComplete,
      lockedPos,
      knockoutPicks,
    });
    lastBracket = bracket;                       // kept for the share image
    note.innerHTML = bracket.note || '';
    const container = $('#bracket');
    container.innerHTML = '';
    bracket.rounds.forEach((round) => {
      const col = document.createElement('div');
      col.className = 'round-col' + (round.center ? ' center' : '') + (round.mirror ? ' mirror' : '');
      // Title sits outside the box distribution so the match boxes can be evenly
      // spaced and line up with their feeders (a real bracket centres each match
      // between the two it feeds from).
      col.innerHTML = `<div class="round-title">${round.title}</div>` +
        `<div class="col-body">${round.ties.map((tie) => tieEl(tie)).join('')}</div>`;
      container.appendChild(col);
    });
    renderChampion(bracket.champion);
    const hasPicks = Object.keys(knockoutPicks).length > 0;
    const resetBtn = $('#bracketReset');
    if (resetBtn) resetBtn.disabled = !hasPicks;
  }

  function renderChampion(champ) {
    const el = $('#championBanner');
    if (!el) return;
    if (!champ) { el.hidden = true; el.innerHTML = ''; return; }
    const team = teamsById.get(champ.id);
    el.hidden = false;
    el.innerHTML = `<span class="champ-trophy">🏆</span><span class="champ-label">${t('champion')}</span>` +
      `<span class="champ-team"><span class="flag">${(team && team.flag) || ''}</span>${champ.name}</span>`;
  }

  // Recompute standings + thirds and redraw only the bracket (used after a pick).
  function rerenderBracket() {
    const standings = computeGroupStandings();
    renderBracket(standings, computeThirds(standings));
  }

  // -------- Share the bracket as an image --------
  const xesc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clip = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : (s || ''));

  // A PNG of the simulated bracket mirroring the on-screen layout: Round of 32 on
  // both outer edges converging inward to the Final (and champion) in the centre.
  function buildBracketSVG(bracket) {
    const FEED = WCBracket.FEED;
    const byNo = {}, colOf = {};
    // Column index = position of the round in the (mirrored) rounds list.
    (bracket.rounds || []).forEach((round, ci) => {
      round.ties.forEach((ti) => { if (ti && ti.no != null) { byNo[ti.no] = ti; colOf[ti.no] = ci; } });
    });
    // Both halves share the same 8 vertical rows (top R32 box of each side aligns).
    const rowIdx = {};
    [74, 77, 73, 75, 83, 84, 81, 82].forEach((n, i) => { rowIdx[n] = i; });
    [76, 78, 79, 80, 86, 88, 85, 87].forEach((n, i) => { rowIdx[n] = i; });

    const LEFT = 16, TOP = 100, COLW = 140, BOXW = 124, BOXH = 46, ROW = 52, NCOL = 9;
    const W = LEFT * 2 + (NCOL - 1) * COLW + BOXW;
    const H = TOP + 8 * ROW + 58;
    const centerY = TOP + 4 * ROW;          // the Final sits on the vertical centre
    const xOf = (no) => LEFT + colOf[no] * COLW;
    const yCache = {};
    const yOf = (no) => {
      if (yCache[no] != null) return yCache[no];
      let y;
      if (rowIdx[no] != null) y = TOP + rowIdx[no] * ROW + ROW / 2;
      else if (no === 103) y = centerY + 96;       // 3rd-place play-off, below the Final
      else { const f = FEED[no]; y = (yOf(f[0]) + yOf(f[1])) / 2; }
      return (yCache[no] = y);
    };
    const C = { bg: '#0b0f1a', panel: '#141d30', line: '#27324c', text: '#eaf0fb', muted: '#8d99b8', accent: '#1ed79a', gold: '#f6c558', winbg: 'rgba(30,215,154,0.16)' };
    const parts = [];
    // connectors (drawn first, under the boxes); direction depends on which side feeds in
    Object.keys(byNo).forEach((noStr) => {
      const no = +noStr, f = FEED[no];
      if (!f) return;
      const cc = colOf[no], cx = xOf(no), cy = yOf(no);
      f.forEach((fn) => {
        if (byNo[fn] == null) return;
        const fy = yOf(fn);
        const left = colOf[fn] < cc;                 // feeder to the left vs right of the child
        const x1 = left ? xOf(fn) + BOXW : xOf(fn);
        const x2 = left ? cx : cx + BOXW;
        const midx = (x1 + x2) / 2;
        parts.push(`<polyline points="${x1},${fy} ${midx},${fy} ${midx},${cy} ${x2},${cy}" fill="none" stroke="${C.line}" stroke-width="1.5"/>`);
      });
    });
    // boxes
    const drawBox = (no) => {
      const tie = byNo[no]; if (!tie) return;
      const x = xOf(no), y = yOf(no) - BOXH / 2;
      const isFinal = no === 104;
      parts.push(`<rect x="${x}" y="${y}" width="${BOXW}" height="${BOXH}" rx="7" fill="${C.panel}" stroke="${isFinal ? C.gold : C.line}" stroke-width="${isFinal ? 1.6 : 1}"/>`);
      const rowH = BOXH / 2;
      [tie.home, tie.away].forEach((s, i) => {
        const ry = y + i * rowH;
        const ty = ry + rowH / 2 + 4;
        const win = s && tie.winnerId && s.id === tie.winnerId;
        if (win) parts.push(`<rect x="${x + 1}" y="${ry + (i === 0 ? 1 : 0)}" width="${BOXW - 2}" height="${rowH - 1}" rx="5" fill="${C.winbg}"/>`);
        const label = s ? (s.placeholder ? s.placeholder : s.name) : '—';
        const flag = (s && s.flag) ? s.flag + ' ' : '';
        const col = win ? C.accent : (s && !s.placeholder ? C.text : C.muted);
        parts.push(`<text x="${x + 8}" y="${ty}" font-size="11.5" font-weight="${win ? '700' : '500'}" fill="${col}">${xesc(flag + clip(label, 15))}</text>`);
      });
    };
    Object.keys(byNo).forEach((n) => drawBox(+n));
    // header (centred) + footer
    const cxw = W / 2;
    const champ = bracket.champion;
    parts.unshift(`<rect width="${W}" height="${H}" fill="${C.bg}"/>`);
    parts.push(`<text x="${cxw}" y="38" font-size="20" font-weight="800" text-anchor="middle" fill="${C.text}">${xesc(t('share_title'))}</text>`);
    if (champ) {
      parts.push(`<text x="${cxw}" y="68" font-size="15" font-weight="700" text-anchor="middle" fill="${C.gold}">🏆 ${xesc(t('champion'))}: ${xesc((champ.flag || '') + ' ' + champ.name)}</text>`);
    } else {
      parts.push(`<text x="${cxw}" y="68" font-size="13" text-anchor="middle" fill="${C.muted}">${xesc(t('share_pickhint'))}</text>`);
    }
    parts.push(`<text x="${W - 16}" y="${H - 16}" font-size="12" font-weight="600" text-anchor="end" fill="${C.muted}">lautarocherro.github.io/quien-pasa</text>`);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">${parts.join('')}</svg>`;
    return { svg, w: W, h: H };
  }

  function bracketToPng() {
    const { svg, w, h } = buildBracketSVG(lastBracket || {});
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = 2;
          const canvas = document.createElement('canvas');
          canvas.width = w * scale; canvas.height = h * scale;
          const ctx = canvas.getContext('2d');
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          canvas.toBlob((png) => {
            if (!png) return reject(new Error('no blob'));
            resolve(new File([png], 'quien-pasa-bracket.png', { type: 'image/png' }));
          }, 'image/png');
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img load')); };
      img.src = url;
    });
  }

  function downloadBlob(file, name) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  let shareBusy = false;
  async function shareBracket() {
    if (shareBusy) return;
    shareBusy = true;
    const btn = $('#bracketShare');
    const label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = t('share_working'); }
    const url = location.href.split('#')[0];
    const text = t('share_text');
    let file = null;
    try { file = await bracketToPng(); } catch (e) { file = null; }
    try {
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        // Share the image only (the link is printed in its footer). Adding a URL
        // here makes "Copy" put both the image and a link-preview on the clipboard.
        await navigator.share({ files: [file] });
      } else if (navigator.share) {
        if (file) downloadBlob(file, 'quien-pasa-bracket.png');
        await navigator.share({ text: text, url: url });
      } else {
        if (file) downloadBlob(file, 'quien-pasa-bracket.png');
        try { await navigator.clipboard.writeText(url); } catch (e) {}
        if (btn) { btn.textContent = t('share_saved'); }
      }
    } catch (e) {
      // AbortError = user dismissed the share sheet; anything else falls back to a download.
      if (!(e && e.name === 'AbortError') && file) downloadBlob(file, 'quien-pasa-bracket.png');
    } finally {
      setTimeout(() => { if (btn) { btn.disabled = false; btn.textContent = label || t('share_btn'); } shareBusy = false; }, 1200);
    }
  }

  function tieEl(tie) {
    if (tie.spacer) return `<div style="height:18px"></div>`;
    const finalCls = tie.final ? 'final' : '';
    const slot = (s) => {
      if (!s) return `<div class="slot"><span class="tname tbd">—</span></div>`;
      if (s.placeholder) {
        return `<div class="slot"><span class="tname tbd">${s.placeholder}</span></div>`;
      }
      // Compact: flag + 3-letter code + seed; full name on hover. Clickable to pick
      // the winner (advances up the tree); the picked side is highlighted.
      const isWin = tie.winnerId && s.id === tie.winnerId;
      const pickable = tie.no != null;
      const title = s.provisional ? `${s.name} — provisional, can still change` : s.name;
      return `<div class="slot${isWin ? ' winner' : ''}${pickable ? ' pick' : ''}"${pickable ? ` data-match="${tie.no}" data-team="${s.id}"` : ''} title="${title}">
        <span class="flag">${s.flag || ''}</span>
        <span class="tname ${s.provisional ? 'prov' : ''}">${codeFor(s.id, s.name)}</span>
        <span class="seedlbl">${s.seed || ''}</span>
      </div>`;
    };
    return `<div class="tie ${finalCls}">
      ${slot(tie.home)}
      ${tie.away !== undefined ? slot(tie.away) : ''}
      ${tie.meta ? `<div class="meta">${tie.meta}</div>` : ''}
    </div>`;
  }

  function renderRules() {
    const el = $('#rulesBody');
    if (el.dataset.done) return;
    el.dataset.done = '1';
    el.innerHTML = t('rules_html');
  }

  // -------- Install (PWA) --------
  function isStandalone() {
    const mm = window.matchMedia;
    const installed = mm && ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay']
      .some((m) => mm('(display-mode: ' + m + ')').matches);
    return installed || window.navigator.standalone === true;
  }
  function platform() {
    const ua = (navigator.userAgent || '').toLowerCase();
    const iOS = /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (iOS) return 'ios';
    if (/android/.test(ua)) return 'android';
    return 'desktop';
  }
  function platCard(plat, primary) {
    return `<div class="ins-plat${primary ? ' is-primary' : ''}">
      <h4>${t('install_' + plat + '_title')}</h4>
      <ol class="ins-steps">
        <li>${t('install_' + plat + '_1')}</li>
        <li>${t('install_' + plat + '_2')}</li>
        <li>${t('install_' + plat + '_3')}</li>
      </ol>
    </div>`;
  }

  function renderInstall() {
    const el = $('#installBody');
    if (!el) return;

    let head = '';
    if (installOutcome === 'done') {
      head = `<div class="ins-state ok">${t('install_done')}</div>`;
    } else if (isStandalone()) {
      head = `<div class="ins-state ok">${t('install_already')}</div>`;
    } else if (deferredPrompt) {
      head = `<button id="doInstall" class="ins-cta">${t('install_btn')}</button>`;
    } else if (installOutcome === 'dismissed') {
      head = `<div class="ins-state">${t('install_dismissed')}</div>`;
    }

    const why = `<div class="ins-why">
      <h4>${t('install_why')}</h4>
      <ul><li>${t('install_why_1')}</li><li>${t('install_why_2')}</li><li>${t('install_why_3')}</li></ul>
    </div>`;

    // Manual fallback: detected platform first, the rest tucked behind a toggle.
    const order = [platform()].concat(['ios', 'android', 'desktop'].filter((p) => p !== platform()));
    const intro = deferredPrompt ? t('install_manual_intro') : t('install_manual_intro_nobtn');
    const installed = isStandalone() || installOutcome === 'done';
    const manual = installed ? '' : `<div class="ins-manual">
      <p class="ins-mi">${intro}</p>
      ${platCard(order[0], true)}
      <details class="ins-other">
        <summary>${t('install_other_platforms')}</summary>
        ${order.slice(1).map((p) => platCard(p, false)).join('')}
        <p class="ins-note">${t('install_unsupported')}</p>
      </details>
    </div>`;

    el.innerHTML = head + why + manual;
    const btn = $('#doInstall', el);
    if (btn) btn.addEventListener('click', doInstall);
  }

  async function doInstall() {
    if (!deferredPrompt) { renderInstall(); return; }
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      installOutcome = (choice && choice.outcome === 'accepted') ? 'done' : 'dismissed';
    } catch (e) {
      installOutcome = null;          // API error (not a user choice) — just show manual steps
    }
    deferredPrompt = null;            // the prompt can only be used once
    renderInstall();
  }

  // -------- Live scores (ESPN) --------
  // Poll a contiguous range covering every not-yet-final match, padded by a day
  // on each end so a timezone difference in ESPN's date bucketing can't hide a
  // game. The range shrinks from the front as earlier matches finish.
  function liveDates() {
    const ds = MATCHES.filter((m) => !m.finished).map((m) => m.date).sort();
    if (!ds.length) return [];
    const start = new Date(ds[0] + 'T00:00:00');
    const end = new Date(ds[ds.length - 1] + 'T00:00:00');
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() + 1);
    const out = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      out.push(`${y}${m}${day}`);
    }
    return out;
  }

  const mark = (arr, m) => { if (!arr.includes(m)) arr.push(m); };

  // Set a match's cards from ESPN's { myTeamId: breakdown }. Returns true if changed.
  function applyCardsToMatch(m, byId) {
    if (!byId) return false;
    const next = {};
    [m.home, m.away].forEach((id) => { if (byId[id]) next[id] = byId[id]; });
    if (!Object.keys(next).length) return false;
    if (JSON.stringify(next) === JSON.stringify(m.cards || {})) return false;
    m.cards = next;
    return true;
  }

  // Poll ESPN: live games show their current score + cards, final games lock.
  // Locked results (hardcoded MD1 or already-final) are never touched. Only
  // changed rows re-render, so a prediction you're typing elsewhere is undisturbed.
  async function pollLive() {
    if (!window.WCLive) return;
    let updates;
    try { updates = await window.WCLive.pollDates(liveDates()); }
    catch (e) { return; }

    const changed = [];
    const goals = [];                          // live matches whose score went up
    const cardJobs = [];
    updates.forEach((u) => {
      const m = MATCHES.find((x) =>
        (x.home === u.a && x.away === u.b) || (x.home === u.b && x.away === u.a));
      if (!m || m.finished) return;            // leave locked results alone
      const hg = u.scores[m.home], ag = u.scores[m.away];
      const wasLive = m.live === true;         // only alert once we have a baseline
      const prevTotal = (m.homeGoals || 0) + (m.awayGoals || 0);
      if (u.state === 'post') {
        m.finished = true; m.live = false; m.played = true;
        m.homeGoals = hg; m.awayGoals = ag; m.minute = null;
        mark(changed, m);
      } else if (u.state === 'in') {
        if (!m.live || m.homeGoals !== hg || m.awayGoals !== ag || m.minute !== u.detail) {
          m.live = true; m.played = true;
          m.homeGoals = hg; m.awayGoals = ag; m.minute = u.detail;
          mark(changed, m);
        }
      }
      if (wasLive && (hg + ag) > prevTotal) goals.push(m);   // GOAL while we were watching
      // Refresh the fixtures entry now (fresh scoreboard data) so detail can attach.
      if (u.home && u.away) {
        const k = fixKey(u.home, u.away);
        const prev = LIVE_FIX[k];
        if (prev) { u.events = prev.events; u.stats = prev.stats; }  // keep last detail until refetched
        LIVE_FIX[k] = u;
      }
      // Pull cards (live + just-finished) and full detail (live only).
      if ((u.state === 'in' || u.state === 'post') && u.id) {
        cardJobs.push(window.WCLive.fetchMatchDetail(u.id).then((det) => {
          if (!det) return;
          if (applyCardsToMatch(m, det.cards)) mark(changed, m);
          if (u.state === 'in') {
            const fx = LIVE_FIX[fixKey(u.home, u.away)];
            if (fx) { fx.events = det.events; fx.stats = det.stats; }
          }
        }));
      }
    });
    await Promise.all(cardJobs);

    if (changed.length) {
      changed.forEach(updateMatchRow);
      const standings = computeGroupStandings();
      const thirds = computeThirds(standings);
      refreshStandings(standings, thirds);
      renderThirds(thirds);
      renderBracket(standings, thirds);
    }
    renderFixtures();
    if (goals.length) fireGoals(goals);        // after re-render so the flash hits the new row
  }

  // -------- Fixtures (chronological live + upcoming + results) --------
  async function loadFixtures() {
    if (!window.WCLive) return;
    const dates = Array.from(new Set(WCDATA.matches.map((m) => m.date.replace(/-/g, ''))));
    let ups;
    try { ups = await window.WCLive.pollDates(dates); } catch (e) { return; }
    ups.forEach((u) => { if (u.home && u.away) LIVE_FIX[fixKey(u.home, u.away)] = u; });
    renderFixtures();
  }

  const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  function fmtCountdown(ms) {
    if (ms <= 0) return t('fix_soon');
    const mins = Math.floor(ms / 60000), h = Math.floor(mins / 60), days = Math.floor(h / 24);
    let s;
    if (days > 0) s = `${days}d ${h % 24}h`;
    else if (h > 0) s = `${h}h ${mins % 60}m`;
    else s = `${mins}m`;
    return t('cd_in', s);
  }

  function fixCard(u) {
    const h = teamsById.get(u.home), a = teamsById.get(u.away);
    if (!h || !a) return '';
    const lang = window.WCI18N ? window.WCI18N.lang() : 'en';
    const d = new Date(u.date);
    const time = d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
    const played = u.state !== 'pre';
    const hg = u.scores[u.home], ag = u.scores[u.away];
    let status, cls = '';
    if (u.state === 'in') { status = `<span class="fx-st-live"><span class="livedot"></span>${u.detail || t('fix_live')}</span>`; cls = 'live'; }
    else if (u.state === 'post') { status = `<span class="fx-st-ft">${t('fix_ft')}</span>`; cls = 'done'; }
    else { status = `<span class="fx-st-cd">${fmtCountdown(d.getTime() - Date.now())}</span>`; }
    const hw = played && hg > ag, aw = played && ag > hg;
    const team = (tm, win, score) =>
      `<div class="fx-team ${win ? 'win' : ''}"><span class="flag">${tm.flag || ''}</span>` +
      `<span class="nm">${tn(tm)}</span><span class="sc">${played ? score : ''}</span></div>`;
    const venue = u.venue
      ? `<div class="fx-venue">📍 ${u.venue}${u.city ? ' · ' + u.city.split(',')[0] : ''}</div>` : '';
    // Finished games are expandable: tap to load the goal/card timeline + stats.
    const expandable = u.state === 'post';
    return `<div class="fix ${cls}${expandable ? ' expandable' : ''}" data-fk="${fixKey(u.home, u.away)}"${u.id ? ` data-eid="${u.id}"` : ''}>
      <div class="fx-main">
        <div class="fx-when"><div class="fx-time">${time}</div><div class="fx-status">${status}</div></div>
        <div class="fx-teams">${team(h, hw, hg)}${team(a, aw, ag)}</div>
        ${expandable ? '<div class="fx-exp" aria-hidden="true">▾</div>' : ''}
      </div>
      ${u.state === 'in' ? fixDetail(u) : ''}
      ${expandable ? '<div class="fx-detail-slot"></div>' : ''}
      ${venue}
    </div>`;
  }

  // Goal/card timeline + match stats (possession, shots, etc.). Shown inline for
  // live games and on demand for finished ones.
  function fixDetail(u) {
    const ev = u.events || [], st = u.stats || null;
    let out = '';
    if (ev.length) {
      const icon = (k) => (k === 'goal' ? '⚽' : (k === 'yellow' ? '🟨' : '🟥'));
      const rows = ev.map((e) => {
        const tm = teamsById.get(e.team);
        const note = e.note ? ` <span class="ev-note">(${e.note})</span>` : '';
        return `<div class="ev"><span class="ev-min">${e.min}</span>` +
          `<span class="ev-ic">${icon(e.kind)}</span>` +
          `<span class="ev-pl">${e.player || ''}${note}</span>` +
          `<span class="ev-fl">${tm ? tm.flag : ''}</span></div>`;
      }).join('');
      out += `<div class="fx-events"><div class="fx-dh">${t('ev_title')}</div>${rows}</div>`;
    }
    if (st && st[u.home] && st[u.away]) {
      const H = st[u.home], A = st[u.away];
      const num = (v) => (v == null ? '–' : v);
      const pct = (v) => (v == null ? null : Math.round(parseFloat(v)));
      const ph = pct(H.possession), pa = pct(A.possession);
      const row = (hv, lbl, av) => `<div class="st-row"><span class="hv">${num(hv)}</span><span class="lb">${lbl}</span><span class="av">${num(av)}</span></div>`;
      let s = '';
      if (ph != null && pa != null) {
        s += `<div class="st-row"><span class="hv">${ph}%</span><span class="lb">${t('st_possession')}</span><span class="av">${pa}%</span></div>`;
        s += `<div class="st-bar"><span style="width:${ph}%"></span></div>`;
      }
      s += row(H.shots, t('st_shots'), A.shots);
      s += row(H.sot, t('st_sot'), A.sot);
      s += row(H.corners, t('st_corners'), A.corners);
      s += row(H.fouls, t('st_fouls'), A.fouls);
      out += `<div class="fx-stats"><div class="fx-dh">${t('st_title')}</div>${s}</div>`;
    }
    return out ? `<div class="fx-detail">${out}</div>` : '';
  }

  function renderFixtures() {
    const el = $('#fixturesList');
    if (!el) return;
    const lang = window.WCI18N ? window.WCI18N.lang() : 'en';
    const all = Object.values(LIVE_FIX).filter((u) => u.date && teamsById.get(u.home) && teamsById.get(u.away));
    const t0 = (u) => new Date(u.date).getTime();
    const dayList = (arr) => {
      let s = '', lastDay = '';
      arr.forEach((u) => {
        const d = new Date(u.date);
        const k = d.toDateString();
        if (k !== lastDay) {
          lastDay = k;
          s += `<div class="fix-day">${capFirst(d.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' }))}</div>`;
        }
        s += fixCard(u);
      });
      return s;
    };

    const q = fixSearch.trim().toLowerCase();
    const filterEl = $('#fixFilter');
    if (filterEl) filterEl.style.display = q ? 'none' : '';
    let html = '';
    if (q) {
      // Search any country: show all its matches (past, live, upcoming) in order.
      const teamMatch = (id) => {
        const tm = teamsById.get(id);
        return (tn(tm) + ' ' + tm.name + ' ' + codeFor(tm.id, tm.name)).toLowerCase().includes(q);
      };
      const matched = all.filter((u) => teamMatch(u.home) || teamMatch(u.away)).sort((x, y) => t0(x) - t0(y));
      html = matched.length ? dayList(matched) : `<div class="fix-empty">${t('fix_no_results')}</div>`;
    } else {
      // Current (live) games are always pinned on top. The filter switches the rest
      // between upcoming (future, soonest first) and previous (results, newest first).
      const live = all.filter((u) => u.state === 'in').sort((x, y) => t0(x) - t0(y));
      const upcoming = all.filter((u) => u.state === 'pre').sort((x, y) => t0(x) - t0(y));
      const previous = all.filter((u) => u.state === 'post').sort((x, y) => t0(y) - t0(x));
      if (live.length) html += `<div class="fix-sec live">${t('fix_live_now')}</div>` + live.map(fixCard).join('');
      if (fixMode === 'previous') {
        html += previous.length ? dayList(previous) : `<div class="fix-empty">${t('fix_none_previous')}</div>`;
      } else {
        html += upcoming.length ? dayList(upcoming) : `<div class="fix-empty">${t('fix_none_upcoming')}</div>`;
      }
    }
    el.innerHTML = html;
    // Wire expandable (finished) cards and restore any that were open before a re-render.
    $$('#fixturesList .fix.expandable').forEach((card) => {
      const main = $('.fx-main', card);
      if (main) main.addEventListener('click', () => toggleFixDetail(card));
      if (openFix.has(card.dataset.fk)) {
        card.classList.add('open');
        const u = LIVE_FIX[card.dataset.fk];
        const slot = $('.fx-detail-slot', card);
        if (u && slot && (u.events || u.stats)) fillFixSlot(slot, u);
      }
    });
  }

  function fillFixSlot(slot, u) {
    slot.innerHTML = fixDetail(u) || `<div class="fx-detail-msg">${t('fix_no_detail')}</div>`;
    slot.dataset.loaded = '1';
  }

  async function toggleFixDetail(card) {
    const fk = card.dataset.fk;
    const opening = !card.classList.contains('open');
    card.classList.toggle('open', opening);
    if (opening) openFix.add(fk); else openFix.delete(fk);
    if (!opening) return;
    const slot = $('.fx-detail-slot', card);
    if (!slot || slot.dataset.loaded) return;
    const u = LIVE_FIX[fk];
    if (!u) return;
    if (u.events || u.stats) { fillFixSlot(slot, u); return; }
    const eid = card.dataset.eid;
    if (!eid || !window.WCLive) { slot.innerHTML = `<div class="fx-detail-msg">${t('fix_no_detail')}</div>`; slot.dataset.loaded = '1'; return; }
    slot.innerHTML = `<div class="fx-detail-msg">${t('fix_loading')}</div>`;
    try {
      const det = await window.WCLive.fetchMatchDetail(eid);
      if (det) { u.events = det.events; u.stats = det.stats; }
    } catch (e) {}
    fillFixSlot(slot, u);
  }

  // -------- Goal alerts --------
  function armAlerts() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!audioCtx && AC) audioCtx = new AC();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
    if (alertsOn && 'Notification' in window && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch (e) {}
    }
  }

  function playGoalSound() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    [659.25, 783.99, 1046.5].forEach((f, i) => {   // E5 → G5 → C6 chime
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      const t = now + i * 0.12;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g).connect(audioCtx.destination);
      o.start(t);
      o.stop(t + 0.22);
    });
  }

  function flashRow(id) {
    const row = document.querySelector(`.match-row[data-match="${id}"]`);
    if (!row) return;
    row.classList.remove('flash');
    void row.offsetWidth;        // restart the animation
    row.classList.add('flash');
  }

  function fireGoals(goals) {
    if (!alertsOn) return;
    playGoalSound();
    goals.forEach((m) => {
      showGoalToast(m);                       // in-app floating banner, over any tab
      // OS notification only when the app isn't on screen (avoids a duplicate alert).
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        const h = teamsById.get(m.home), a = teamsById.get(m.away);
        const body = `${tn(h)} ${m.homeGoals}–${m.awayGoals} ${tn(a)} · ${m.minute || 'LIVE'}`;
        try { new Notification(t('goal_title'), { body, tag: 'goal-' + m.id, renotify: true }); } catch (e) {}
      }
      flashRow(m.id);
    });
  }

  // Floating goal banner shown over whatever the user is viewing. Auto-dismisses;
  // tap to close. Stacks if several goals land at once.
  function showGoalToast(m) {
    const host = $('#goalToasts');
    if (!host) return;
    const h = teamsById.get(m.home), a = teamsById.get(m.away);
    if (!h || !a) return;
    const el = document.createElement('div');
    el.className = 'goal-toast';
    el.innerHTML =
      `<div class="gt-title">${t('goal_title')}</div>` +
      `<div class="gt-match"><span class="flag">${h.flag || ''}</span> ${tn(h)} ` +
      `<b>${m.homeGoals}–${m.awayGoals}</b> ${tn(a)} <span class="flag">${a.flag || ''}</span>` +
      ` · ${m.minute || t('fix_live')}</div>`;
    host.appendChild(el);
    void el.offsetWidth;                  // commit the initial state so the transition runs
    el.classList.add('show');
    let gone = false;
    const close = () => { if (gone) return; gone = true; el.classList.remove('show'); setTimeout(() => el.remove(), 300); };
    el.addEventListener('click', close);
    setTimeout(close, 6000);
  }

  function updateAlertBtn() {
    const b = $('#alertToggle');
    if (!b) return;
    b.textContent = alertsOn ? '🔔' : '🔕';
    b.classList.toggle('on', alertsOn);
    b.title = alertsOn ? t('alert_on') : t('alert_off');
  }
  function startLive() {
    pollLive();
    setInterval(pollLive, 30000);   // refresh every 30s
  }

  // -------- UI wiring --------
  function bindUI() {
    $$('#tabs .tab[data-view]').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('#tabs .tab[data-view]').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        $$('.view').forEach((v) => v.classList.remove('active'));
        $('#view-' + tab.dataset.view).classList.add('active');
        tab.scrollIntoView({ block: 'nearest', inline: 'center' });
        window.scrollTo(0, 0);
      });
    });

    const alertBtn = $('#alertToggle');
    if (alertBtn) {
      alertBtn.addEventListener('click', () => {
        alertsOn = !alertsOn;
        try { localStorage.setItem('wc2026-alerts', alertsOn ? '1' : '0'); } catch (e) {}
        armAlerts();
        updateAlertBtn();
        if (alertsOn) playGoalSound();   // confirm sound works on enable
      });
    }
    updateAlertBtn();

    // Fixtures filter: switch the list between upcoming and previous (live stays on top).
    $$('#fixFilter button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.fxmode === fixMode);
      btn.addEventListener('click', () => {
        if (btn.dataset.fxmode === fixMode) return;
        fixMode = btn.dataset.fxmode;
        try { localStorage.setItem('wc2026-fixmode', fixMode); } catch (e) {}
        $$('#fixFilter button').forEach((b) => b.classList.toggle('active', b.dataset.fxmode === fixMode));
        renderFixtures();
        window.scrollTo(0, 0);
      });
    });

    // Fixtures country search.
    const search = $('#fixSearch');
    if (search) {
      search.placeholder = t('fix_search_ph');
      search.addEventListener('input', () => { fixSearch = search.value; renderFixtures(); });
    }

    // Knockout simulation: tap a team to pick the winner (toggles off if re-tapped).
    const bracketEl = $('#bracket');
    if (bracketEl) {
      bracketEl.addEventListener('click', (e) => {
        const sl = e.target.closest('.slot.pick');
        if (!sl) return;
        const no = sl.dataset.match, team = sl.dataset.team;
        if (knockoutPicks[no] === team) delete knockoutPicks[no];
        else knockoutPicks[no] = team;
        saveKnockout();
        rerenderBracket();
      });
    }
    const resetBtn = $('#bracketReset');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      knockoutPicks = {};
      saveKnockout();
      rerenderBracket();
    });
    const shareBtn = $('#bracketShare');
    if (shareBtn) shareBtn.addEventListener('click', shareBracket);

    const groupsReset = $('#groupsReset');
    if (groupsReset) groupsReset.addEventListener('click', resetGroupPicks);

    // Language selector: mark the active language; change reloads in that language.
    const cur = window.WCI18N ? window.WCI18N.lang() : 'en';
    $$('#langSel button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === cur);
      btn.addEventListener('click', () => {
        if (!window.WCI18N || btn.dataset.lang === window.WCI18N.lang()) return;
        window.WCI18N.setLang(btn.dataset.lang);
        location.reload();
      });
    });

    // Arm audio + notification permission on the first user interaction
    // (browsers require a gesture before audio can play / prompts can show).
    ['click', 'keydown', 'touchstart'].forEach((ev) =>
      document.addEventListener(ev, armAlerts, { once: true }));
  }

  document.addEventListener('DOMContentLoaded', init);
})();
