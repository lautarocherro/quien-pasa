/* ============================================================================
 * data.js — 2026 FIFA World Cup teams, groups, fixtures, FIFA-ranking
 * tiebreak proxy, and the rules write-up.
 *
 * Groups reflect the Final Draw (Washington D.C., 5 Dec 2025) with the six
 * play-off slots resolved (March 2026): Czechia (UEFA D), Bosnia & Herzegovina
 * (UEFA A), Turkey (UEFA C), Sweden (UEFA B), Iraq (Inter-confederation 2),
 * DR Congo (Inter-confederation 1).
 * ==========================================================================*/

(function (global) {
  'use strict';

  // id, name, flag emoji. playoff label kept for provenance where relevant.
  const G = {
    A: [
      ['mex', 'Mexico', '🇲🇽'], ['rsa', 'South Africa', '🇿🇦'],
      ['kor', 'South Korea', '🇰🇷'], ['cze', 'Czechia', '🇨🇿'],
    ],
    B: [
      ['can', 'Canada', '🇨🇦'], ['bih', 'Bosnia & Herz.', '🇧🇦'],
      ['qat', 'Qatar', '🇶🇦'], ['sui', 'Switzerland', '🇨🇭'],
    ],
    C: [
      ['bra', 'Brazil', '🇧🇷'], ['mar', 'Morocco', '🇲🇦'],
      ['hai', 'Haiti', '🇭🇹'], ['sco', 'Scotland', '🏴󠁧󠁢󠁳󠁣󠁴󠁿'],
    ],
    D: [
      ['usa', 'United States', '🇺🇸'], ['par', 'Paraguay', '🇵🇾'],
      ['aus', 'Australia', '🇦🇺'], ['tur', 'Turkey', '🇹🇷'],
    ],
    E: [
      ['ger', 'Germany', '🇩🇪'], ['cuw', 'Curacao', '🇨🇼'],
      ['civ', 'Ivory Coast', '🇨🇮'], ['ecu', 'Ecuador', '🇪🇨'],
    ],
    F: [
      ['ned', 'Netherlands', '🇳🇱'], ['jpn', 'Japan', '🇯🇵'],
      ['swe', 'Sweden', '🇸🇪'], ['tun', 'Tunisia', '🇹🇳'],
    ],
    G: [
      ['bel', 'Belgium', '🇧🇪'], ['egy', 'Egypt', '🇪🇬'],
      ['irn', 'Iran', '🇮🇷'], ['nzl', 'New Zealand', '🇳🇿'],
    ],
    H: [
      ['esp', 'Spain', '🇪🇸'], ['cpv', 'Cape Verde', '🇨🇻'],
      ['ksa', 'Saudi Arabia', '🇸🇦'], ['uru', 'Uruguay', '🇺🇾'],
    ],
    I: [
      ['fra', 'France', '🇫🇷'], ['sen', 'Senegal', '🇸🇳'],
      ['irq', 'Iraq', '🇮🇶'], ['nor', 'Norway', '🇳🇴'],
    ],
    J: [
      ['arg', 'Argentina', '🇦🇷'], ['alg', 'Algeria', '🇩🇿'],
      ['aut', 'Austria', '🇦🇹'], ['jor', 'Jordan', '🇯🇴'],
    ],
    K: [
      ['por', 'Portugal', '🇵🇹'], ['cod', 'DR Congo', '🇨🇩'],
      ['uzb', 'Uzbekistan', '🇺🇿'], ['col', 'Colombia', '🇨🇴'],
    ],
    L: [
      ['eng', 'England', '🏴󠁧󠁢󠁥󠁮󠁧󠁿'], ['cro', 'Croatia', '🇭🇷'],
      ['gha', 'Ghana', '🇬🇭'], ['pan', 'Panama', '🇵🇦'],
    ],
  };

  // Approximate FIFA/Coca-Cola Men's World Ranking position (lower = better).
  // Used ONLY as the final regulation tiebreaker; values are an approximation.
  const FIFA_RANK = {
    arg: 1, esp: 2, fra: 3, eng: 4, bra: 5, ned: 6, por: 7, bel: 8, ger: 9,
    cro: 10, mar: 11, col: 12, uru: 13, sui: 14, jpn: 15, sen: 16, irn: 17,
    usa: 18, mex: 19, aus: 20, ecu: 21, aut: 22, nor: 23, swe: 24, kor: 25,
    egy: 26, can: 27, civ: 28, pan: 29, alg: 30, sco: 31, tun: 32, par: 33,
    ksa: 34, uzb: 35, qat: 36, irq: 37, rsa: 38, cpv: 39, jor: 40, cod: 41,
    cze: 42, bih: 43, tur: 44, gha: 45, cuw: 46, nzl: 47, hai: 48,
  };

  const NAME2ID = {
    'Mexico': 'mex', 'South Africa': 'rsa', 'South Korea': 'kor', 'Czechia': 'cze',
    'Canada': 'can', 'Bosnia & Herzegovina': 'bih', 'Qatar': 'qat', 'Switzerland': 'sui',
    'Brazil': 'bra', 'Morocco': 'mar', 'Haiti': 'hai', 'Scotland': 'sco',
    'United States': 'usa', 'Paraguay': 'par', 'Australia': 'aus', 'Turkey': 'tur',
    'Germany': 'ger', 'Curacao': 'cuw', 'Ivory Coast': 'civ', 'Ecuador': 'ecu',
    'Netherlands': 'ned', 'Japan': 'jpn', 'Sweden': 'swe', 'Tunisia': 'tun',
    'Belgium': 'bel', 'Egypt': 'egy', 'Iran': 'irn', 'New Zealand': 'nzl',
    'Spain': 'esp', 'Cape Verde': 'cpv', 'Saudi Arabia': 'ksa', 'Uruguay': 'uru',
    'France': 'fra', 'Senegal': 'sen', 'Iraq': 'irq', 'Norway': 'nor',
    'Argentina': 'arg', 'Algeria': 'alg', 'Austria': 'aut', 'Jordan': 'jor',
    'Portugal': 'por', 'DR Congo': 'cod', 'Uzbekistan': 'uzb', 'Colombia': 'col',
    'England': 'eng', 'Croatia': 'cro', 'Ghana': 'gha', 'Panama': 'pan',
  };

  // Real 2026 group-stage schedule + results as of 18 June 2026 (Matchday 1
  // complete; MD2/MD3 upcoming). Played matches are finished/locked.
  // Cross-verified vs Wikipedia per-group pages, ESPN, FIFA.com, CBS, Sky Sports.
  // tuple: [group, matchday, date, home, away, played, homeGoals, awayGoals]
  const FIXTURES = [
    ['A', 1, '2026-06-11', 'Mexico', 'South Africa', true, 2, 0],
    ['A', 1, '2026-06-11', 'South Korea', 'Czechia', true, 2, 1],
    ['A', 2, '2026-06-18', 'Czechia', 'South Africa', false, 0, 0],
    ['A', 2, '2026-06-18', 'Mexico', 'South Korea', false, 0, 0],
    ['A', 3, '2026-06-24', 'Czechia', 'Mexico', false, 0, 0],
    ['A', 3, '2026-06-24', 'South Africa', 'South Korea', false, 0, 0],

    ['B', 1, '2026-06-12', 'Canada', 'Bosnia & Herzegovina', true, 1, 1],
    ['B', 1, '2026-06-13', 'Qatar', 'Switzerland', true, 1, 1],
    ['B', 2, '2026-06-18', 'Switzerland', 'Bosnia & Herzegovina', false, 0, 0],
    ['B', 2, '2026-06-18', 'Canada', 'Qatar', false, 0, 0],
    ['B', 3, '2026-06-24', 'Switzerland', 'Canada', false, 0, 0],
    ['B', 3, '2026-06-24', 'Bosnia & Herzegovina', 'Qatar', false, 0, 0],

    ['C', 1, '2026-06-13', 'Brazil', 'Morocco', true, 1, 1],
    ['C', 1, '2026-06-13', 'Haiti', 'Scotland', true, 0, 1],
    ['C', 2, '2026-06-19', 'Scotland', 'Morocco', false, 0, 0],
    ['C', 2, '2026-06-19', 'Brazil', 'Haiti', false, 0, 0],
    ['C', 3, '2026-06-24', 'Scotland', 'Brazil', false, 0, 0],
    ['C', 3, '2026-06-24', 'Morocco', 'Haiti', false, 0, 0],

    ['D', 1, '2026-06-12', 'United States', 'Paraguay', true, 4, 1],
    ['D', 1, '2026-06-13', 'Australia', 'Turkey', true, 2, 0],
    ['D', 2, '2026-06-19', 'United States', 'Australia', false, 0, 0],
    ['D', 2, '2026-06-19', 'Turkey', 'Paraguay', false, 0, 0],
    ['D', 3, '2026-06-25', 'Turkey', 'United States', false, 0, 0],
    ['D', 3, '2026-06-25', 'Paraguay', 'Australia', false, 0, 0],

    ['E', 1, '2026-06-14', 'Germany', 'Curacao', true, 7, 1],
    ['E', 1, '2026-06-14', 'Ivory Coast', 'Ecuador', true, 1, 0],
    ['E', 2, '2026-06-20', 'Germany', 'Ivory Coast', false, 0, 0],
    ['E', 2, '2026-06-20', 'Ecuador', 'Curacao', false, 0, 0],
    ['E', 3, '2026-06-25', 'Curacao', 'Ivory Coast', false, 0, 0],
    ['E', 3, '2026-06-25', 'Ecuador', 'Germany', false, 0, 0],

    ['F', 1, '2026-06-14', 'Netherlands', 'Japan', true, 2, 2],
    ['F', 1, '2026-06-14', 'Sweden', 'Tunisia', true, 5, 1],
    ['F', 2, '2026-06-20', 'Netherlands', 'Sweden', false, 0, 0],
    ['F', 2, '2026-06-20', 'Tunisia', 'Japan', false, 0, 0],
    ['F', 3, '2026-06-25', 'Japan', 'Sweden', false, 0, 0],
    ['F', 3, '2026-06-25', 'Tunisia', 'Netherlands', false, 0, 0],

    ['G', 1, '2026-06-15', 'Belgium', 'Egypt', true, 1, 1],
    ['G', 1, '2026-06-15', 'Iran', 'New Zealand', true, 2, 2],
    ['G', 2, '2026-06-21', 'Belgium', 'Iran', false, 0, 0],
    ['G', 2, '2026-06-21', 'New Zealand', 'Egypt', false, 0, 0],
    ['G', 3, '2026-06-26', 'Egypt', 'Iran', false, 0, 0],
    ['G', 3, '2026-06-26', 'New Zealand', 'Belgium', false, 0, 0],

    ['H', 1, '2026-06-15', 'Spain', 'Cape Verde', true, 0, 0],
    ['H', 1, '2026-06-15', 'Saudi Arabia', 'Uruguay', true, 1, 1],
    ['H', 2, '2026-06-21', 'Spain', 'Saudi Arabia', false, 0, 0],
    ['H', 2, '2026-06-21', 'Uruguay', 'Cape Verde', false, 0, 0],
    ['H', 3, '2026-06-26', 'Cape Verde', 'Saudi Arabia', false, 0, 0],
    ['H', 3, '2026-06-26', 'Uruguay', 'Spain', false, 0, 0],

    ['I', 1, '2026-06-16', 'France', 'Senegal', true, 3, 1],
    ['I', 1, '2026-06-16', 'Iraq', 'Norway', true, 1, 4],
    ['I', 2, '2026-06-22', 'France', 'Iraq', false, 0, 0],
    ['I', 2, '2026-06-22', 'Norway', 'Senegal', false, 0, 0],
    ['I', 3, '2026-06-26', 'Norway', 'France', false, 0, 0],
    ['I', 3, '2026-06-26', 'Senegal', 'Iraq', false, 0, 0],

    ['J', 1, '2026-06-16', 'Argentina', 'Algeria', true, 3, 0],
    ['J', 1, '2026-06-16', 'Austria', 'Jordan', true, 3, 1],
    ['J', 2, '2026-06-22', 'Argentina', 'Austria', false, 0, 0],
    ['J', 2, '2026-06-22', 'Jordan', 'Algeria', false, 0, 0],
    ['J', 3, '2026-06-27', 'Algeria', 'Austria', false, 0, 0],
    ['J', 3, '2026-06-27', 'Jordan', 'Argentina', false, 0, 0],

    ['K', 1, '2026-06-17', 'Portugal', 'DR Congo', true, 1, 1],
    ['K', 1, '2026-06-17', 'Uzbekistan', 'Colombia', true, 1, 3],
    ['K', 2, '2026-06-23', 'Portugal', 'Uzbekistan', false, 0, 0],
    ['K', 2, '2026-06-23', 'Colombia', 'DR Congo', false, 0, 0],
    ['K', 3, '2026-06-27', 'Colombia', 'Portugal', false, 0, 0],
    ['K', 3, '2026-06-27', 'DR Congo', 'Uzbekistan', false, 0, 0],

    ['L', 1, '2026-06-17', 'England', 'Croatia', true, 4, 2],
    ['L', 1, '2026-06-17', 'Ghana', 'Panama', true, 1, 0],
    ['L', 2, '2026-06-23', 'England', 'Ghana', false, 0, 0],
    ['L', 2, '2026-06-23', 'Panama', 'Croatia', false, 0, 0],
    ['L', 3, '2026-06-27', 'Panama', 'England', false, 0, 0],
    ['L', 3, '2026-06-27', 'Croatia', 'Ghana', false, 0, 0],
  ];

  // Real disciplinary records for played matches, keyed by "Home v Away".
  // y = single yellows (player stayed on); sy = sent off for 2nd yellow;
  // dr = straight red; ydr = yellow + separate direct red (same match).
  // Only ONE deduction counts per player per match (FIFA Article 13).
  const CARDS = {
    // Matchday 1 disciplinary records (cross-verified vs ESPN/FOX/Wikipedia/FIFA).
    // Omitted matches had zero cards (Germany–Curacao, France–Senegal,
    // Argentina–Algeria, England–Croatia).
    'Mexico v South Africa':         { h: { y: 1, dr: 1 }, a: { y: 2, dr: 2 } }, // 3 straight reds
    'South Korea v Czechia':         { h: { y: 1 } },
    'Canada v Bosnia & Herzegovina': { h: { y: 2 }, a: { y: 3 } },
    'Qatar v Switzerland':           { h: { y: 2 }, a: { y: 1 } },
    'Brazil v Morocco':              { h: { y: 2 } },
    'Haiti v Scotland':              { h: { y: 1 }, a: { y: 3 } },
    'United States v Paraguay':      { h: { y: 1 }, a: { y: 5 } },
    'Australia v Turkey':            { a: { y: 1 } },
    'Ivory Coast v Ecuador':         { h: { y: 3 }, a: { y: 1 } },
    'Netherlands v Japan':           { h: { y: 3 } },
    'Sweden v Tunisia':              { a: { y: 1 } },
    'Belgium v Egypt':               { h: { y: 2 }, a: { y: 2 } },
    'Iran v New Zealand':            { h: { y: 1 } },
    'Spain v Cape Verde':            { h: { y: 1 }, a: { y: 1 } },
    'Saudi Arabia v Uruguay':        { h: { y: 1 } },
    'Iraq v Norway':                 { h: { y: 1 } },
    'Austria v Jordan':              { h: { y: 1 } },
    'Portugal v DR Congo':           { h: { y: 3 }, a: { y: 1 } },
    'Uzbekistan v Colombia':         { h: { y: 1 }, a: { y: 1 } },
    'Ghana v Panama':                { h: { y: 1 }, a: { y: 2 } },
  };
  const toCards = (c) => ({
    yellow: c.y || 0, secondYellowRed: c.sy || 0,
    directRed: c.dr || 0, yellowAndDirectRed: c.ydr || 0,
  });

  const groups = Object.keys(G).map((gid) => ({
    id: gid,
    teams: G[gid].map(([id, name, flag]) => ({ id, name, flag, group: gid })),
  }));

  const matches = [];
  const perGroup = {};
  FIXTURES.forEach((f) => {
    const [gid, md, date, hn, an, played, hg, ag] = f;
    perGroup[gid] = (perGroup[gid] || 0) + 1;
    const m = {
      id: `${gid}${perGroup[gid]}`,
      group: gid,
      md,
      date,
      home: NAME2ID[hn],
      away: NAME2ID[an],
      homeGoals: played ? hg : 0,
      awayGoals: played ? ag : 0,
      played: played,
      finished: played,   // real finished result → locked, not editable
    };
    const rec = CARDS[`${hn} v ${an}`];
    if (rec) {
      m.cards = {};
      if (rec.h) m.cards[NAME2ID[hn]] = toCards(rec.h);
      if (rec.a) m.cards[NAME2ID[an]] = toCards(rec.a);
    }
    matches.push(m);
  });

  global.WCDATA = {
    groups,
    matches,
    advancingThirds: 8,
    fifaRank: FIFA_RANK,
  };
})(typeof window !== 'undefined' ? window : globalThis);
