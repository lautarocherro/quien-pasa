/* ============================================================================
 * i18n.js — language detection + translation dictionary (English / Spanish).
 *
 * Language = saved choice, else device language (navigator.language). A Spanish
 * device shows Spanish; everything else shows English. t(key, ...args) returns
 * the translated string with {0},{1} interpolation. Changing language reloads.
 * ==========================================================================*/

(function (global) {
  'use strict';

  function detect() {
    try {
      const saved = localStorage.getItem('wc2026-lang');
      if (saved === 'en' || saved === 'es') return saved;
    } catch (e) {}
    const n = ((global.navigator && navigator.language) || 'en').toLowerCase();
    return n.indexOf('es') === 0 ? 'es' : 'en';
  }

  let LANG = detect();

  const MONTHS = {
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  };

  // Spanish country names by team id (English uses the names in data.js).
  const NAMES_ES = {
    mex: 'México', rsa: 'Sudáfrica', kor: 'Corea del Sur', cze: 'Chequia',
    can: 'Canadá', bih: 'Bosnia y Herz.', qat: 'Catar', sui: 'Suiza',
    bra: 'Brasil', mar: 'Marruecos', hai: 'Haití', sco: 'Escocia',
    usa: 'Estados Unidos', par: 'Paraguay', aus: 'Australia', tur: 'Turquía',
    ger: 'Alemania', cuw: 'Curazao', civ: 'Costa de Marfil', ecu: 'Ecuador',
    ned: 'Países Bajos', jpn: 'Japón', swe: 'Suecia', tun: 'Túnez',
    bel: 'Bélgica', egy: 'Egipto', irn: 'Irán', nzl: 'Nueva Zelanda',
    esp: 'España', cpv: 'Cabo Verde', ksa: 'Arabia Saudí', uru: 'Uruguay',
    fra: 'Francia', sen: 'Senegal', irq: 'Irak', nor: 'Noruega',
    arg: 'Argentina', alg: 'Argelia', aut: 'Austria', jor: 'Jordania',
    por: 'Portugal', cod: 'RD Congo', uzb: 'Uzbekistán', col: 'Colombia',
    eng: 'Inglaterra', cro: 'Croacia', gha: 'Ghana', pan: 'Panamá',
  };

  // Shared <style> for the rules page (identical across languages).
  const RULES_STYLE = `
    <style>
      #rulesBody h3 { margin: 18px 0 6px; font-size: 14px; color: var(--accent-2); }
      #rulesBody ol, #rulesBody ul { margin: 4px 0 10px; padding-left: 22px; }
      #rulesBody li { margin: 3px 0; }
      #rulesBody .small { color: var(--muted); font-size: 12.5px; }
      #rulesBody table { border-collapse: collapse; margin: 6px 0 12px; font-size: 13px; }
      #rulesBody td { padding: 4px 12px 4px 0; }
      #rulesBody .chip { display:inline-block; background:var(--panel-2); border:1px solid var(--line); border-radius:6px; padding:1px 7px; font-family:var(--mono); font-size:12px; }
    </style>`;

  const RULES_EN = RULES_STYLE + `
    <p class="small">Source: <em>Regulations for the FIFA World Cup 26</em> (May 2026 edition),
    Articles&nbsp;12 &amp; 13 and Annexe&nbsp;C.
    <a href="https://digitalhub.fifa.com/m/636f5c9c6f29771f/original/FWC2026_regulations_EN.pdf" target="_blank" rel="noopener">Official PDF</a>.</p>
    <h3>Format</h3>
    <p>48 teams, 12 groups of 4. The top 2 of each group (24 teams) plus the
    <strong>8 best of the 12 third-placed teams</strong> advance to a 32-team Round of 32.</p>
    <h3>Ranking teams within a group (Article 13)</h3>
    <p>Teams are ranked by <strong>points</strong> first (win&nbsp;3, draw&nbsp;1, loss&nbsp;0).
    Among teams <strong>level on points</strong>, these criteria apply in order:</p>
    <p class="small"><strong>Step 1 — head-to-head</strong> (only matches between the tied teams):</p>
    <ol>
      <li>Points in the matches between the tied teams</li>
      <li>Goal difference in those matches</li>
      <li>Goals scored in those matches</li>
    </ol>
    <p class="small"><strong>Step 2</strong> — re-apply 1–3 to any teams still tied; if still level, use
    <strong>overall</strong> group statistics:</p>
    <ol start="4">
      <li>Overall goal difference</li>
      <li>Overall goals scored</li>
      <li>Team conduct (fair-play) score</li>
    </ol>
    <p class="small"><strong>Step 3</strong></p>
    <ol start="7">
      <li>Most recent FIFA/Coca-Cola Men's World Ranking (then preceding editions)</li>
    </ol>
    <p class="small"><span class="chip">2026 change</span> Head-to-head now comes <em>before</em> overall
    goal difference, and the old "drawing of lots" has been removed: the final fallback is the FIFA World Ranking.</p>
    <h3>Ranking the 8 best third-placed teams (Article 13)</h3>
    <p>The 12 third-placed teams never met, so they are compared on <strong>overall statistics only</strong>:</p>
    <ol>
      <li>Points</li><li>Goal difference</li><li>Goals scored</li>
      <li>Team conduct (fair-play) score</li><li>FIFA/Coca-Cola Men's World Ranking</li>
    </ol>
    <p>The <strong>top 8</strong> qualify. Their bracket slots are then fixed by Annexe&nbsp;C (below).</p>
    <h3>Team conduct (fair-play) score</h3>
    <p>Deductions (negative; the team with the score closest to zero ranks higher).
    Only the single largest deduction applies to a player per match:</p>
    <table>
      <tr><td>Yellow card</td><td class="chip">−1</td></tr>
      <tr><td>Indirect red (two yellows)</td><td class="chip">−3</td></tr>
      <tr><td>Direct red card</td><td class="chip">−4</td></tr>
      <tr><td>Yellow + direct red (same match)</td><td class="chip">−5</td></tr>
    </table>
    <h3>Round of 32 — Annexe C (no second draw)</h3>
    <p>Eight group winners (<strong>A, B, D, E, G, I, K, L</strong>) are pre-assigned to face a
    best third-placed team. Winners of C, F, H, J face runners-up, and four runner-up-vs-runner-up
    matches complete the round.</p>
    <p>Which third each winner plays is fixed by a published lookup table: there are
    <strong>C(12,8)=495</strong> possible sets of which groups supply a qualifying third. Once the 8 are
    known, the matching Annexe&nbsp;C "Option" locks the entire third-place side of the bracket
    automatically. Same-group teams can never meet in the Round of 32. This app embeds all
    495 official combinations, extracted and validated against the FIFA PDF.</p>`;

  const RULES_ES = RULES_STYLE + `
    <p class="small">Fuente: <em>Reglamento de la Copa Mundial de la FIFA 26</em> (edición de mayo de 2026),
    Artículos&nbsp;12 y 13 y Anexo&nbsp;C.
    <a href="https://digitalhub.fifa.com/m/636f5c9c6f29771f/original/FWC2026_regulations_EN.pdf" target="_blank" rel="noopener">PDF oficial</a>.</p>
    <h3>Formato</h3>
    <p>48 equipos, 12 grupos de 4. Los 2 primeros de cada grupo (24 equipos) más los
    <strong>8 mejores de los 12 terceros</strong> avanzan a unos dieciseisavos de final de 32 equipos.</p>
    <h3>Clasificación dentro de un grupo (Artículo 13)</h3>
    <p>Los equipos se ordenan primero por <strong>puntos</strong> (victoria&nbsp;3, empate&nbsp;1, derrota&nbsp;0).
    Entre equipos <strong>igualados a puntos</strong>, se aplican estos criterios en orden:</p>
    <p class="small"><strong>Paso 1 — entre ellos</strong> (solo los partidos entre los equipos empatados):</p>
    <ol>
      <li>Puntos en los partidos entre los equipos empatados</li>
      <li>Diferencia de goles en esos partidos</li>
      <li>Goles marcados en esos partidos</li>
    </ol>
    <p class="small"><strong>Paso 2</strong> — repetir 1–3 con los equipos aún empatados; si siguen igualados, usar las
    estadísticas <strong>globales</strong> del grupo:</p>
    <ol start="4">
      <li>Diferencia de goles global</li>
      <li>Goles marcados global</li>
      <li>Puntuación de conducta (juego limpio)</li>
    </ol>
    <p class="small"><strong>Paso 3</strong></p>
    <ol start="7">
      <li>Ranking Mundial Masculino FIFA/Coca-Cola más reciente (luego ediciones anteriores)</li>
    </ol>
    <p class="small"><span class="chip">cambio 2026</span> Ahora el enfrentamiento directo va <em>antes</em> que la
    diferencia de goles global, y se eliminó el antiguo «sorteo»: el último recurso es el Ranking Mundial FIFA.</p>
    <h3>Clasificación de los 8 mejores terceros (Artículo 13)</h3>
    <p>Los 12 terceros no se enfrentaron entre sí, así que se comparan <strong>solo por estadísticas globales</strong>:</p>
    <ol>
      <li>Puntos</li><li>Diferencia de goles</li><li>Goles marcados</li>
      <li>Puntuación de conducta (juego limpio)</li><li>Ranking Mundial Masculino FIFA/Coca-Cola</li>
    </ol>
    <p>Los <strong>8 mejores</strong> avanzan. Sus huecos en el cuadro quedan fijados por el Anexo&nbsp;C (abajo).</p>
    <h3>Puntuación de conducta (juego limpio)</h3>
    <p>Deducciones (negativas; el equipo con la puntuación más cercana a cero queda por delante).
    Solo se aplica la mayor deducción por jugador y partido:</p>
    <table>
      <tr><td>Tarjeta amarilla</td><td class="chip">−1</td></tr>
      <tr><td>Roja indirecta (dos amarillas)</td><td class="chip">−3</td></tr>
      <tr><td>Roja directa</td><td class="chip">−4</td></tr>
      <tr><td>Amarilla + roja directa (mismo partido)</td><td class="chip">−5</td></tr>
    </table>
    <h3>Dieciseisavos — Anexo C (sin segundo sorteo)</h3>
    <p>Ocho primeros de grupo (<strong>A, B, D, E, G, I, K, L</strong>) se enfrentan a un mejor tercero.
    Los ganadores de C, F, H, J juegan contra segundos, y cuatro partidos segundo-vs-segundo completan la ronda.</p>
    <p>Qué tercero juega cada ganador está fijado por una tabla publicada: hay
    <strong>C(12,8)=495</strong> combinaciones posibles de qué grupos aportan un tercero clasificado. Una vez
    conocidos los 8, la «Opción» correspondiente del Anexo&nbsp;C fija automáticamente todo el lado de los terceros
    del cuadro. Equipos del mismo grupo nunca pueden cruzarse en dieciseisavos. Esta app incluye las
    495 combinaciones oficiales, extraídas y validadas del PDF de la FIFA.</p>`;

  const S = {
    en: {
      tab_groups: 'Groups', tab_fixtures: 'Fixtures', tab_thirds: 'Best 3rd-Placed', tab_bracket: 'Knockout Bracket', tab_rules: 'Tiebreak Rules',
      group_label: 'Group',
      fixtures_hint: 'Recent results, live, and upcoming matches in order. Times shown in your local timezone.',
      fix_live: 'LIVE', fix_ft: 'FT', cd_in: 'in {0}', fix_soon: 'kicking off', fix_vs: 'vs',
      fix_upcoming: 'Live & upcoming', fix_results: 'Results', fix_recent: 'Recent results', fix_earlier: 'Earlier results ({0})',
      fix_filter_upcoming: 'Upcoming', fix_filter_previous: 'Previous', fix_live_now: 'Live now',
      fix_none_upcoming: 'No upcoming matches.', fix_none_previous: 'No previous matches yet.', fix_loading: 'Loading…',
      fix_no_detail: 'No match details available.',
      ev_title: 'Match events', st_title: 'Match stats',
      st_possession: 'Possession', st_shots: 'Shots', st_sot: 'Shots on target', st_corners: 'Corners', st_fouls: 'Fouls',
      legend_1st: '1st (advances)', legend_2nd: '2nd (advances)', legend_3rd: '3rd (best 8 advance)', legend_out: 'Eliminated',
      groups_reset: 'Reset predictions',
      thirds_title: 'Ranking of the 12 third-placed teams',
      thirds_caption: 'The <strong>top 8</strong> qualify for the Round of 32. Ranked by overall points → goal difference → goals scored → fair-play (team conduct) → FIFA World Ranking.',
      rules_title: 'FIFA tiebreaking policy',
      rules_subtitle: 'How standings and the best thirds are decided.',
      thirds_note: '<strong>{0} of 12</strong> third-placed teams advance. Rankings below are <strong>provisional</strong> until all group matches finish ({1}/{2} played).',
      col_team: 'Team', col_grp: 'Grp', col_status: 'Status', col_decisive: 'Decisive factor (vs team below)',
      col_p: 'P', col_w: 'W', col_d: 'D', col_l: 'L', col_gf: 'GF', col_ga: 'GA', col_gd: 'GD', col_pts: 'Pts', col_fp: 'FP', col_rk: 'Rk',
      col_r32: 'R32', tip_r32: 'Round of 32 opponent (if the standings hold)', r32_out: 'Not advancing',
      tip_played: 'Matches played / predicted',
      tip_yellow: 'Yellow cards', tip_red: 'Red cards', tip_fp: 'Conduct score (tiebreak)', tip_rk: 'FIFA World Ranking (final tiebreak)',
      badge_in: 'ADVANCES', badge_out: 'OUT',
      elim_tag: 'OUT', elim_tip: 'Mathematically eliminated: cannot finish in the group top 3, so cannot be a best third.',
      played_count: '{0}/{1} played',
      edge_points: 'More points than {0} ({1} vs {2}).',
      edge_gd: 'Level on {0} pts → better goal difference ({1} vs {2}).',
      edge_gf: 'Level on pts & GD → more goals scored ({0} vs {1}).',
      edge_fp: 'Level on pts/GD/goals → better fair-play score ({0} vs {1}).',
      edge_rank: 'Identical record → higher FIFA ranking (#{0} vs #{1}).',
      gedge_h2h_pts: 'Level on {0} pts → head-to-head points ({1} vs {2}).',
      gedge_h2h_gd: 'Level on {0} pts → head-to-head goal difference ({1} vs {2}).',
      gedge_h2h_gf: 'Level on {0} pts → head-to-head goals ({1} vs {2}).',
      gedge_gd: 'Level on {0} pts → better goal difference ({1} vs {2}).',
      gedge_gf: 'Level on pts & GD → more goals ({0} vs {1}).',
      gedge_fp: 'Level on pts/GD/goals → better fair-play ({0} vs {1}).',
      gedge_rank: 'All level → higher FIFA ranking (#{0} vs #{1}).',
      bracket_hint: 'Tap a team to pick who advances.',
      bracket_reset: 'Reset picks', champion: 'Champion',
      share_btn: 'Share', share_working: 'Preparing…', share_saved: 'Image saved · link copied',
      share_title: 'World Cup 2026 — my bracket',
      share_text: 'My World Cup 2026 bracket — who do you think goes through?',
      share_pickhint: 'Tap teams in the app to simulate the knockouts.',
      round_r32: 'Round of 32', round_r16: 'Round of 16', round_qf: 'Quarter-finals', round_sf: 'Semi-finals', round_final: 'Final',
      ph_winner: 'Winner {0}', ph_runner: 'Runner-up {0}', ph_third: '3rd {0}', ph_wmatch: 'Winner M{0}', ph_lmatch: 'Loser M{0}',
      final_meta: '🏆 Final · M104', third_meta: '🥉 3rd place · M103',
      bracket_note_live: "<strong>Round of 32 reflects the current group standings</strong> from the results you've entered ({0}/12 groups final). Placings still in play are <span class=\"prov-eg\">underlined</span> — they can change as more matches are played. Knockout rounds aren't predicted: they show which match feeds each slot.",
      bracket_note_done: 'Group stage complete. <strong>Round of 32 is locked</strong> (FIFA Annexe C allocates the 8 best thirds). Knockout rounds show which match feeds each slot and fill in as those games are played.',
      goal_title: '⚽ GOAL!',
      alert_on: 'Goal alerts on (sound + notification) — click to mute',
      alert_off: 'Goal alerts off — click to enable',
      tab_install: 'Install',
      install_title: 'Install the app',
      install_subtitle: 'Add Quién Pasa to your home screen for full-screen, offline-ready access.',
      install_btn: '⬇  Install app',
      install_done: '✓ Installed! Look for the icon on your home screen.',
      install_already: '✓ You are already using the installed app.',
      install_dismissed: 'Install was cancelled. You can install it manually with the steps below.',
      install_why: 'Why install?',
      install_why_1: 'Opens full-screen, with no browser bars.',
      install_why_2: 'Launches from your home screen like a native app.',
      install_why_3: 'Loads instantly and keeps working offline.',
      install_manual_intro: 'Prefer to do it by hand, or the button did nothing? Follow the steps for your device:',
      install_manual_intro_nobtn: 'Your browser does not offer one-tap install here, so add it manually:',
      install_other_platforms: 'Steps for other devices',
      install_unsupported: 'No install option anywhere? Your browser may not support it — try Chrome, Edge, or Safari.',
      install_ios_title: 'iPhone / iPad — Safari',
      install_ios_1: 'Tap the Share button (the square with an up arrow) in the toolbar.',
      install_ios_2: 'Scroll down and choose “Add to Home Screen”.',
      install_ios_3: 'Tap “Add” at the top right. The icon appears on your home screen.',
      install_android_title: 'Android — Chrome',
      install_android_1: 'Open the ⋮ menu at the top right.',
      install_android_2: 'Tap “Add to Home screen” or “Install app”.',
      install_android_3: 'Confirm with “Install”.',
      install_desktop_title: 'Desktop — Chrome / Edge',
      install_desktop_1: 'Click the install icon in the address bar (right side), or open the ⋮ menu.',
      install_desktop_2: 'Click “Install Quién Pasa”.',
      install_desktop_3: 'Confirm with “Install”.',
      rules_html: RULES_EN,
    },
    es: {
      tab_groups: 'Grupos', tab_fixtures: 'Partidos', tab_thirds: 'Mejores terceros', tab_bracket: 'Eliminatorias', tab_rules: 'Reglas de desempate',
      group_label: 'Grupo',
      fixtures_hint: 'Resultados recientes, en vivo y próximos, en orden. Horarios en tu zona horaria local.',
      fix_live: 'EN VIVO', fix_ft: 'Final', cd_in: 'en {0}', fix_soon: 'por comenzar', fix_vs: 'vs',
      fix_upcoming: 'En vivo y próximos', fix_results: 'Resultados', fix_recent: 'Resultados recientes', fix_earlier: 'Resultados anteriores ({0})',
      fix_filter_upcoming: 'Próximos', fix_filter_previous: 'Anteriores', fix_live_now: 'En vivo ahora',
      fix_none_upcoming: 'No hay próximos partidos.', fix_none_previous: 'Aún no hay partidos anteriores.', fix_loading: 'Cargando…',
      fix_no_detail: 'No hay detalles del partido.',
      ev_title: 'Sucesos del partido', st_title: 'Estadísticas',
      st_possession: 'Posesión', st_shots: 'Tiros', st_sot: 'Tiros a puerta', st_corners: 'Córners', st_fouls: 'Faltas',
      legend_1st: '1º (avanza)', legend_2nd: '2º (avanza)', legend_3rd: '3º (avanzan los 8 mejores)', legend_out: 'Eliminado',
      groups_reset: 'Reiniciar pronósticos',
      thirds_title: 'Clasificación de los 12 terceros',
      thirds_caption: 'Los <strong>8 mejores</strong> avanzan a los dieciseisavos. Se ordenan por puntos → diferencia de goles → goles a favor → juego limpio (conducta) → Ranking Mundial FIFA.',
      rules_title: 'Reglamento de desempate FIFA',
      rules_subtitle: 'Cómo se deciden las posiciones y los mejores terceros.',
      thirds_note: '<strong>{0} de 12</strong> terceros avanzan. La clasificación es <strong>provisional</strong> hasta que terminen todos los partidos de grupos ({1}/{2} jugados).',
      col_team: 'Equipo', col_grp: 'Grp', col_status: 'Estado', col_decisive: 'Factor decisivo (vs. equipo de abajo)',
      col_p: 'PJ', col_w: 'G', col_d: 'E', col_l: 'P', col_gf: 'GF', col_ga: 'GC', col_gd: 'DG', col_pts: 'Pts', col_fp: 'JL', col_rk: 'Rk',
      col_r32: '16°', tip_r32: 'Rival en dieciseisavos (si se mantiene la tabla)', r32_out: 'No avanza',
      tip_played: 'Partidos jugados / pronosticados',
      tip_yellow: 'Tarjetas amarillas', tip_red: 'Tarjetas rojas', tip_fp: 'Puntuación de conducta (desempate)', tip_rk: 'Ranking Mundial FIFA (desempate final)',
      badge_in: 'AVANZA', badge_out: 'FUERA',
      elim_tag: 'FUERA', elim_tip: 'Eliminado matemáticamente: no puede terminar entre los 3 primeros del grupo, así que no puede ser mejor tercero.',
      played_count: '{0}/{1} jugados',
      edge_points: 'Más puntos que {0} ({1} vs {2}).',
      gedge_h2h_pts: 'Igualados a {0} pts → puntos entre ellos ({1} vs {2}).',
      gedge_h2h_gd: 'Igualados a {0} pts → diferencia de goles entre ellos ({1} vs {2}).',
      gedge_h2h_gf: 'Igualados a {0} pts → goles entre ellos ({1} vs {2}).',
      gedge_gd: 'Igualados a {0} pts → mejor diferencia de goles ({1} vs {2}).',
      gedge_gf: 'Igualados en pts y DG → más goles ({0} vs {1}).',
      gedge_fp: 'Igualados en pts/DG/goles → mejor juego limpio ({0} vs {1}).',
      gedge_rank: 'Todo igualado → mejor ranking FIFA (#{0} vs #{1}).',
      edge_gd: 'Igualados a {0} pts → mejor diferencia de goles ({1} vs {2}).',
      edge_gf: 'Igualados en pts y DG → más goles a favor ({0} vs {1}).',
      edge_fp: 'Igualados en pts/DG/goles → mejor juego limpio ({0} vs {1}).',
      edge_rank: 'Registro idéntico → mejor ranking FIFA (#{0} vs #{1}).',
      bracket_hint: 'Toca un equipo para elegir quién avanza.',
      bracket_reset: 'Reiniciar', champion: 'Campeón',
      share_btn: 'Compartir', share_working: 'Preparando…', share_saved: 'Imagen guardada · enlace copiado',
      share_title: 'Mundial 2026 — mi cuadro',
      share_text: 'Mi cuadro del Mundial 2026, ¿quién creés que pasa?',
      share_pickhint: 'Toca los equipos en la app para simular las eliminatorias.',
      round_r32: 'Dieciseisavos', round_r16: 'Octavos', round_qf: 'Cuartos', round_sf: 'Semifinales', round_final: 'Final',
      ph_winner: 'Ganador {0}', ph_runner: 'Segundo {0}', ph_third: '3º {0}', ph_wmatch: 'Ganador M{0}', ph_lmatch: 'Perdedor M{0}',
      final_meta: '🏆 Final · M104', third_meta: '🥉 3er puesto · M103',
      bracket_note_live: '<strong>Los dieciseisavos reflejan la clasificación actual de los grupos</strong> según los resultados introducidos ({0}/12 grupos definidos). Las posiciones aún en juego van <span class="prov-eg">subrayadas</span> — pueden cambiar con los próximos partidos. Las eliminatorias no se predicen: muestran qué partido alimenta cada hueco.',
      bracket_note_done: 'Fase de grupos completada. <strong>Los dieciseisavos están fijados</strong> (el Anexo C de la FIFA asigna los 8 mejores terceros). Las eliminatorias muestran qué partido alimenta cada hueco y se completan según se juegan.',
      goal_title: '⚽ ¡GOL!',
      alert_on: 'Alertas de gol activadas (sonido + notificación) — clic para silenciar',
      alert_off: 'Alertas de gol desactivadas — clic para activar',
      tab_install: 'Instalar',
      install_title: 'Instala la app',
      install_subtitle: 'Añade Quién Pasa a tu pantalla de inicio para acceso a pantalla completa y sin conexión.',
      install_btn: '⬇  Instalar app',
      install_done: '✓ ¡Instalada! Busca el icono en tu pantalla de inicio.',
      install_already: '✓ Ya estás usando la app instalada.',
      install_dismissed: 'Se canceló la instalación. Puedes instalarla manualmente con los pasos de abajo.',
      install_why: '¿Por qué instalar?',
      install_why_1: 'Se abre a pantalla completa, sin barras del navegador.',
      install_why_2: 'Se inicia desde tu pantalla de inicio como una app nativa.',
      install_why_3: 'Carga al instante y sigue funcionando sin conexión.',
      install_manual_intro: '¿Prefieres hacerlo a mano o el botón no hizo nada? Sigue los pasos para tu dispositivo:',
      install_manual_intro_nobtn: 'Tu navegador no ofrece instalación con un toque aquí, así que añádela manualmente:',
      install_other_platforms: 'Pasos para otros dispositivos',
      install_unsupported: '¿No aparece ninguna opción de instalar? Puede que tu navegador no lo admita — prueba Chrome, Edge o Safari.',
      install_ios_title: 'iPhone / iPad — Safari',
      install_ios_1: 'Toca el botón Compartir (el cuadrado con una flecha hacia arriba) en la barra.',
      install_ios_2: 'Baja y elige «Añadir a pantalla de inicio».',
      install_ios_3: 'Toca «Añadir» arriba a la derecha. El icono aparece en tu pantalla de inicio.',
      install_android_title: 'Android — Chrome',
      install_android_1: 'Abre el menú ⋮ arriba a la derecha.',
      install_android_2: 'Toca «Añadir a pantalla de inicio» o «Instalar app».',
      install_android_3: 'Confirma con «Instalar».',
      install_desktop_title: 'Escritorio — Chrome / Edge',
      install_desktop_1: 'Haz clic en el icono de instalar de la barra de direcciones (a la derecha), o abre el menú ⋮.',
      install_desktop_2: 'Haz clic en «Instalar Quién Pasa».',
      install_desktop_3: 'Confirma con «Instalar».',
      rules_html: RULES_ES,
    },
  };

  function t(key) {
    let s = (S[LANG] && S[LANG][key] != null) ? S[LANG][key] : (S.en[key] != null ? S.en[key] : key);
    for (let i = 1; i < arguments.length; i++) s = s.split('{' + (i - 1) + '}').join(String(arguments[i]));
    return s;
  }
  function teamName(team) {
    if (!team) return '';
    return (LANG === 'es' && NAMES_ES[team.id]) ? NAMES_ES[team.id] : team.name;
  }
  function month(i) { return (MONTHS[LANG] || MONTHS.en)[i] || ''; }
  function setLang(l) {
    if (l !== 'en' && l !== 'es') return;
    try { localStorage.setItem('wc2026-lang', l); } catch (e) {}
    LANG = l;
  }
  function lang() { return LANG; }

  global.WCI18N = { t, teamName, month, setLang, lang };
})(typeof window !== 'undefined' ? window : globalThis);
