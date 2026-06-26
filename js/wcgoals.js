/* ============================================================================
 * wcgoals.js — all-time World Cup goals (editable data file)
 *
 * The numbers below are each player's career World Cup goals BEFORE the 2026
 * edition (i.e. goals scored at previous World Cups). The Top Scorers tab adds
 * this tournament's goals on top to show an all-time total, so this file only
 * needs the pre-2026 figure and never has to change mid-tournament.
 *
 * Editing:
 *   - Add or fix any entry. Names are matched case- AND accent-insensitively,
 *     so "Vinícius Júnior", "Vinicius Junior" and "VINICIUS JUNIOR" all match.
 *   - Use the name as it shows in the Top Scorers list.
 *   - A player not listed here shows "—" in the all-time column (unknown).
 *   - A value of 0 means "has played World Cups but never scored" (or has no
 *     prior World Cup), which is different from being unlisted.
 *
 * Seeded with the well-known current scorers; extend as you like.
 * ==========================================================================*/
(function (global) {
  'use strict';

  const BASE = {
    // established World Cup scorers
    'Lionel Messi': 13,
    'Cristiano Ronaldo': 8,
    'Kylian Mbappé': 12,
    'Neymar': 8,
    'Luis Suárez': 7,
    'Harry Kane': 8,
    'Thomas Müller': 10,
    'Olivier Giroud': 4,
    'Romelu Lukaku': 5,
    'Robert Lewandowski': 1,
    'Richarlison': 3,
    'Bukayo Saka': 3,
    'Julián Álvarez': 4,
    'Cody Gakpo': 3,
    'Vinícius Júnior': 1,

    // current top scorers with no prior World Cup goals (debut or nation absent)
    'Erling Haaland': 0,
    'Ousmane Dembélé': 0,
    'Jonathan David': 0,
    'Cyle Larin': 0,
    'Matheus Cunha': 0,
    'Ayase Ueda': 0,
    'Daniel Muñoz': 0,
  };

  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const map = {};
  Object.keys(BASE).forEach((k) => { map[norm(k)] = BASE[k]; });

  global.WCAllTimeGoals = map;
  global.wcNormName = norm;
})(typeof window !== 'undefined' ? window : globalThis);
