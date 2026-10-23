/* MomoCAD — module d'apprentissage (🎓 Apprendre avec Momo)
   Fichier compagnon de MomoCAD : à placer dans le même dossier que index.html.
   Il n'est chargé qu'à l'ouverture d'un tuto. Momo, la mascotte, explique à quoi sert chaque outil,
   fait faire le geste sur le plan, coche l'étape quand elle est réussie ; on avance soi-même avec les flèches. */
(function () {
    'use strict';
    if (window.MomoTuto) return;

    // ---------- accès à l'état de MomoCAD (variables globales du script principal) ----------
    const G = {
        mode: () => { try { return mode; } catch (e) { return ''; } },
        shapes: () => { try { return shapes; } catch (e) { return []; } },
        sel: () => { try { return selectedShapes; } catch (e) { return []; } },
        hist: () => { try { return historyStep; } catch (e) { return 0; } },
        layers: () => { try { return layers; } catch (e) { return []; } },
        active: () => { try { return activeLayerId; } catch (e) { return ''; } },
        snap: (k) => { try { return !!snapSettings[k]; } catch (e) { return false; } },
        ortho: () => { try { return !!orthoMode; } catch (e) { return false; } },
        polar: () => { try { return !!t2Polar.on; } catch (e) { return false; } },
        measured: () => { try { return mode === 'measure' && t2.ms.length >= 2; } catch (e) { return false; } },
        chain: () => { try { return dimChain; } catch (e) { return ''; } },
        dimAligned: () => { try { return !!dimTextAligned; } catch (e) { return false; } },
        psTab: () => { const e = document.querySelector('#cartouche-modal .ps-panel.on'); return e && G.shown('cartouche-modal') ? e.dataset.panel : ''; },
        val: (id) => { const e = document.getElementById(id); return e ? e.value : ''; },
        modalHas: (txt) => G.shown('topo-modal') && (document.getElementById('topo-modal').textContent || '').includes(txt),
        plats: () => { try { return G.shapes().filter(isPlateforme).length; } catch (e) { return 0; } },
        is3D: () => { try { return typeof is3DOpen === 'function' && !!is3DOpen(); } catch (e) { return false; } },
        kind: (k) => G.shapes().filter(x => x.solid && x.solid.kind === k).length,
        named: (n) => G.shapes().filter(x => x.type === 'mesh' && x.name === n).length,
        palOpen: (k) => { const e = document.querySelector('.pal[data-pal="' + k + '"]'); return !!e && !e.classList.contains('closed'); },
        shown: (id) => { const e = document.getElementById(id); return !!e && !e.classList.contains('hidden') && e.style.display !== 'none' && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; },
    };
    let changes = 0;   // nombre d'actions enregistrées (chaque modification du plan passe par saveState)
    if (typeof window.saveState === 'function' && !window.saveState.__tuto) {
        const orig = window.saveState;
        window.saveState = function () { const r = orig.apply(this, arguments); changes++; return r; };
        window.saveState.__tuto = true;
    }
    const count = (type) => G.shapes().filter(s => !type || s.type === type).length;
    const K = (t) => `<kbd>${t}</kbd>`, SP = K('Espace');
    const ol = (...a) => '<ol>' + a.map(x => `<li>${x}</li>`).join('') + '</ol>';
    const seen = (m) => (c) => { if ([].concat(m).includes(G.mode())) c.seen = true; };
    // « l'outil a été utilisé et le plan a changé »
    const used = (m) => madeWith(m, 1);
    const more = (m) => madeWith(m, 1);

    // ---------- les étapes ----------
    // title · why (à quoi ça sert, pourquoi) · do (ce qu'on fait) · more (astuce) · target / tip (bouton montré)
    // wait (ctx) -> true quand c'est réussi : l'étape se coche, on passe à la suite avec ▶ quand on veut
    // ---------- exercices : un modèle à reproduire, chaque étape vérifie le VRAI résultat ----------
    // Le modèle est dessiné en pointillés sur le plan (jaune = à faire maintenant, vert = déjà fait) ; ses points s'accrochent.
    let A = { x: 0, y: 0 };                                       // ancrage de l'exercice (point 0,0 du modèle), en coordonnées du plan
    const mw = (v) => { try { return mmToWorld(v * 1000); } catch (e) { return v * 5000; } };
    const W = (x, y) => ({ x: A.x + mw(x), y: A.y - mw(y) });    // mètres (Y vers le haut) -> plan
    const TOL = () => mw(0.08);
    const near = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) <= TOL();
    const U = (v) => { try { const k = 1000 / (UNIT_MM[currentUnit] || 1); return String(+(v * k).toFixed(3)).replace('.', ','); } catch (e) { return String(v).replace('.', ','); } };
    const UN = () => { try { return currentUnit; } catch (e) { return 'm'; } };
    const sameSeq = (P, Q) => P.length === Q.length && P.every((p, i) => near(p, Q[i]));
    const sameSet = (P, Q) => P.length === Q.length && Q.every(q => P.some(p => near(p, q)));
    const hasLine = (a, b) => { const P = W(...a), Q = W(...b); return G.shapes().some(s => s.type === 'line' && ((near({ x: s.x1, y: s.y1 }, P) && near({ x: s.x2, y: s.y2 }, Q)) || (near({ x: s.x1, y: s.y1 }, Q) && near({ x: s.x2, y: s.y2 }, P)))); };
    const polyOf = (pts, closed) => { const Q = pts.map(p => W(...p)); return G.shapes().find(s => s.type === 'poly' && !s.solid && !!s.open === !closed && (closed ? sameSet(s.points, Q) : (sameSeq(s.points, Q) || sameSeq(s.points, Q.slice().reverse())))); };
    const circleOf = (c, r) => { const C = W(...c); return G.shapes().find(s => s.type === 'circle' && near(s, C) && Math.abs(s.r - mw(r)) <= TOL()); };
    const arcOf = (c, r) => { const C = W(...c); return G.shapes().find(s => s.type === 'arc' && near(s, C) && Math.abs(s.r - mw(r)) <= TOL()); };
    const hatchAt = (p) => { const P = W(...p); return G.shapes().some(s => s.type === 'hatch' && typeof pointInHatch === 'function' && pointInHatch(s, P.x, P.y)); };
    const gl = (a, b, o) => Object.assign({ t: 'line', a: W(...a), b: W(...b), snap: [W(...a), W(...b)] }, o || {});
    const gp = (pts, closed, o) => { const Q = pts.map(p => W(...p)); return Object.assign({ t: 'poly', pts: Q, closed: !!closed, snap: Q }, o || {}); };
    const gc = (c, r, o) => Object.assign({ t: 'circle', c: W(...c), r: mw(r), snap: [W(...c)] }, o || {});
    // arc du modèle : centre, rayon, angles en degrés (sens trigonométrique, Y vers le haut), de a0 à a1
    const ga = (c, r, a0, a1, o) => { const C = W(...c), R = mw(r), P = (d) => W(c[0] + r * Math.cos(d * Math.PI / 180), c[1] + r * Math.sin(d * Math.PI / 180)); return Object.assign({ t: 'arc', c: C, r: R, a0: -a1 * Math.PI / 180, a1: -a0 * Math.PI / 180, snap: [C, P(a0), P(a1)] }, o || {}); };
    const garrow = (a, b, o) => Object.assign({ t: 'arrow', a: W(...a), b: W(...b), snap: [W(...a), W(...b)] }, o || {});
    // place l'exercice au centre de la vue et cadre le modèle (xmin..xmax, ymin..ymax en m) à gauche de Momo
    function setupExercise(x0, x1, y0, y1, padR) {   // padR : place gardée à droite (rosace, fenêtres d'outils)
        try {
            if (typeof setMode === 'function') setMode('select-box');
            // les exercices se font en mètres : on y passe si le dessin était dans une autre unité
            if (typeof printSettings !== 'undefined' && printSettings.unit !== 'm') { printSettings.unit = 'm'; applyUnitSettings(); try { refreshGridField(); updateCursorCoords(); } catch (e) {} }
            // zone libre : à gauche de la bulle de Momo (≈ 560 px à droite)
            const Wd = canvas.width, Hd = canvas.height, zw = Math.max(300, Wd - 460 - (padR || 150)), sx = 460 + zw / 2,   // entre la bulle de Momo (à gauche) et les fenêtres d'outils (à droite)
            sy = Hd * 0.45, z = Math.min(zw / mw(x1 - x0), (Hd * 0.8) / mw(y1 - y0));
            camera.zoom = z; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
            const w0 = screenToWorld(sx, sy); A = { x: Math.round(w0.x / mw(1)) * mw(1) - mw(cx), y: Math.round(w0.y / mw(1)) * mw(1) + mw(cy) };
            const C = W(cx, cy); camera.x = sx - C.x * z; camera.y = sy - C.y * z; draw();
        } catch (e) {}
    }
    // « la nouvelle forme a été faite AVEC cet outil » (et pas avec un autre choisi juste après)
    const madeWith = (m, n) => ({
        init: (c) => { c.L = G.shapes().length; c.k = changes; c.hits = 0; c.pm = G.mode(); },
        tick: (c) => { const L = G.shapes().length, M = [].concat(m); if ((L > c.L || changes > c.k) && (M.includes(c.pm) || M.includes(G.mode()))) c.hits++; c.L = L; c.k = changes; c.pm = G.mode(); },
        wait: (c) => c.hits >= (n || 1) });

    // ===================================================================== 1. DÉBUTANT : le logo MOMOCAD
    // modèle (m) : M 0..3, O centre 5,5 / 2, copie +8,5 -> M 8,5..11,5 et O 14 / 2, C centre 19 / 2, A 22..25, D 26..28,5, double soulignement y = -1 et -1,5
    const S45 = Math.SQRT1_2 * 2, M1 = [[0, 0], [0, 4], [1.5, 2], [3, 4], [3, 0]], M2 = M1.map(([x, y]) => [x + 8.5, y]);
    const BASE = [
        { title: 'Bonjour, je suis Momo !', why: `On va apprendre les outils de base <b>en dessinant pour de vrai</b> : ensemble, on va redessiner le <b>logo MOMOCAD</b>, lettre par lettre. Chaque outil sert à quelque chose dans le logo.`,
          do: `Le modèle est tracé en <b>pointillés</b> sur le plan : en <b style="color:#fbbf24">jaune</b> ce qu'il faut dessiner maintenant, en <b style="color:#4ade80">vert</b> ce qui est fait. Ses points jaunes <b>s'accrochent</b> : visez-les.<br>L'étape se coche ✓ seulement si votre dessin correspond au modèle. Vous avancez avec ${K('▶')}.`,
          more: `Un plan vierge est idéal. Les longueurs sont en mètres (le tuto règle l'unité du dessin sur m). Et pas de panique si tu fermes l'onglet par erreur : MomoCAD range ton travail tout seul toutes les 2 minutes.` },
        { title: 'Se déplacer dans le plan', why: `Avant de dessiner, il faut savoir regarder : zoomer sur un détail, revenir à l'ensemble.`,
          do: `<ul><li><b>molette</b> = zoomer, autour du curseur ;</li><li><b>clic molette maintenu</b> = faire glisser le plan ;</li><li><b>double-clic molette</b> = tout voir.</li></ul>Le modèle du logo est déjà au milieu de l'écran.` },
        // M : demi-M, miroir, joindre
        { title: 'Le M, première moitié', target: 'btn-pline', tip: 'Polyligne<br><small>ou PLI + Espace</small>', ghost: () => [gp([[0, 0], [0, 4], [1.5, 2]], false, { label: '3 points, puis Espace', lp: W(1.5, 2) })],
          why: `La <b>polyligne</b> trace plusieurs segments d'un seul tenant : un seul objet, idéal pour une bordure, un réseau… ou une lettre.`,
          do: ol('Outil <b>Polyligne</b>.', 'Cliquez les 3 points jaunes : en bas à gauche, en haut, puis le milieu.', `${SP} pour terminer.`), more: `Le M est symétrique : on n'en dessine que la moitié, le miroir fera le reste.`,
          wait: () => !!polyOf([[0, 0], [0, 4], [1.5, 2]], false) },
        { title: 'Le M, l\'autre moitié en miroir', target: 'btn-mirror', tip: 'Copie miroir<br><small>ou MI + Espace</small>', ghost: () => [gl([1.5, -0.4], [1.5, 4.4], { label: 'axe du miroir', lp: W(1.5, 4.4), snap: [W(1.5, 0), W(1.5, 4.4)] }), gp([[3, 0], [3, 4], [1.5, 2]])],
          why: `La <b>copie miroir</b> reflète un dessin de l'autre côté d'un axe : on dessine une moitié, on obtient l'autre, parfaitement symétrique.`,
          do: ol('Sélectionnez la demi-lettre (clic dessus).', 'Outil <b>Copie miroir</b>.', 'Cliquez les 2 points de l\'axe vertical (les points jaunes).', `${SP} : le reflet apparaît, l'original reste.`),
          wait: () => !!polyOf([[3, 0], [3, 4], [1.5, 2]], false) },
        { title: 'Le M, d\'un seul morceau', target: 'btn-join', tip: 'Joindre<br><small>ou JO + Espace</small>', ghost: () => [gp(M1)],
          why: `Nos deux moitiés se touchent au milieu. <b>Joindre</b> les réunit en <b>une seule polyligne</b> : un seul objet à sélectionner, une seule longueur au métré.`,
          do: ol(`Sélectionnez les deux moitiés (clic sur l'une, puis clic sur l'autre).`, 'Cliquez <b>Joindre</b>.'), wait: () => !!polyOf(M1, false) },
        // O
        { title: 'Le O', target: 'btn-circle', tip: 'Cercle<br><small>ou RO + Espace</small>', ghost: () => [gc([5.5, 2], 2, { label: () => 'rayon ' + U(2) + ' ' + UN(), lp: W(5.5, 4) })],
          why: `Le <b>cercle</b> : un regard, un arbre, un giratoire… et ici notre O.`,
          do: () => ol('Outil <b>Cercle</b>.', 'Cliquez le <b>centre</b> (le point jaune).', `Tapez le rayon ${K(U(2))} puis ${SP}.`), more: `Taper la valeur au clavier garantit un dessin juste : c'est LE réflexe à prendre.`,
          wait: () => !!circleOf([5.5, 2], 2) },
        // sélection fenêtre + copier
        { title: 'Sélectionner M et O ensemble', target: 'btn-select-box', tip: 'Sélection<br><small>ou Échap</small>', ghost: () => [gp([[-0.6, -0.6], [7.9, -0.6], [7.9, 4.6], [-0.6, 4.6]], true, { label: 'clic ici… puis là', lp: W(-0.6, 4.6), snap: [W(-0.6, 4.6), W(7.9, -0.6)] })],
          why: `Pour agir sur plusieurs objets, on les sélectionne ensemble. Un <b>clic dans le vide, puis un 2<sup>e</sup> clic</b> trace une <b>fenêtre</b> : tracée vers la droite (rose), tout ce qui est entièrement dedans est pris ; vers la gauche (verte), tout ce qu'elle touche.`,
          do: ol(`${K('Échap')} pour l'outil Sélection.`, 'Cliquez un coin de la fenêtre jaune, relâchez, puis cliquez le coin opposé.', 'Le M et le O passent en rose.'),
          more: `Autres gestes : un clic sur un objet ; ou bouton maintenu en glissant = un <b>lasso</b> à main levée.`,
          wait: () => { const m = polyOf(M1, false), o = circleOf([5.5, 2], 2); return !!m && !!o && G.sel().includes(m) && G.sel().includes(o); } },
        { title: 'MOMO : copier M et O', target: 'btn-copy', tip: 'Copier<br><small>ou CP + Espace</small>', ghost: () => [garrow([0, 0], [8.5, 0], { label: 'de ce point… à celui-là', lp: W(8.5, 0) }), gp(M2), gc([14, 2], 2)],
          why: `<b>Copier</b> reproduit un dessin au bon endroit, l'original reste. Pourquoi redessiner « MO » quand on peut le copier ?`,
          do: ol('M et O toujours sélectionnés, outil <b>Copier</b>.', 'Cliquez le point de base : le coin en bas à gauche du M.', 'Cliquez la destination (le point jaune au bout de la flèche).', `${SP} pour terminer.`),
          more: `On peut aussi taper la distance (${U(8.5)}) au lieu de cliquer la destination.`, wait: () => !!polyOf(M2, false) && !!circleOf([14, 2], 2) },
        // C
        { title: 'Le C', target: 'btn-arc', tip: 'Arc<br><small>ou AR + Espace</small>', ghost: () => [ga([19, 2], 2, 45, 315, { label: 'centre, départ en bas, 270°', lp: W(17, 4.2) })],
          why: `L'<b>arc</b> : une bordure courbe, un rayon de giration… et notre C.`,
          do: ol('Outil <b>Arc</b>.', 'Cliquez le <b>centre</b> (point jaune au milieu).', 'Cliquez le <b>départ</b> : le point jaune <b>en bas</b> à droite.', `Tournez la souris autour du centre <b>par le bas, puis vers la gauche</b> : l'arc suit votre geste. Cliquez le point jaune <b>en haut</b> à droite.`), more: `Autre façon, au clavier : après le départ, tapez l'angle ${K('270')} puis ${SP}.`,
          wait: () => { const a = arcOf([19, 2], 2); if (!a) return false; try { const L = W(17, 2); return t2OnArc(a, Math.atan2(L.y - a.y, L.x - a.x)) && t2ArcSweep(a) > 4.4 && t2ArcSweep(a) < 5.0; } catch (e) { return true; } } },
        // A
        { title: 'Le A', target: 'btn-pline', tip: 'Polyligne', ghost: () => [gp([[22, 0], [23.5, 4], [25, 0]])],
          why: `Encore une polyligne : les deux jambes du A.`, do: ol('Outil <b>Polyligne</b>.', 'Cliquez les 3 points jaunes.', `${SP} pour terminer.`),
          wait: () => !!polyOf([[22, 0], [23.5, 4], [25, 0]], false) },
        { title: 'La barre du A, trop longue', target: 'btn-line', tip: 'Droite<br><small>ou DR + Espace</small>', ghost: () => [gl([21.5, 1.5], [25.5, 1.5])],
          why: `La <b>droite</b>, le trait de base. On la trace exprès trop longue : l'outil suivant va la recouper proprement.`,
          do: ol('Outil <b>Droite</b>.', 'Cliquez les 2 points jaunes : elle dépasse des deux côtés du A.'), wait: () => hasLine([21.5, 1.5], [25.5, 1.5]) },
        { title: 'Couper ce qui dépasse', target: 'btn-trim', tip: 'Couper<br><small>ou C + Espace</small>', ghost: () => [gl([22.5625, 1.5], [24.4375, 1.5], { label: 'garder seulement ce morceau', lp: W(24.5, 1.5) })],
          why: `<b>Couper</b> nettoie les dépassements : on clique le morceau en trop, il disparaît jusqu'au trait qui le croise. Plus besoin de viser les intersections au millimètre.`,
          do: ol('Outil <b>Couper</b>.', 'Cliquez le bout qui dépasse à <b>gauche</b> du A, puis celui qui dépasse à <b>droite</b>.'), wait: () => hasLine([22.5625, 1.5], [24.4375, 1.5]) },
        // D
        { title: 'Le D, d\'abord un rectangle', target: 'btn-rect', tip: 'Rectangle<br><small>ou QR + Espace</small>', ghost: () => [gp([[26, 0], [28.5, 0], [28.5, 4], [26, 4]], true, { label: () => U(2.5) + ' × ' + U(4), lp: W(28.5, 4), snap: [W(26, 0)] })],
          why: `Le <b>rectangle</b> : bâtiment, place de parking, emprise… Ses dimensions se tapent au clavier.`,
          do: () => ol('Outil <b>Rectangle</b>.', 'Cliquez le coin en bas à gauche (point jaune).', `La souris vers le haut à droite, tapez ${K(U(2.5))} ${SP} (largeur) puis ${K(U(4))} ${SP} (hauteur).`),
          wait: () => !!polyOf([[26, 0], [28.5, 0], [28.5, 4], [26, 4]], true) },
        { title: 'Éclater le rectangle', target: 'btn-ungroup', tip: 'Éclater<br><small>ou EC + Espace</small>', ghost: () => [gl([26, 0], [28.5, 0]), gl([28.5, 0], [28.5, 4]), gl([28.5, 4], [26, 4]), gl([26, 4], [26, 0])],
          why: `Un rectangle est un seul objet. <b>Éclater</b> le décompose en 4 droites indépendantes, pour retravailler ses angles.`,
          do: ol('Sélectionnez le rectangle.', 'Cliquez <b>Éclater</b> (juste à côté du cadenas Grouper).'), wait: () => hasLine([26, 0], [28.5, 0]) && hasLine([28.5, 0], [28.5, 4]) && hasLine([28.5, 4], [26, 4]) },
        { title: 'Arrondir le haut du D', target: 'btn-fillet', tip: 'Arrondir<br><small>ou RA + Espace</small>', ghost: () => [ga([27.25, 2.75], 1.25, 0, 90, { label: () => 'R = ' + U(1.25), lp: W(28.6, 4) })],
          why: `<b>Arrondir</b> raccorde deux droites par un arc tangent : un angle de bordure, un rayon de giration… et la panse du D.`,
          do: () => ol('Outil <b>Arrondir</b>.', 'Cliquez le côté <b>du haut</b>, puis le côté <b>de droite</b>.', `Tapez le rayon ${K(U(1.25))} puis ${SP}.`), wait: () => !!arcOf([27.25, 2.75], 1.25) },
        { title: 'Arrondir le bas du D', target: 'btn-fillet', tip: 'Arrondir', ghost: () => [ga([27.25, 1.25], 1.25, 270, 360)],
          why: `Même geste pour l'angle du bas.`, do: () => ol('Cliquez le côté <b>du bas</b>, puis le côté <b>de droite</b>.', `${SP} seul reprend le dernier rayon (${U(1.25)}).`), wait: () => !!arcOf([27.25, 1.25], 1.25) },
        // soulignement
        { title: 'Le soulignement', target: 'btn-line', tip: 'Droite', ghost: () => [gl([0, -1], [20, -1], { label: () => U(20) + ' ' + UN() + ' vers la droite', lp: W(20, -1), snap: [W(0, -1)] })],
          why: `Une droite <b>à la cote</b> : on clique le départ, on tape la longueur, elle part dans la direction de la souris.`,
          do: () => ol('Outil <b>Droite</b>, cliquez le point jaune de départ.', `Maintenez ${K('Maj')} (trait bien horizontal), souris vers la droite.`, `Tapez ${K(U(20))} puis ${SP}.`), wait: () => hasLine([0, -1], [20, -1]) },
        { title: 'Le soulignement à la bonne longueur', target: 'btn-lengthen', tip: 'Longueur<br><small>ou LO + Espace</small>', ghost: () => [gl([0, -1], [28.5, -1], { label: () => U(28.5) + ' ' + UN(), lp: W(28.5, -1) })],
          why: `Il est trop court ! <b>Longueur</b> donne une longueur exacte à un trait existant, sans le redessiner.`,
          do: () => ol('Outil <b>Longueur</b>.', `Tapez ${K(U(28.5))} puis ${SP} : c'est la longueur totale voulue.`, 'Cliquez près du bout <b>droit</b> du trait : il s\'allonge.'), wait: () => hasLine([0, -1], [28.5, -1]) },
        { title: 'Doubler le soulignement', target: 'btn-offset', tip: 'Décaler<br><small>ou DE + Espace</small>', ghost: () => [gl([0, -1.5], [28.5, -1.5], { label: () => U(0.5) + ' ' + UN() + ' plus bas', lp: W(28.5, -1.5) })],
          why: `<b>Décaler</b> crée une copie parallèle à distance fixe : une bordure, un trottoir, un fil d'eau… et ici un double trait.`,
          do: () => ol('Outil <b>Décaler</b>, tapez la distance ' + K(U(0.5)) + ' puis ' + SP + '.', 'Cliquez le soulignement.', 'Cliquez <b>en dessous</b> : la copie apparaît.'), wait: () => hasLine([0, -1.5], [28.5, -1.5]) },
        // hachures
        { title: 'Remplir les O', target: 'btn-hatch', tip: 'Hachure<br><small>ou HA + Espace</small>', ghost: () => [gc([5.5, 2], 1.95), gc([14, 2], 1.95)],
          why: `La <b>hachure</b> remplit une zone fermée et donne sa surface : un enrobé, un espace vert… ou nos deux O.`,
          do: ol('Outil <b>Hachure</b>.', 'Cliquez <b>à l\'intérieur</b> du premier O, puis du second.', 'La surface s\'affiche en bas de l\'écran.'), wait: () => hatchAt([5.5, 2]) && hatchAt([14, 2]) },
        { title: 'Votre logo !', why: `Regardez : <b>MOMOCAD</b>, dessiné à la cote. Polyligne, miroir, joindre, cercle, sélection, copier, arc, droite, couper, rectangle, éclater, arrondir, longueur, décaler, hachure : vous avez utilisé 15 outils.`,
          do: `Double-clic molette pour tout voir. ${K('Ctrl')}+${K('Z')} annule une action, ${K('Ctrl')}+${K('Y')} la refait ; ${K('Suppr')} efface la sélection.`,
          more: `Prochain tuto : <b>Les outils avancés</b> (niveau Initié) : un petit parking, avec calques, réseau, cotes et blocs.`, last: true },
    ];

    // ===================================================================== 2. INITIÉ : un petit parking
    // modèle (m) : emprise 0,0 – 20,12 ; places 2,5 × 5 depuis 1,0 (6 places) ; accès en biais 20,4 -> 45° 4 m ; haie y = 14 ; regard centre 10,9 r 0,5
    const AC = [20 + 4 * Math.SQRT1_2, 4 + 4 * Math.SQRT1_2], ACM = [20 + 2 * Math.SQRT1_2, 4 + 2 * Math.SQRT1_2], PLACE = (k) => [[1 + 2.5 * k, 0], [3.5 + 2.5 * k, 0], [3.5 + 2.5 * k, 5], [1 + 2.5 * k, 5]];
    const parkLayer = () => G.layers().find(l => /parking/i.test(l.name || ''));
    const ADV = [
        { title: 'Les outils avancés', why: `On passe à la vitesse supérieure avec un vrai petit projet : <b>un parking</b>. Calques, accroches, suivi polaire, réseau de places, arbres plantés, cotes, regard, textes, mesure, puis métré et impression.`,
          do: `Comme pour le logo, le modèle est en pointillés : jaune = maintenant, vert = fait. L'étape se coche quand votre dessin correspond.`, more: `Le tuto « Les outils de base » est conseillé avant celui-ci.` },
        { title: 'Les points d\'accroche', target: 'snapbtn-endpoint', tip: 'Barre des accroches', why: `Un trait qui « tombe presque » sur un autre fausse les surfaces, les hachures et les cubatures. Les <b>accroches</b> font sauter le curseur exactement sur le bout d'un trait, son milieu, un centre, un croisement, une tangente…`,
          do: `Regardez la barre jaune en haut : un bouton par type d'accroche, allumé = actif. Le repère n'apparaît que pendant un tracé.` },
        { title: 'Un calque Parking', target: 'button[onclick="openLayerModal()"]', tip: 'Gérer les calques', why: `Les calques rangent le dessin comme des transparents : chacun sa couleur, son trait, et surtout le <b>métré compte par calque</b>.`,
          do: ol('Ouvrez le gestionnaire de calques.', `Tapez <b>Parking</b> dans « Nouveau calque », puis ${K('Entrée')}.`, 'Il devient le calque actif ; fermez le gestionnaire.'), more: `Ici c'est ${K('Entrée')} qui valide : l'espace sert à écrire le nom.`,
          wait: () => { const l = parkLayer(); return !!l && G.active() === l.id && !G.shown('layer-modal'); } },
        { title: 'L\'emprise du parking', target: 'btn-rect', tip: 'Rectangle', ghost: () => [gp([[0, 0], [20, 0], [20, 12], [0, 12]], true, { label: () => U(20) + ' × ' + U(12), lp: W(20, 12), snap: [W(0, 0)] })],
          why: `Le contour du parking, sur le calque Parking.`, do: () => ol('Outil <b>Rectangle</b>, cliquez le coin jaune.', `Souris en haut à droite, tapez ${K(U(20))} ${SP} puis ${K(U(12))} ${SP}.`),
          wait: () => { const r = polyOf([[0, 0], [20, 0], [20, 12], [0, 12]], true), l = parkLayer(); return !!r && (!l || r.layerId === l.id); } },
        { title: 'L\'accès en biais (suivi polaire)', target: 'btn-toggle-polar', tip: 'Suivi polaire<br><small>ou F10</small>', ghost: () => [gl([20, 4], AC, { label: () => '45° · ' + U(4) + ' ' + UN(), lp: W(...AC), snap: [W(20, 4)] })],
          why: `Le <b>suivi polaire</b> aimante le trait aux angles ronds (15°, 30°, 45°…) : pas de calcul pour tracer en biais.`,
          do: () => ol(`Allumez le suivi polaire : ${K('F10')} (l'Ortho ${K('F8')} doit être éteint).`, 'Outil <b>Droite</b>, cliquez le point jaune sur le bord droit.', `Approchez la souris vers 45° en haut à droite : une ligne pointillée bleue apparaît.`, `Tapez ${K(U(4))} puis ${SP}.`),
          wait: () => hasLine([20, 4], AC) },
        { title: 'Une place de parking', target: 'btn-rect', tip: 'Rectangle', ghost: () => [gp(PLACE(0), true, { label: () => U(2.5) + ' × ' + U(5), lp: W(3.5, 5), snap: [W(1, 0)] })],
          why: `Une place standard fait 2,50 × 5,00 m.`, do: () => ol('Outil <b>Rectangle</b>, cliquez le coin jaune.', `Tapez ${K(U(2.5))} ${SP} puis ${K(U(5))} ${SP}.`), wait: () => !!polyOf(PLACE(0), true) },
        { title: 'Six places d\'un coup : le réseau', target: 'btn-array', tip: 'Réseau<br><small>ou RE + Espace</small>', ghost: () => [1, 2, 3, 4, 5].map(k => gp(PLACE(k), true)),
          why: `Le <b>réseau</b> répète un objet de façon régulière, en une fois, avec un aperçu en direct : des places, des plots, des bornes, des candélabres…`,
          do: () => ol('Sélectionnez la place.', 'Outil <b>Réseau</b>, onglet <b>Grille</b>.', `<b>6</b> colonnes, <b>1</b> ligne, écart entre colonnes ${K(U(2.5))}.`, 'Vérifiez l\'aperçu, puis <b>Créer</b>.'),
          wait: () => [0, 1, 2, 3, 4, 5].every(k => !!polyOf(PLACE(k), true)) },
        { title: 'La limite plantée', target: 'btn-line', tip: 'Droite', ghost: () => [gl([0, 14], [20, 14])], why: `Une haie d'arbres le long du parking : on trace d'abord sa ligne.`,
          do: ol('Outil <b>Droite</b>.', 'Cliquez les 2 points jaunes.'), wait: () => hasLine([0, 14], [20, 14]) },
        { title: 'Planter les arbres : diviser', target: 'btn-divide', tip: 'Diviser<br><small>ou DV + Espace</small>', ghost: () => [5, 10, 15].map(x => gc([x, 14], 1.2)),
          why: `<b>Diviser</b> jalonne un tracé sans le couper : un regard tous les 50 m, un candélabre tous les 25 m… ou un arbre tous les 5 m.`,
          do: ol('Outil <b>Diviser</b>, cliquez la ligne plantée.', 'Choisissez <b>En parts égales</b> : 4 parts.', 'Que poser : <b>❖ Bloc</b> → « Arbre feuillu ».', 'Décochez « aux deux bouts », puis <b>Poser</b>.'),
          wait: () => { try { const grp = new Set(G.shapes().filter(s => s.block && s.groupId).map(s => s.groupId)); return [5, 10, 15].every(x => { const P = W(x, 14); return [...grp].some(g => { const m = G.shapes().filter(s => s.groupId === g); const b = getShapesBoundingBox(m); return b && Math.hypot(b.centerX - P.x, b.centerY - P.y) < mw(0.6); }); }); } catch (e) { return false; } } },
        { title: 'Coter la largeur', target: 'btn-dim-ortho', tip: 'Cote ortho', ghost: () => [gl([0, -2], [20, -2], { label: () => U(20) + ' ' + UN(), lp: W(10, -2), snap: [W(0, 0), W(20, 0)] })],
          why: `Une <b>cote</b> affiche une distance sur le plan, et se met à jour si l'on déplace ses points.`,
          do: ol('Outil <b>Cote ortho</b>.', 'Cliquez les deux coins du bas de l\'emprise.', 'Cliquez sous le parking pour placer la ligne de cote.'),
          more: `L'allure des cotes (extrémités, traits, position et fond de la valeur) se règle dans Paramètres, onglet <b>Cotes</b>.`,
          wait: () => G.shapes().some(s => s.type === 'dim' && (() => { try { const g = dimGeom(s); return g && Math.abs(g.dist - mw(20)) <= TOL(); } catch (e) { return false; } })()) },
        { title: 'Le regard', target: 'btn-circle', tip: 'Cercle', ghost: () => [gc([10, 9], 0.5, { label: () => 'rayon ' + U(0.5), lp: W(10.5, 9.5) })],
          why: `Un regard d'eaux pluviales au milieu de l'allée.`, do: () => ol('Outil <b>Cercle</b>, cliquez le centre jaune.', `Tapez ${K(U(0.5))} puis ${SP}.`), wait: () => !!circleOf([10, 9], 0.5) },
        { title: 'Coter le regard', target: 'btn-dim-dia', tip: 'Cote de diamètre<br><small>ou CD + Espace</small>', why: `La <b>cote de diamètre</b> (ou de rayon, juste à côté) indique la taille d'un cercle : regard, bassin, giration.`,
          do: ol('Outil <b>Cote de diamètre</b>.', 'Cliquez le regard.', 'Placez le texte à l\'extérieur et cliquez.'), wait: () => G.shapes().some(s => s.type === 'dimr') },
        { title: 'Le nom du parking', target: 'btn-text', tip: 'Texte<br><small>ou TX + Espace</small>', why: `Nommer les ouvrages rend le plan lisible.`,
          do: `Outil <b>Texte</b> : cliquez au milieu du parking, tapez <b>PARKING</b>, puis ${K('Entrée')}.`, wait: () => G.shapes().some(s => s.type === 'text' && /parking/i.test(s.content || '')) },
        { title: 'Signaler l\'entrée', target: 'btn-detail', tip: 'Infobulle<br><small>ou IF + Espace</small>', ghost: () => [garrow([23, 9.5], ACM, { label: 'Entrée', lp: W(23, 9.5), snap: [W(...ACM), W(23, 9.5)] })],
          why: `L'<b>infobulle</b> est une étiquette reliée par une flèche à ce qu'elle désigne. Ici, on écrit « Entrée » à côté de l'accès en biais, pour que le lecteur du plan sache par où entrer.`,
          do: ol('Outil <b>Infobulle</b>.', '1<sup>er</sup> clic : la <b>pointe de la flèche</b>, sur le point jaune au milieu de l\'accès.', '2<sup>e</sup> clic : l\'<b>emplacement de l\'étiquette</b>, sur le second point jaune.', `Une zone de texte s'ouvre : écrivez le mot <b>Entrée</b>, puis appuyez sur la touche ${K('Entrée')} du clavier pour valider.`),
          more: `Le mot et la touche ont le même nom, c'est un hasard : on écrit « Entrée », puis on valide avec la touche ${K('Entrée')}.`,
          wait: () => G.shapes().some(s => s.type === 'detail' && /entr/i.test(s.content || '') && Math.hypot(s.tx - W(...ACM).x, s.ty - W(...ACM).y) <= mw(1.5)) },
        { title: 'Contrôler : mesurer', target: 'btn-measure', tip: 'Mesurer<br><small>ou MES + Espace</small>', why: `Avant d'envoyer un plan, on vérifie : <b>Mesurer</b> donne distances, angle et surface, <b>sans rien dessiner</b>.`,
          do: `Outil <b>Mesurer</b> : cliquez deux coins opposés de l'emprise. La diagonale s'affiche (environ ${U(23.32)} ${UN()}).`, wait: () => G.measured() },
        { title: 'Le métré', target: 'btn-metre', tip: 'Métré<br><small>ou ME + Espace</small>', why: `Le métré transforme le dessin en quantités, <b>par calque</b> : longueurs, surfaces, nombres d'objets.`,
          do: `Ouvrez le <b>Σ Métré</b> : retrouvez le calque Parking. « Copier (tableur) » le colle dans un devis.`, wait: () => G.shown('topo-modal') },
        { title: 'L\'aperçu', target: 'btn-preview', tip: 'Aperçu', why: `Voir la feuille exactement comme elle sortira.`, do: `Fermez le métré puis <b>Aperçu</b>. Molette = échelle, ${SP} = portrait / paysage, ${K('Entrée')} = imprimer, ${K('Échap')} = quitter.`, wait: () => G.mode() === 'preview' },
        { title: 'Bravo, vous êtes initié !', why: `Un vrai petit plan : calque, emprise, accès au suivi polaire, places en réseau, arbres jalonnés, cotes, regard, textes, contrôle et métré.`,
          do: `${K('Ctrl')}+${K('S')} pour l'enregistrer (.mmc) ; le DXF sert à l'échanger.`, more: `Prochain tuto : <b>Le paramétrage</b> (niveau Expert).`, last: true },
    ];

    // ===================================================================== 3. LE PARAMÉTRAGE
    // Chaque étape = des lignes « À toi », vérifiées en direct et dans l'ordre (une ligne se coche quand la précédente l'est et que son geste est fait).
    const P = {};
    const pv = (id) => G.val(id), pnum = (id) => parseFloat(String(pv(id)).replace(/\s/g, '').replace(',', '.'));
    const pck = (id) => { const e = document.getElementById(id); return !!e && e.checked; };
    const pgv = (f) => { try { return f(); } catch (e) { return undefined; } };
    const tabSel = (t) => `#cartouche-modal .ps-tab[data-tab="${t}"]`;
    const segSel = (f, v) => `#cartouche-modal [data-for="${f}"] button[data-v="${v}"]`;
    const swSel = (id) => () => { const e = document.getElementById(id), l = e && e.closest('label'); return l && l.getBoundingClientRect().width ? l : '#cartouche-modal #' + id; };
    const layEU = () => G.layers().find(l => /^eu\b/i.test(String(l.name || '').trim()));
    const euRow = (q) => () => { const l = layEU(); if (!l || !G.shown('layer-modal')) return '#layer-modal #new-layer-name';
        const n = [...document.querySelectorAll('#layers-list .lay-name')].find(x => x.textContent.trim() === l.name); return n ? (q ? n.parentElement.querySelector(q) : n) : '#layer-modal #new-layer-name'; };
    const matOf = (code) => pgv(() => (matEdit || []).find(m => m.code === code)) || null;
    if (typeof window.saveGabarit === 'function' && !window.saveGabarit.__tuto) {
        const og = window.saveGabarit; window.saveGabarit = function () { P.gbt = true; return og.apply(this, arguments); }; window.saveGabarit.__tuto = true;
    }
    // items : [texte, cible, étiquette, contrôle]
    function PS(o) {
        const it = o.items, L = [];
        const cur = () => it.find((x, i) => !L[i]) || it[it.length - 1];
        return Object.assign({}, o, {
            do: ol(...it.map(x => x[0])),
            target: () => { const x = cur(); return typeof x[1] === 'function' ? x[1]() : x[1]; }, tip: () => cur()[2],
            jal: it.map((x, i) => () => !!L[i]),
            init: (c) => { L.length = 0; if (o.init) o.init(c); },
            tick: (c) => { if (o.tick) o.tick(c); it.forEach((x, i) => { if (!L[i] && (i === 0 || L[i - 1])) { let ok = false; try { ok = !!x[3](); } catch (e) {} if (ok) L[i] = true; } }); },
            wait: () => it.every((x, i) => L[i]),
        });
    }
    const PARAM = [
        { title: 'Le paramétrage', why: `Niveau <b>expert</b> ! Aujourd'hui, on ne dessine pas : on règle MomoCAD pour qu'il travaille <b>comme toi et ton entreprise</b>. Pense à un plan qui part en consultation : le format, le cartouche, le logo, la façon d'afficher les cotes, les prix du devis… Tout ça, on le règle une fois, ici, et ensuite chaque plan sort pareil sans que tu y penses.`,
          more: `Je vais prendre mon temps : pour chaque réglage, je t'explique <b>à quoi il sert vraiment</b> sur un chantier, et c'est toi qui le manipules. Chaque ligne du cadre « À toi » se coche dès que c'est bon. Compte une bonne vingtaine de minutes.` },
        PS({ title: 'La fenêtre des Paramètres', why: `Tous les réglages généraux sont rangés au même endroit : le bouton <b>⛯</b>, tout en haut à droite. Il ouvre un grand tiroir qui glisse depuis la droite. À gauche, les <b>onglets</b> ; à droite, les réglages de l'onglet choisi ; et tout en bas, <b>Annuler</b> et <b>Valider</b>.`,
          items: [['Clique sur le bouton <b>Paramètres ⛯</b>, tout en haut à droite.', 'btn-print-settings', 'Paramètres ⛯', () => G.shown('cartouche-modal')]],
          more: `Rien n'est appliqué tant que tu n'as pas cliqué <b>Valider</b> : tu peux tout essayer sans risque, <b>Annuler</b> remet tout comme avant. On validera ensemble, à la fin du tour.` }),
        PS({ title: 'Plan : la précision d\'affichage', why: `Premier onglet, <b>Plan</b>. La <b>précision d'affichage</b>, c'est le nombre de chiffres après la virgule dans tout ce que MomoCAD t'écrit : les cotes, les propriétés d'un objet, les mesures, le métré. Attention, ce n'est que l'<b>affichage</b> : ton dessin garde toujours sa précision complète, rien n'est arrondi dans le fichier.`,
          init: () => { P.saw3 = false; }, tick: () => { if (G.psTab() === 'plan' && +pv('ps-decimals') >= 3) P.saw3 = true; },
          items: [['Clique sur l\'onglet <b>Plan</b>, à gauche.', tabSel('plan'), 'Onglet Plan', () => G.psTab() === 'plan'],
                  ['Monte à <b>3 décimales</b> avec le bouton <b>+</b>. Regarde la case verte : elle affiche maintenant le millimètre.', '#cartouche-modal button[onclick="psDecimals(1)"]', '+ : une décimale de plus', () => P.saw3],
                  ['Redescends à <b>2 décimales</b> avec le bouton <b>−</b> : le centimètre.', '#cartouche-modal button[onclick="psDecimals(-1)"]', '− : une décimale de moins', () => G.psTab() === 'plan' && pv('ps-decimals') === '2']],
          more: `Mon conseil : <b>2 décimales</b> (le centimètre) pour la VRD et le terrassement, <b>3</b> (le millimètre) pour la topo ou un ouvrage. Au-dessus, la ligne <b>Unité du dessin</b> (m, cm ou mm) dit ce que vaut 1 unité tracée : on reste en <b>m</b> pour ce tuto.` }),
        PS({ title: 'Plan : la grille', why: `Juste en dessous, le <b>carreau de la grille</b> : l'écart entre deux traits du quadrillage du fond, dans l'unité du dessin. C'est un repère pour l'œil, rien de plus : la grille ne force pas tes clics (ça, c'est le travail des accroches). Et MomoCAD est malin : quand tu dézoomes et que les carreaux deviennent trop petits à l'écran, il n'en dessine plus qu'un sur dix. Pour la cacher ou la remontrer, c'est le petit rond <b>grille</b>, en bas à gauche de la rosace.`,
          items: [['Clique dans la case <b>Carreau de la grille</b>, efface ce qu\'il y a, et tape <b>1</b> : un carreau d\'un mètre, pratique pour un parking ou une voirie.', '#cartouche-modal #ps-grid', 'Carreau de la grille : tape 1', () => G.psTab() === 'plan' && pnum('ps-grid') === 1]],
          more: `Sur un plan de masse, 5 ou 10 m conviennent aussi. Ce réglage s'appliquera quand on validera.` }),
        PS({ title: 'Impression : la feuille', why: `Onglet <b>Impression</b> : ce sont les réglages de l'<b>impression rapide</b>, le bouton appareil photo en haut de l'écran. Tu choisis le <b>format</b> de la feuille, son <b>orientation</b> et le <b>fichier</b> qui sort. À droite, l'aperçu te montre la feuille avec son cartouche.`,
          items: [['Clique sur l\'onglet <b>Impression</b>.', tabSel('print'), 'Onglet Impression', () => G.psTab() === 'print'],
                  ['Choisis le format <b>A3</b> : le format roi des plans de chantier, lisible, et qui tient dans une sacoche.', segSel('ps-paper', 'A3'), 'Format A3', () => pv('ps-paper') === 'A3'],
                  ['Passe en <b>Paysage</b>.', segSel('ps-orient', 'landscape'), 'Paysage', () => pv('ps-orient') === 'landscape'],
                  ['Vérifie que le fichier produit est bien <b>PDF</b> (clique dessus sinon).', segSel('ps-output', 'pdf'), 'PDF', () => pv('ps-output') === 'pdf']],
          more: `Pourquoi le PDF ? Parce qu'il garde l'<b>échelle exacte</b> : imprimé en A3, ton 1:200 mesure vraiment 1:200 au réglet. Les images (JPEG, PNG) sont en 200 dpi environ : parfait pour coller un extrait dans un mémoire technique ou un mail, mais pas pour mesurer. Et en mode impression, ${K('Espace')} fait pivoter la feuille sans repasser par ici.` }),
        PS({ title: 'Le cartouche : le modèle', why: `Onglet <b>Cartouche</b>. Le cartouche, c'est la <b>carte d'identité du plan</b> : qui l'a dessiné, pour qui, pour quel chantier, et surtout <b>quelle version</b>. Sur un chantier, deux plans qui se ressemblent mais n'ont pas le même indice, c'est la source de la moitié des embrouilles. Alors on le soigne !`,
          items: [['Clique sur l\'onglet <b>Cartouche</b>.', tabSel('cart'), 'Onglet Cartouche', () => G.psTab() === 'cart'],
                  ['Vérifie que l\'interrupteur <b>Imprimer le cartouche</b> est allumé (bleu) ; clique dessus sinon.', swSel('ps-cartouche'), 'Imprimer le cartouche', () => pck('ps-cartouche')],
                  ['Clique sur le modèle <b>A4 grands plans</b> et regarde l\'aperçu : il devient un vrai cartouche de grand plan, avec toutes ses cases.', segSel('ps-carttype', 'a4'), 'Modèle A4', () => pv('ps-carttype') === 'a4']],
          more: `Deux modèles : le <b>minimaliste</b> (70 × 20 mm), discret, pour les petits formats, et l'<b>A4</b>, un cartouche complet à la taille d'une feuille A4, pour les plans en A2 et plus grands. Si tu imprimes en A3 avec le modèle A4, MomoCAD repasse tout seul au minimaliste : pas de cartouche qui mange la moitié de ta feuille.` }),
        PS({ title: 'Le cartouche : les cases', why: `Maintenant, on remplit. Chaque case a son rôle, je te l'explique ligne par ligne. Regarde l'aperçu à droite : il se met à jour pendant que tu tapes.`,
          init: () => { P.plan0 = pv('cartouche-plan'); },
          items: [['<b>Nom du plan</b> : ce que montre la feuille, par exemple « Plan de masse – VRD ». Sur le modèle A4, il peut tenir sur deux lignes.', '#cartouche-modal #cartouche-plan', 'Nom du plan', () => pv('cartouche-plan').trim() !== '' && pv('cartouche-plan') !== P.plan0],
                  ['<b>Indice</b> : la version du plan. On commence à <b>A</b>, puis à chaque modification diffusée on passe à B, C… Tape <b>A</b>.', '#cartouche-modal #cartouche-indice', 'Indice : tape A', () => /^[A-Z]$/i.test(pv('cartouche-indice').trim())],
                  ['<b>Client</b> : celui pour qui tu travailles, en clair (la commune, le promoteur…).', '#cartouche-modal #cartouche-client', 'Client', () => pv('cartouche-client').trim() !== ''],
                  ['<b>Dessinateur</b> : ton nom ou tes initiales. Comme ça, on sait qui appeler !', '#cartouche-modal #cartouche-draftsman', 'Dessinateur', () => pv('cartouche-draftsman').trim() !== '']],
          more: `Les autres cases du modèle A4 (chantier, maître d'ouvrage, maître d'œuvre, conducteur de travaux, phase : AVP, PRO, EXE…) se remplissent pareil. Remplis-les si tu veux : l'aperçu suit en direct.` }),
        PS({ title: 'Le cartouche : les indices', why: `Le <b>tableau des indices</b>, c'est l'historique du plan : chaque ligne dit quelle version, quand, et ce qui a changé (« A – Première diffusion », « B – Ajout du réseau EP »…). Quand le conducteur de travaux a un doute sur le plan qu'il a en main, c'est là qu'il regarde.`,
          init: () => { P.r0 = (pgv(() => psRevs.length) || 0); },
          items: [['Descends un peu dans le cartouche et clique sur <b>+ Ajouter un indice</b> : MomoCAD crée la ligne A, datée d\'aujourd\'hui, avec « Première diffusion ».', '#cartouche-modal button[onclick="psRevAdd()"]', '+ Ajouter un indice', () => (pgv(() => psRevs.length) || 0) > P.r0 || (pgv(() => psRevs.length) || 0) >= (pgv(() => CART_REV_ROWS) || 99)]],
          more: `Le <b>logo</b> se met juste en dessous : « Choisir une image… », puis tu le recadres. Il est gardé dans le gabarit, donc toute l'équipe l'aura. Pas besoin de le faire maintenant.` }),
        PS({ title: 'Fond de plan', why: `Onglet <b>Fond de plan</b> : ici, tu choisis la carte qui viendra se glisser <b>sous</b> ton dessin quand tu utiliseras l'outil Fond de carte. Satellite, photo aérienne de l'IGN, plan des rues ou carte IGN : à toi de voir ce qui t'aide le plus.`,
          items: [['Clique sur l\'onglet <b>Fond de plan</b>.', tabSel('fond'), 'Onglet Fond de plan', () => G.psTab() === 'fond'],
                  ['Choisis <b>Photo IGN</b> : l\'orthophoto, la plus nette en France pour repérer les bordures, les regards, les arbres.', segSel('ps-bmbase', 'ortho'), 'Photo IGN', () => pv('ps-bmbase') === 'ortho'],
                  ['Plus bas, allume <b>Courbes de niveau</b> : d\'un coup d\'œil, tu sais si le terrain monte ou descend.', swSel('ps-ov-courbes'), 'Courbes de niveau', () => pck('ps-ov-courbes')]],
          more: `Ces <b>calques superposés</b> (cadastre, communes, pentes, courbes, cours d'eau, routes) sont téléchargés avec chaque nouveau fond ; le cadastre l'est toujours. Encore plus bas, <b>Points cotés du terrain (IGN)</b> pose une grille de points avec leur altitude : génial pour un avant-projet sans géomètre… mais ça ne remplace jamais un vrai levé ! Il faut Internet pour tout ça.` }),
        PS({ title: 'Présentation : les planches', why: `Onglet <b>Présentation</b> : c'est la feuille des <b>planches de mise en page</b>, celles où tu composes plusieurs vues de ton plan à des échelles différentes (vue d'ensemble, détail, coupe). Rien à voir avec l'impression rapide : ici, on prépare les vrais grands plans.`,
          items: [['Clique sur l\'onglet <b>Présentation</b>.', tabSel('pres'), 'Onglet Présentation', () => G.psTab() === 'pres'],
                  ['Choisis le format <b>A1</b>.', segSel('ps-lppaper', 'A1'), 'Format A1', () => pv('ps-lppaper') === 'A1'],
                  ['Allume les <b>Traits de pliage</b> : des repères sur les bords pour plier la feuille au format A4, cartouche dessus. Le plan rentre dans un classeur, et on lit le cartouche sans déplier.', swSel('ps-lpfold'), 'Traits de pliage', () => pck('ps-lpfold')],
                  ['Mets une <b>marge</b> de <b>10</b> mm : c\'est le cadre de la feuille, et l\'imprimante ne le rognera pas.', '#cartouche-modal #ps-lpmargin', 'Marge : tape 10', () => pnum('ps-lpmargin') === 10]],
          more: `Ce format devient aussi celui des <b>nouveaux plans</b>. Les fenêtres déjà tracées sur une planche, elles, gardent leur place en millimètres.` }),
        PS({ title: 'Momo IA', why: `L'onglet <b>Momo IA</b>, c'est mon côté aide de chantier ! Avec une clé Gemini (gratuite pour commencer) ou Claude (payant à l'usage, avec un bouton pour basculer de l'un à l'autre), je réponds à tes questions directement dans MomoCAD, et je peux même travailler sur ton plan.`,
          items: [['Clique sur l\'onglet <b>Momo IA</b> et regarde ce qu\'on peut y régler.', tabSel('ia'), 'Onglet Momo IA', () => G.psTab() === 'ia']],
          more: `Le réglage important, c'est <b>ce que j'ai le droit de faire</b> : lecture seule ; je demande avant chaque modification (c'est ce que je te conseille : tu vois chaque action et tu dis Autoriser ou Refuser) ; ou je modifie sans demander. Tout ce que je fais s'annule avec ${K('Ctrl')}+${K('Z')}. Et ta clé reste sur ton poste : elle ne part ni dans le plan, ni dans le gabarit.` }),
        PS({ title: 'Les produits : tes prix', why: `Onglet <b>Produits</b> : ton <b>catalogue de prix</b>. C'est lui qui transforme les volumes en euros dans les cubatures et le métré. Chaque colonne a son sens :<ul style="margin:6px 0 0 16px;list-style:disc"><li><b>t/m³</b> : la densité <b>en place</b>. Une GNT compactée pèse environ 2,1 t/m³ : 10 m³ en place, c'est 21 t à commander.</li><li><b>Fois.</b> : le foisonnement. Une terre qu'on creuse gonfle : avec 1,25, 100 m³ en place font 125 m³ dans les camions. C'est ce qui compte pour les rotations et la décharge.</li><li><b>Prix</b> et son <b>unité</b> (la tonne, le m³ ou le m²) : MomoCAD fait la conversion tout seul.</li><li>La case <b>m²</b>, au bout : pour un produit sans épaisseur, comme un géotextile.</li></ul>`,
          items: [['Clique sur l\'onglet <b>Produits</b>.', tabSel('mat'), 'Onglet Produits', () => G.psTab() === 'mat'],
                  ['Les deux premières lignes, c\'est le <b>terrassement</b>. Dans la colonne <b>Prix</b> du <b>DÉBLAI</b>, tape <b>12</b> (€ le m³), puis ' + K('Entrée') + '.', '#ps-mat-box .mat-terr input:nth-of-type(3)', 'Prix du déblai : 12', () => +((matOf('__DEB') || {}).prix) > 0],
                  ['Dans la case <b>Filtrer…</b>, tape <b>0/31</b> : seule la grave 0/31,5 reste (avec le terrassement).', '#cartouche-modal #ps-mat-q', 'Filtrer : tape 0/31', () => /0\/31/.test(pv('ps-mat-q'))],
                  ['Donne un prix à la <b>Grave non traitée 0/31,5</b> : tape <b>28</b> (€ la tonne) dans sa colonne <b>Prix</b>, puis ' + K('Entrée') + '.', () => { const r = [...document.querySelectorAll('#ps-mat-box .mat-grid:not(.mat-terr)')].find(x => /0\/31/.test((x.querySelector('input') || {}).value || '')); return (r && r.querySelectorAll('input')[3]) || '#cartouche-modal #ps-mat-q'; }, 'Prix de la GNT 0/31,5', () => +((matOf('GNT_0_315') || {}).prix) > 0]],
          more: `Les montants apparaissent dans les cubatures et dans Σ Métré. Le catalogue est enregistré sur ce poste et dans le gabarit : toute l'équipe chiffre aux mêmes prix.` }),
        PS({ title: 'Valider', why: `On a fait le tour des paramètres ! Maintenant on <b>valide</b> : tout s'applique d'un coup. Les réglages sont gardés sur ce poste, et ils partent aussi dans le fichier .mmc quand tu enregistres ton plan : un collègue qui l'ouvre retrouve ton cartouche et tes formats.`,
          items: [['Clique sur <b>Valider</b>, tout en bas du tiroir.', '#cartouche-modal button[onclick="applyCartouche()"]', 'Valider', () => !G.shown('cartouche-modal') && pgv(() => printSettings.paper) === 'A3']],
          more: `Si tu as cliqué Annuler par erreur, pas de panique : rouvre ⛯ et refais les réglages, je t'attends.` }),
        PS({ title: 'Les calques : le tableau', why: `Deuxième grand chantier : les <b>calques</b>. Tu les connais déjà, mais chaque calque a des réglages fins qui font qu'un plan imprimé se lit tout seul, même en noir et blanc.`,
          items: [['Clique sur le bouton <b>Gérer les calques</b>, en haut à gauche.', 'button[onclick="openLayerModal()"]', 'Gérer les calques', () => G.shown('layer-modal')]],
          more: `Une ligne par calque. De gauche à droite : l'<b>œil</b> (afficher / masquer), le <b>nom</b> (clic = calque actif, double-clic = renommer), la <b>couleur</b>, le <b>trait</b>, le <b>libellé</b>, l'<b>épaisseur</b>, la taille des <b>textes</b>, la <b>hachure</b> et son <b>échelle</b>, et le style des <b>points topo</b>. On va tous les utiliser.` }),
        PS({ title: 'Un calque pour les eaux usées', why: `On va créer un vrai calque de réseau, comme sur un plan d'exécution : les <b>eaux usées</b>, en PVC Ø160. Un réseau par calque, c'est la règle : on peut le masquer, l'imprimer à part, et le métré te donne sa longueur.`,
          tick: () => { const l = layEU(); if (l && P.euCol0 === undefined) P.euCol0 = l.color; },
          init: () => { P.euCol0 = undefined; },
          items: [['En bas du tiroir, clique dans la case <b>Nouveau calque…</b> et tape <b>EU</b>.', '#layer-modal #new-layer-name', 'Nouveau calque : tape EU', () => !!layEU() || /^eu$/i.test(pv('new-layer-name').trim())],
                  ['Clique sur <b>Ajouter</b> (ou ' + K('Entrée') + ') : le calque EU apparaît dans la liste, et il devient le calque actif.', '#layer-modal button[onclick="addLayer()"]', 'Ajouter', () => !!layEU()],
                  ['Clique sur le petit carré de <b>couleur</b> de la ligne EU et choisis un <b>rouge</b> ou un <b>marron</b> : la couleur habituelle des eaux usées.', euRow('input.lay-color'), 'Couleur du calque EU', () => !!layEU() && P.euCol0 !== undefined && layEU().color !== P.euCol0]],
          more: `Les couleurs les plus courantes : eaux usées en rouge ou marron, eaux pluviales en vert, eau potable en bleu, électricité en rouge vif, télécom en vert ou violet… Garde toujours les mêmes : l'œil s'habitue vite.` }),
        PS({ title: 'Le trait qui porte son nom', why: `Tu as déjà vu ces réseaux où le trait dit ce qu'il est : ---EU Ø160---EU Ø160---. C'est le type de ligne <b>-T-</b> : le texte est répété tout le long du trait, dans la couleur du calque. Imprimé en noir et blanc ou photocopié dix fois, ça reste lisible. Et l'<b>épaisseur</b> fait la hiérarchie : les réseaux à créer bien marqués, l'existant en trait fin.`,
          items: [['Sur la ligne <b>EU</b>, colonne <b>Trait</b> : choisis <b>-T-</b>.', euRow('select[title="Type de ligne"]'), 'Trait : -T-', () => (layEU() || {}).dash === 'text'],
                  ['La case <b>Libellé</b> juste à droite s\'allume : tape <b>EU Ø160</b>, puis ' + K('Entrée') + '.', euRow('input[title^="Texte répété"]'), 'Libellé : EU Ø160', () => /160/.test((layEU() || {}).ltText || '')],
                  ['Colonne <b>Ép.</b> : mets <b>2</b>, pour que le réseau ressorte bien.', euRow('input[title="Épaisseur"]'), 'Épaisseur : 2', () => Math.abs(((layEU() || {}).width || 1) - 2) < 1e-6]] }),
        PS({ title: 'Textes et hachures du calque', why: `Deux réglages encore, qu'on oublie souvent :<ul style="margin:6px 0 0 16px;list-style:disc"><li><b>Texte mm</b> : vide (« auto »), les textes du calque gardent la même taille à l'écran quel que soit le zoom, comme les cotes. Avec une valeur, ils ont une hauteur fixe <b>en mm sur le papier</b> : pratique pour des étiquettes qui doivent toutes faire 2,5 mm à l'impression.</li><li><b>Hachure</b> et <b>Éch.</b> : le motif utilisé quand tu hachures sur ce calque, et l'écartement de ses traits (1 = 3 mm, 2 = 6 mm). Fini les hachures toutes noires à l'impression !</li></ul>`,
          items: [['Sur la ligne <b>EU</b>, colonne <b>Hachure</b> : choisis <b>XX Croisé</b>.', euRow('select[title="Hachure"]'), 'Hachure : XX Croisé', () => (layEU() || {}).hatch === 'cross'],
                  ['Colonne <b>Éch.</b>, juste à droite : tape <b>2</b>, puis ' + K('Entrée') + ' : des carreaux deux fois plus grands.', euRow('input[title^="Échelle de hachure"]'), 'Échelle : 2', () => +pgv(() => layerHatchScaleOf(layEU())) === 2]] }),
        PS({ title: 'Le style des points topo', why: `Le dernier bouton de la ligne, c'est le <b>style des points topo</b> du calque : le symbole (croix, rond, triangle…), sa taille, et les étiquettes : le <b>matricule</b> du point, son <b>altitude</b>, son <b>code</b>. Un levé de géomètre de 500 points devient lisible en deux clics… ou illisible si tout est allumé !`,
          init: () => { P.sym0 = pgv(() => ptStyleOf(layEU().id).sym); },
          items: [['Sur la ligne <b>EU</b>, clique sur le bouton <b>Points</b>, tout à droite.', euRow('button[title^="Apparence des points topo"]'), 'Points topo du calque', () => G.shown('pt-style-pop')],
                  ['Change le <b>symbole</b> en cliquant un autre carré, et regarde l\'aperçu au-dessus.', '#pt-style-pop', 'Choisis un symbole', () => { const s = pgv(() => ptStyleOf(layEU().id).sym); return s !== undefined && s !== P.sym0; }],
                  ['Referme la petite fenêtre (sa croix, ou le bouton bleu).', '#pt-style-pop button[onclick="closePtStyle()"]', 'Fermer', () => !G.shown('pt-style-pop')]] }),
        PS({ title: 'Le gabarit d\'entreprise', why: `Et maintenant, le plus malin de tout : ce que tu viens de régler, tu le ranges dans un <b>gabarit</b> (un fichier .gbt). Dedans : les calques et leurs styles, les paramètres, le cartouche et le logo, les accroches, tes blocs et le catalogue de prix. Tu le poses sur le serveur, chaque collègue le charge… et toute l'équipe sort les mêmes plans, aux mêmes prix.`,
          init: () => { P.gbt = false; },
          items: [['Referme le gestionnaire de calques (sa croix, ou ' + K('Échap') + ').', '#layer-modal button[onclick="closeLayerModal()"]', 'Fermer les calques', () => !G.shown('layer-modal')],
                  ['Clique sur le bouton du <b>menu fichier</b> (la disquette, en haut).', 'btn-dxf-menu', 'Menu fichier', () => G.shown('menu-dxf') || P.gbt],
                  ['Clique sur <b>Enregistrer le gabarit (.gbt)…</b> et range le fichier là où l\'équipe le trouvera.', '#menu-dxf button[onclick*="saveGabarit"]', 'Enregistrer le gabarit', () => P.gbt]],
          more: `Tes collègues font <b>Charger un gabarit</b>, dans le même menu. Le dernier gabarit chargé revient <b>tout seul</b> à chaque démarrage : on le charge une fois, et c'est réglé.` }),
        { title: 'Bravo, tu es expert !', why: `Ton MomoCAD est réglé « maison » ! Et surtout, tu sais maintenant à quoi sert chaque réglage : la précision et la grille, la feuille, le cartouche et ses indices, le fond de plan, les planches, mes droits, les prix, les calques et le gabarit.`,
          more: `Prochain tuto : <b>Les cubatures</b> (niveau Maître). Et tes prix de déblai et de GNT vont servir !`, last: true },
    ];

    // ---------- outils de contrôle des exercices 3D ----------
    const solidPoly = (pts, kind) => { const Q = pts.map(p => W(...p)); return G.shapes().find(s => s.type === 'poly' && s.solid && s.solid.kind === kind && sameSet(s.points, Q)); };
    const solidCirc = (kind, c, r) => { const C = W(...c); return G.shapes().find(s => s.type === 'circle' && s.solid && s.solid.kind === kind && near(s, C) && (r === undefined || Math.abs(s.r - mw(r)) <= TOL())); };
    const zOf = (s) => !s ? NaN : s.type === 'circle' ? +s.z : +(s.points[0] || {}).z;
    const mmNear = (a, b, t) => isFinite(a) && Math.abs(a - b) <= (t || 20);
    const RECT = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const gpt = (c, o) => gc(c, 0.3, o);   // un point à viser (petit rond, centre accrochable)

    // ===================================================================== 4. MAÎTRE : le terrassement du parking
    // modèle (m) : terrain 0..40 × 0..40 (points tous les 5 m) ; point levé 12,5 / 32,5 à 102,40 ; plateforme 10..30 × 14..26 à 102,00 ; axe du profil y = 20
    const PLAT = RECT(10, 14, 30, 26);
    const terrHere = () => { const a = W(0, 0), b = W(40, 40); return G.shapes().some(s => s.type === 'point' && near(s, a)) && G.shapes().some(s => s.type === 'point' && near(s, b)); };
    const platHere = () => { const r = polyOf(PLAT, true); return r && (() => { try { return isPlateforme(r); } catch (e) { return false; } })() ? r : null; };
    function demoTerrain() {   // terrain d'exercice : 81 points cotés sur 40 × 40 m, une pente et une bosse, posé sous le modèle
        try {
            if (terrHere()) { updateCommandMessageText('Le terrain d\'exercice est déjà là.'); return; }
            const lay = ensureLayer('Terrain naturel', '#bef264'), added = [];
            for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
                const x = i * 5, y = j * 5, z = 100000 + x * 60 + y * 25 + 1200 * Math.exp(-((x - 26) ** 2 + (y - 14) ** 2) / 120), P = W(x, y);
                const pt = { type: 'point', layerId: lay, x: P.x, y: P.y, z: Math.round(z), zk: 1, mat: 'TN' + (added.length + 1) };
                shapes.push(pt); added.push(pt);
            }
            saveState(); updateLayerUI(); invalidateCache(); draw();
            updateCommandMessageText('TERRAIN D\'EXERCICE : ' + added.length + ' points cotés (100 à 104 m) sur le calque « Terrain naturel ».');
        } catch (e) { alert('Impossible de créer le terrain : ' + e.message); }
    }
    const CUB = [
        { title: 'Le terrassement du parking', why: `Niveau <b>maître</b> : une vraie petite étude de terrassement. On pose le parking de l'Initié sur un terrain en pente, on règle sa plateforme, ses talus et sa structure, puis on sort les <b>cubatures</b>, le <b>profil en long</b> et le <b>métré chiffré</b>.`,
          do: `Il faut d'abord un <b>terrain naturel</b> : en vrai, c'est le levé du géomètre (DXF, CSV…). Ici, je vous en crée un de 40 × 40 m, avec une pente et une petite bosse.`, action: { label: '▸ Créer le terrain d\'exercice', fn: demoTerrain }, wait: terrHere, ghost: () => [gp(RECT(0, 0, 40, 40), true, { label: 'terrain 40 × 40 m', lp: W(0, 40.5), snap: [] })],
          more: `Le modèle en pointillés reste le même principe : jaune = maintenant, vert = fait.` },
        { title: 'Compléter le levé : un point topo', target: 'btn-topo', tip: 'Point topo<br><small>ou PT + Espace</small>', ghost: () => [gpt([12.5, 32.5], { label: 'Z 102,40', lp: W(12.8, 33) })],
          why: `Un point coté porte une altitude Z. Le géomètre en oublie parfois un, ou on relève un regard sur place : on l'ajoute à la main et le terrain se recalcule avec lui.`,
          do: () => ol('Outil <b>Point topo</b>, cliquez le centre du rond jaune.', `Tapez l'altitude ${K('102,4')} puis ${SP}.`), more: `Le Z s'affiche en bas à droite quand on survole un point coté.`,
          wait: () => G.shapes().some(s => s.type === 'point' && near(s, W(12.5, 32.5)) && mmNear(+s.z, 102400)) },
        { title: 'Lire le terrain en 3D', target: () => G.is3D() ? '#v3-rose .rose-eye' : '#rose-svg .rose-eye', tip: () => G.is3D() ? 'Refermer la vue 3D<br><small>œil ou Échap</small>' : 'Vue 3D<br><small>ou VU + Espace</small>', in3D: true, why: `Avant de concevoir, on comprend le terrain : où sont les bosses, dans quel sens il penche, où il faudra creuser.`,
          do: `Cliquez la bulle <b>œil 3D</b> près de la rosace. Glisser = tourner, molette = zoom ; <b>Aberration ×</b> exagère le relief. Repérez la bosse.<br>Puis <b>refermez la vue 3D</b> (bulle œil ou ${K('Échap')}) : la suite se fait sur le plan.`, tick: (c) => { if (G.is3D()) c.seen = true; }, wait: (c) => c.seen && !G.is3D() },
        { title: 'Les courbes de niveau', target: 'btn-contours', tip: 'Courbes de niveau<br><small>ou CN + Espace</small>', why: `Les courbes lisent le relief sur un plan à plat, comme sur une carte IGN : serrées = ça monte fort, espacées = c'est plat.`,
          do: `Revenez au plan, puis <b>Courbes de niveau</b> : équidistance ${K('0,5')}, générez.`, wait: (c) => G.shapes().filter(x => x.gen === 'contour').length > c.n, init: (c) => { c.n = G.shapes().filter(x => x.gen === 'contour').length; } },
        { title: 'L\'emprise du parking', target: 'btn-rect', tip: 'Rectangle', ghost: () => [gp(PLAT, true, { label: () => U(20) + ' × ' + U(12), lp: W(30, 26), snap: [W(10, 14)] })],
          why: `La <b>plateforme</b> est la forme du projet posée à une altitude : un parking, une dalle de bâtiment, une voirie. On commence par son contour.`,
          do: () => ol('Outil <b>Rectangle</b>, cliquez le coin jaune.', `Souris en haut à droite, tapez ${K(U(20))} ${SP} puis ${K(U(12))} ${SP}.`), wait: () => !!polyOf(PLAT, true) },
        { title: 'Le niveau du parking', ghost: () => [gp(PLAT, true, { label: 'Z 102,00', lp: W(20, 20), snap: [] })],
          why: `C'est l'altitude du projet fini. Dès qu'elle est donnée, MomoCAD dessine les <b>talus</b> jusqu'au terrain : <span style="color:#fca5a5">rouges en déblai</span> (on creuse), <span style="color:#93c5fd">bleus en remblai</span> (on apporte).`,
          do: ol('Sélectionnez le rectangle, tapez ' + K('Y') + '.', `Onglet <b>Plateforme</b> (icône ▭) : nom <b>Parking</b>, Z de tous les sommets ${K('102')}.`, '<b>Appliquer</b>.'),
          wait: () => { const r = platHere(); return !!r && r.points.every(p => mmNear(+p.z, 102000)); } },
        { title: 'Adoucir le remblai', why: `La pente des talus dépend du sol : 3/2 en remblai courant, 1/1 en déblai tenu. Un talus plus doux prend plus de place mais tient mieux… et change les volumes.`,
          do: ol(`Rouvrez ${K('Y')} sur la plateforme, onglet <b>Talus</b> (icône ◢).`, 'Schéma : clique <b>Remblai</b>, puis tape <b>H = 1</b> et <b>L = 2</b> (2 m à plat pour 1 m de haut).', '<b>Appliquer</b> : les talus bleus s\'élargissent.'),
          more: `Une plateforme <b>inclinée</b> (rampe) se règle au même endroit : un Z par sommet.`,
          wait: () => { const r = platHere(); try { return !!r && Math.abs(talusK(platTalus(r).kR) - 2) < 1e-6; } catch (e) { return false; } } },
        { title: 'La structure de chaussée', why: `Sous l'enrobé il y a des couches : GNT, géotextile… MomoCAD les quantifie (volume, tonnage, prix) et terrasse au <b>fond de forme</b>, sous la dernière couche.`,
          do: ol(`${K('Y')} sur la plateforme, onglet <b>▤ Structure</b>.`, 'Ajoutez <b>GNT 0/31,5</b> sur 20 cm et <b>GNT 0/80</b> sur 30 cm.', '<b>Appliquer</b>.'),
          wait: () => { const r = platHere(); return !!r && !!r.struct && (r.struct.layers || []).length >= 2; } },
        { title: 'Lancer les cubatures', target: 'btn-cubature', tip: 'Cubatures<br><small>ou CU + Espace</small>', why: `Le calcul des volumes de déblai et de remblai, plateforme par plateforme, talus et structure compris.`,
          do: `Bouton <b>Cubatures</b> : cochez <b>Parking</b>, puis <b>2. Résultats</b>.`, wait: (c) => window.__cubPdf && window.__cubPdf !== c.r, init: (c) => { c.r = window.__cubPdf; } },
        { title: 'Lire les résultats', why: `Le parking est à cheval sur la bosse : il y a du déblai d'un côté, du remblai de l'autre. On lit le <b>déblai</b> et le <b>remblai</b>, plateforme par plateforme, talus compris.`,
          do: `<ul><li><b>PDF</b> : le rapport avec vue en plan cotée et vues 3D ;</li><li><b>Copier (tableur)</b> pour le devis ;</li><li><b>Tracer sur le plan</b> : la limite déblai / remblai.</li></ul>` },
        { title: 'Le profil en long', target: 'btn-profile', tip: 'Profil en long<br><small>ou PR + Espace</small>', ghost: () => [gl([5, 20], [35, 20], { label: 'axe du profil', lp: W(35, 20) })],
          why: `La coupe du terrain et du projet le long d'un axe, avec son tableau de cotes : on voit d'un coup d'œil où l'on creuse et où l'on remblaie.`,
          do: () => ol('Outil <b>Profil en long</b>.', 'Cliquez les 2 points jaunes de l\'axe, puis ' + SP + '.'), wait: () => G.modalHas('Profil') },
        PS({ title: 'Une tranchée d\'eaux pluviales', ghost: () => [gl([38, 6], [4, 6], { label: 'EP Ø315 : amont → aval', lp: W(30, 6.6), snap: [W(38, 6), W(4, 6)] })],
          why: `Le parking aura ses réseaux : on pose une <b>tranchée</b> d'eaux pluviales au pied du terrain. L'outil Tranchée dessine la <b>coupe type à l'échelle</b> (largeur, hauteur, couches de remblai, tubes du catalogue), puis la tranchée se cale toute seule <b>sous le sol fini</b> et calcule ses volumes couche par couche.`,
          items: [['Clique sur l\'outil <b>Tranchée</b>, dans la palette Topo : regarde la coupe dans le tiroir.', 'btn-trench', 'Tranchée<br><small>ou TRA + Espace</small>', () => G.modalHas('Tranchée') || G.mode() === 'pline'],
                  ['Dans <b>Historique</b>, choisis <b>Eaux pluviales Ø315 sous chaussée</b> : la coupe se redessine. Puis <b>Tracer</b>.', null, '', () => G.mode() === 'pline' && /pluviales/i.test((gv(() => trenchDraw) || {}).name || '')],
                  [`Clique le point jaune de <b>droite</b> (l'amont, en haut de la pente), puis celui de <b>gauche</b> (l'aval), et ${K('Entrée')}.`, null, '', () => G.shapes().some(t => t.trench && t.points.length >= 2 && near(t.points[0], W(38, 6)) && near(t.points[t.points.length - 1], W(4, 6)))]],
          more: `À chaque sommet, l'étiquette donne le <b>FE</b> (fil d'eau) ; le <b>T</b> (tampon) s'ajoute quand tu mets un <b>regard</b> sur le sommet (clic dessus) ; entre deux sommets, <b>&gt;&gt; x % &gt;&gt;</b> est la pente, flèche vers le bas : verte dans le sens de l'écoulement, rouge à contre-pente. Un clic sur un sommet (ou son étiquette) ouvre son menu : FE, T, et un <b>regard</b> avec son diamètre. Et en vue 3D, la tranchée est modélisée : couches, tubes et regards.` }),
        { title: 'Le métré chiffré', target: 'btn-metre', tip: 'Métré', why: `La synthèse pour le devis : déblai, remblai, chaque produit de la structure, avec vos prix et le <b>total HT</b>.`,
          do: `Fermez le profil, puis <b>Σ Métré</b> : tableau « Terrassement et matériaux », tranchée comprise (déblai, couches, tubes en ml).`, wait: () => G.modalHas('Terrassement') },
        { title: 'Maître du terrassement !', why: `Levé complété, relief lu, plateforme calée à 102,00, talus réglés, structure, cubatures, profil, tranchée et métré chiffré : le circuit complet d'une étude de terrassement.`, more: `Prochain tuto : <b>Le bâtiment — une cabane</b> (niveau Seigneur).`, last: true },
    ];

    // ===================================================================== 5. SEIGNEUR : une cabane
    // modèle (m) : cabane 7..12 × 0..4, murs 0 → 2,50, fenêtre sud depuis 8,5 (1,20), porte est depuis y = 1 (0,90), panne y = 2 à 4,70, toit 6,7..12,3 × -0,3..4,3
    const CAB = [[7, 0], [12, 0], [12, 4], [7, 4]], TOIT = RECT(6.7, -0.3, 12.3, 4.3);
    const wallGroup = () => {   // la chaîne de murs refermée qui passe par les 4 coins de la cabane
        const H = G.shapes().filter(x => x.type === 'hatch' && x.wallMat && x.groupId && x.loops), byG = {};
        H.forEach(h => { (byG[h.groupId] = byG[h.groupId] || []).push(h); });
        const lim = mw(0.4);
        return Object.values(byG).find(L => L.length >= 4 && CAB.every(c => { const P = W(...c); return L.some(h => h.loops[0].some(q => Math.hypot(q.x - P.x, q.y - P.y) <= lim)); })) || null;
    };
    const openings = () => [].concat(...G.shapes().map(x => x.openings || []));
    const openNear = (kind, a, b, wd) => { const M = W((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); return openings().some(o => (kind === 'porte' ? o.kind === 'porte' : o.kind !== 'porte') && o.a && o.b && Math.hypot((o.a.x + o.b.x) / 2 - M.x, (o.a.y + o.b.y) / 2 - M.y) <= mw(0.4) && Math.abs(Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) - mw(wd)) <= mw(0.03)); };
    const roofPans = () => {
        const R = G.shapes().filter(x => x.type === 'poly' && x.solid && x.solid.kind === 'roof' && x.groupId), byG = {};
        R.forEach(r => { (byG[r.groupId] = byG[r.groupId] || []).push(r); });
        const T = TOIT.map(p => W(...p));
        return Object.values(byG).find(L => { const P = [].concat(...L.map(r => r.points)); return L.length >= 2 && T.every(t => P.some(q => near(q, t))); }) || null;
    };
    const roofOk = () => {
        const L = roofPans(); if (!L) return false;
        const d = L[0].roofDef && L[0].roofDef.o; if (d) return Math.abs(d.he - 2.5) < 0.02 && Math.abs(d.hf - 5) < 0.02 && Math.abs((d.db || 0) - 0.3) < 0.02 && d.pans === 2;
        return L.every(r => { if (!r.points.every(q => mmNear(+q.z, 2500, 30))) return false;
            const P = r.points, eg = r.solid.eg || 0, a = P[eg], b = P[(eg + 1) % P.length], l = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / l, ny = (b.x - a.x) / l;
            const depth = Math.max(...P.map(q => Math.abs((q.x - a.x) * nx + (q.y - a.y) * ny))), rise = (+r.solid.p || 0) / 100 * (depth / mw(1)) * 1000;
            return Math.abs(rise - 2500) <= 60; });
    };
    const topOf = (s) => zOf(s) + ((s && s.solid && +s.solid.H) || 0);
    const MODEL = [
        { title: 'Le bâtiment : une cabane', why: `Niveau <b>seigneur</b> ! On passe au bâtiment avec une vraie petite construction : <b>une cabane</b> de 5 × 4 m. Sa dalle, ses murs, une fenêtre, une porte, la panne faîtière, un toit deux pans et ses tuiles. À la fin, on fait le tour en 3D.`,
          do: `Le modèle est en pointillés, vu de dessus. Je coche chaque étape quand c'est juste. Déplie la palette <b>Bâtiment</b> si elle est repliée : clique son titre, à gauche.` },
        PS({ title: 'La dalle', ghost: () => [gp(CAB, true, { label: () => U(5) + ' × ' + U(4) + ', ép. 0,20', lp: W(12, 4), snap: [W(7, 0)] })],
          why: `On commence par le sol : la <b>dalle</b>. C'est un pavé de 20 cm d'épaisseur, posé sur le contour du bâtiment. Note bien : si tu as déjà un contour fermé dessiné, tu le sélectionnes avant de cliquer l'outil, et il devient la dalle.`,
          items: [['Clique sur l\'outil <b>Dalle</b>, dans la palette Bâtiment.', 'btn-dalle', 'Dalle<br><small>ou DA + Espace</small>', () => G.mode() === 'rect' && !!gv(() => solidDalle)],
                  ['Clique sur le coin jaune, en bas à gauche.', null, '', () => J.start([7, 0], 'rect')() || !!solidPoly(CAB, 'box')],
                  [`Amène la souris en haut à droite, tape ${K('5')} puis ${SP}, puis ${K('4')} puis ${SP}.`, null, '', () => { const d = solidPoly(CAB, 'box'); return !!d && mmNear(+d.solid.H, 200); }]],
          more: `L'épaisseur, l'altitude et le contour se règlent après coup avec ${K('Y')}.` }),
        { title: 'La cabane : les murs', target: 'btn-paroi', tip: 'Paroi', ghost: () => [gp(CAB, true, { label: () => U(5) + ' × ' + U(4), lp: W(12, 4) })],
          why: `Le mur porte son matériau (parpaing, brique, béton…) : il se hachure en plan et deviendra un volume percé en 3D. En chaîne, les angles se raccordent tout seuls.`,
          do: ol('Bouton <b>Paroi</b> (palette Bâtiment), choisissez un mur.', 'Cliquez les 4 coins jaunes dans l\'ordre…', '…puis à nouveau le premier : le contour se referme.', `${K('Échap')}.`),
          wait: () => !!wallGroup() },
        { title: 'La hauteur des murs', ghost: () => [gp(CAB, true, { label: 'bas 0 · haut 2,50', lp: W(9.5, 2), snap: [] })],
          why: `En plan, un mur n'a pas de hauteur. On lui donne un <b>niveau bas</b> et un <b>niveau haut</b> pour qu'il existe en 3D et que les ouvertures le percent.`,
          do: ol(`Cliquez un mur (toute la chaîne se sélectionne), ${K('Y')}.`, 'Niveau bas <b>0</b>, niveau haut <b>2,50</b>, <b>Appliquer</b>.'),
          wait: () => { const L = wallGroup(); return !!L && L.every(h => h.wz && mmNear(h.wz.b, 0) && mmNear(h.wz.t, 2500)); } },
        { title: 'La fenêtre', target: 'btn-opening', tip: 'Ouverture<br><small>ou OU + Espace</small>', ghost: () => [gl([8.5, 0], [9.7, 0], { label: () => U(1.2) + ' ' + UN(), lp: W(9.7, -0.3), snap: [W(8.5, 0)] })],
          why: `Percer le mur proprement, au bon endroit et à la bonne largeur : on accroche le début, on tape la largeur.`,
          do: () => ol('Outil <b>Ouverture</b>, cliquez le point jaune sur le mur.', `Souris vers la droite, tapez ${K(U(1.2))} ${SP}.`, 'Choisissez <b>Fenêtre</b> (allège 1,00, hauteur 1,25), <b>Valider</b>.'),
          wait: () => openNear('fen', [8.5, 0], [9.7, 0], 1.2) },
        { title: 'La porte', target: 'btn-opening', tip: 'Ouverture', ghost: () => [gl([12, 1], [12, 1.9], { label: () => U(0.9) + ' ' + UN(), lp: W(12.3, 1.9), snap: [W(12, 1)] })],
          why: `La porte se dessine avec son battant : on choisit le côté de la charnière et le côté où elle s'ouvre, pour vérifier qu'elle ne tape dans rien.`,
          do: () => ol('Outil <b>Ouverture</b>, cliquez le point jaune.', `Souris vers le haut, tapez ${K(U(0.9))} ${SP}.`, 'Choisissez <b>Porte</b>, puis la charnière et le sens d\'ouverture (vers l\'intérieur), <b>Valider</b>.'),
          more: `Double-clic sur une ouverture pour la modifier.`, wait: () => openNear('porte', [12, 1], [12, 1.9], 0.9) },
        { title: 'La panne faîtière', target: 'btn-solid-beam', tip: 'Poutre<br><small>ou PO + Espace</small>', ghost: () => [gl([7, 2], [12, 2], { label: 'Z 4,70', lp: W(12, 2.3) })],
          why: `La <b>poutre</b> porte le toit. Bois ou acier, droite ou en pente : sa section reste perpendiculaire, comme un vrai chevron.`,
          do: ol('Outil <b>Poutre</b>, cliquez les 2 points jaunes.', 'Dans la fenêtre, gardez le bois 63×175.', 'Onglet <b>Altitudes de l\'axe</b> (icône ↕ du bandeau à gauche) : Z départ et Z arrivée <b>4,70</b>, <b>Appliquer</b>.'),
          wait: () => G.shapes().some(s => s.type === 'line' && s.sweep && s.sweep.perp && ((near({ x: s.x1, y: s.y1 }, W(7, 2)) && near({ x: s.x2, y: s.y2 }, W(12, 2))) || (near({ x: s.x1, y: s.y1 }, W(12, 2)) && near({ x: s.x2, y: s.y2 }, W(7, 2)))) && mmNear(+s.z1, 4700, 30) && mmNear(+s.z2, 4700, 30)) },
        { title: 'Le toit deux pans', target: 'btn-solid-roof', tip: 'Toiture<br><small>ou TOI + Espace</small>', ghost: () => [gp(CAB, true, { label: () => U(5) + ' × ' + U(4) + ' (contour des murs)', lp: W(12, 4.3), snap: [W(7, 0)] }), gp(TOIT, true, { label: 'débord 0,30', lp: W(12.3, -0.6), snap: [] }), gl([6.7, 2], [12.3, 2], { label: 'faîtage', lp: W(6.7, 2.3), snap: [] })],
          why: `Couvrir la cabane en une fois : deux pans à la bonne hauteur, avec leur <b>débord</b> tout autour et les <b>pignons</b> fermés sous le toit, alignés sur les murs.`,
          do: () => ol('Outil <b>Toiture</b>, cliquez le coin jaune (le coin des murs).', `Tapez ${K(U(5))} ${SP} puis ${K(U(4))} ${SP}.`, '<b>2 pans</b>, faîtage parallèle <b>au grand côté</b>, égout <b>2,50</b>, faîtage <b>5,00</b>, débord <b>0,30</b>.', 'Cochez <b>Combler les pignons</b>, <b>Créer le toit</b>.'),
          wait: roofOk },
        { title: 'Les tuiles', in3D: true, target: 'btn-paint', tip: 'Peindre', ghost: () => [gp(TOIT, true, { label: 'Tuiles', lp: W(9.5, 3.5), snap: [] })],
          why: `La touche finale : une couverture en tuiles, à l'échelle.`,
          do: ol('Outil <b>Peindre</b>, choisissez <b>Tuiles</b>.', 'Cliquez les deux pans du toit.'), wait: () => { const L = roofPans(); return !!L && L.every(r => r.tex === 'tuile'); } },
        { title: 'Admirez', target: () => G.is3D() ? '#v3-rose .rose-eye' : '#rose-svg .rose-eye', tip: () => G.is3D() ? 'Refermer la vue 3D<br><small>œil ou Échap</small>' : 'Vue 3D<br><small>ou VU + Espace</small>', in3D: true, why: `Le moment de vérité : murs percés, porte, fenêtre, panne, toit et pignons… et l'équerre à côté.`, do: `Ouvrez la <b>vue 3D</b> et faites le tour de la cabane, puis <b>refermez-la</b> (bulle œil ou ${K('Échap')}) pour revenir au plan.`, tick: (c) => { if (G.is3D()) c.seen = true; }, wait: (c) => c.seen && !G.is3D() },
        { title: 'Seigneur du bâtiment !', why: `Bravo, tu es seigneur du bâtiment ! Une cabane complète : dalle, murs avec leur matériau, fenêtre, porte, panne faîtière, toit deux pans avec ses pignons, et ses tuiles.`, more: `Dernier tuto : <b>Construire juste — une pergola</b> (niveau Dieu) : traits de construction, coupe, mesures et collisions.`, last: true },
    ];

    // ===================================================================== 6. DIEU : une pergola
    // modèle (m) : dalle 0..4 × 0..3 ; traits de construction à 0,20 des bords ; poteaux aux croisements ; poutres y = 0,20 et 2,80 ; coupe x = 2
    const PERG = RECT(0, 0, 4, 3);
    const clHas = (axis, v) => { try { return D3C.lines.some(L => { const x = mmToWorld(L.p.x * 1000), y = -mmToWorld(L.p.y * 1000), dx = L.d.x, dy = -L.d.y, P = W(axis === 'h' ? 0 : v, axis === 'h' ? v : 0), tol = mw(0.01);
        return axis === 'h' ? Math.abs(dy) < 1e-6 && Math.abs(y - P.y) <= tol : Math.abs(dx) < 1e-6 && Math.abs(x - P.x) <= tol; }); } catch (e) { return false; } };
    const potCount = () => [[0.2, 0.2], [3.8, 0.2], [3.8, 2.8], [0.2, 2.8]].filter(c => G.shapes().some(s => s.name === 'Poteau' && s.points && near(polyCentroid(s.points), W(...c)))).length;
    const beamList = () => G.shapes().filter(s => s.type === 'line' && s.sweep && s.sweep.perp);
    const beamCount = () => beamList().length;
    const beamOn = (y) => beamList().some(s => { const a = W(0.2, y), b = W(3.8, y); return (near({ x: s.x1, y: s.y1 }, a) && near({ x: s.x2, y: s.y2 }, b)) || (near({ x: s.x1, y: s.y1 }, b) && near({ x: s.x2, y: s.y2 }, a)); });
    const cutDone = () => G.shapes().some(s => s.cutName);

    const BUILD = [
        { title: 'Construire juste : une pergola', why: `Niveau <b>dieu</b>, le dernier ! On construit une pergola de 4 × 3 m : une dalle, quatre poteaux placés au centimètre grâce aux <b>traits de construction</b>, deux poutres. Puis on la contrôle comme un pro : une <b>coupe</b>, des <b>mesures en 3D</b> et le <b>contrôle des collisions</b>.`,
          do: `Comme d'habitude : le modèle en pointillés, et je coche chaque ligne quand c'est juste. Déplie la palette <b>Bâtiment</b> si besoin.` },
        PS({ title: 'La dalle de la pergola', ghost: () => [gp(PERG, true, { label: () => U(4) + ' × ' + U(3), lp: W(4, 3), snap: [W(0, 0)] })],
          why: `D'abord le sol : une dalle de 4 × 3 m. Tu connais le geste depuis la cabane.`,
          items: [['Clique sur l\'outil <b>Dalle</b>.', 'btn-dalle', 'Dalle', () => G.mode() === 'rect' && !!gv(() => solidDalle)],
                  ['Clique sur le coin jaune.', null, '', () => J.start([0, 0], 'rect')() || !!solidPoly(PERG, 'box')],
                  [`Souris en haut à droite, tape ${K('4')} ${SP} puis ${K('3')} ${SP}.`, null, '', () => !!solidPoly(PERG, 'box')]] }),
        PS({ title: 'Les repères : traits de construction', ghost: () => [gl([-1, 0.2], [5, 0.2], { snap: [] }), gl([-1, 2.8], [5, 2.8], { snap: [] }), gl([0.2, -1], [0.2, 4], { snap: [] }), gl([3.8, -1], [3.8, 4], { snap: [] })],
          why: `Les poteaux sont en retrait de 20 cm du bord de la dalle. Plutôt que de calculer leurs coordonnées, on pose des <b>traits de construction</b> : des droites infinies, sans calque, qui ne s'impriment pas. Un clic sur une arête pose un trait dans son alignement ; ensuite, l'outil <b>Décaler</b> en fait des parallèles à la bonne distance. Leurs croisements deviennent des points d'accroche.`,
          items: [['Clique sur l\'outil <b>Trait de construction</b> (palette Bâtiment).', 'btn-cline2', 'Trait de construction<br><small>ou TCO + Espace</small>', () => G.mode() === 'cline2' || clHas('h', 0)],
                  ['Clique sur le <b>bord bas</b> de la dalle : un trait se pose dans son alignement.', null, '', () => clHas('h', 0)],
                  ['Clique sur le <b>bord gauche</b> de la dalle.', null, '', () => clHas('v', 0)],
                  [`Outil <b>Décaler</b> (palette Modif) : tape ${K('0,2')} puis ${SP}.`, 'btn-offset', 'Décaler<br><small>ou DE + Espace</small>', () => G.mode() === 'offset' || clHas('h', 0.2)],
                  ['Clique le trait du bas (hors de la dalle), puis clique <b>dans</b> la dalle : la parallèle se pose à 0,20.', null, '', () => clHas('h', 0.2)],
                  ['Pareil avec le trait de gauche : clic sur le trait, puis dans la dalle.', null, '', () => clHas('v', 0.2)],
                  [`Tape ${K('2,8')} ${SP}, clique le trait du bas puis dans la dalle ; tape ${K('3,8')} ${SP}, clique le trait de gauche puis dans la dalle.`, null, '', () => clHas('h', 2.8) && clHas('v', 3.8)]],
          more: `Avec ${K('Maj')} enfoncée, le clic pose une <b>perpendiculaire</b> à l'arête, au point cliqué. Un trait se sélectionne et se supprime comme un objet ; ${K('Ctrl')} + clic dans l'outil l'efface, et la pastille « ✕ traits de construction » en haut du plan les efface tous.` }),
        PS({ title: 'Les poteaux', ghost: () => [[0.2, 0.2], [3.8, 0.2], [3.8, 2.8], [0.2, 2.8]].map(c => gc(c, 0.1, { snap: [W(...c)] })),
          why: `Les quatre croisements des traits sont eactement là où vont les poteaux : il suffit de cliquer, l'accroche fait le reste.`,
          items: [['Clique sur l\'outil <b>Poteau</b>.', 'btn-poteau', 'Poteau<br><small>ou POT + Espace</small>', () => G.mode() === 'poteau'],
                  ['Clique sur un croisement de traits (le carré d\'accroche s\'y pose).', null, '', () => potCount() >= 1],
                  ['Clique les trois autres croisements, puis ' + K('Échap') + '.', null, '', () => potCount() >= 4]],
          more: `Chaque poteau fait 20 × 20 cm et 2,50 m : section et hauteur se règlent avec ${K('Y')}.` }),
        PS({ title: 'Les poutres', ghost: () => [gl([0.2, 0.2], [3.8, 0.2], { label: 'Z 2,50' }), gl([0.2, 2.8], [3.8, 2.8], { label: 'Z 2,50' })],
          why: `Deux poutres relient les poteaux deux à deux. Par défaut, une poutre est posée à 2,50 m : la hauteur de nos poteaux.`,
          items: [['Clique sur l\'outil <b>Poutre</b>.', 'btn-solid-beam', 'Poutre<br><small>ou PO + Espace</small>', () => J.solid('beam')() || beamCount() >= 1],
                  ['Clique les deux poteaux du bas (au centre), puis valide la fenêtre (bois 63×175, Appliquer).', null, '', () => beamOn(0.2)],
                  ['Rouvre l\'outil Poutre et fais pareil avec les deux poteaux du haut.', null, '', () => beamOn(2.8)]] }),
        PS({ title: 'La coupe', ghost: () => [gl([2, -1], [2, 4], { label: 'coupe A-A' })],
          why: `Une <b>coupe</b> montre le bâtiment tranché : les épaisseurs, les hauteurs, ce qui porte quoi. MomoCAD la dessine sous le plan, sur le calque « Coupes », avec ses éléments coupés hachurés.`,
          items: [['Clique sur l\'outil <b>Trait de coupe</b>.', 'btn-cut', 'Trait de coupe<br><small>ou CO + Espace</small>', () => G.mode() === 'cut'],
                  ['Clique les deux bouts jaunes de la ligne de coupe.', null, '', () => !!gv(() => CUT.b) || cutDone()],
                  ['Clique à droite de la ligne : c\'est le côté vers lequel on regarde.', null, '', () => cutDone()]],
          more: `Fais défiler vers le bas : la coupe A-A est sous le plan. Elle forme un groupe : elle se déplace d'un bloc et se pose dans une mise en page.` }),
        PS({ title: 'Regarder en 3D', in3D: true,
          why: `La vue 3D est un visualiseur : on y tourne autour du projet, on mesure, on contrôle. Pas de dessin dedans, tout se construit en plan.`,
          items: [['Clique sur la bulle <b>œil 3D</b>, près de la rosace.', () => G.is3D() ? null : '#rose-svg .rose-eye', 'Vue 3D<br><small>ou VU + Espace</small>', () => G.is3D()]],
          more: `Les chevrons « et », de chaque côté de la rosace, font tourner d'un quart de tour autour du projet. Ceux du haut et du bas montent ou descendent ton point de vue : côté, iso, dessus.` }),
        PS({ title: 'Mesurer en 3D', in3D: true,
          why: `Une hauteur sous poutre, ça se vérifie. En 3D, la mesure s'accroche aux sommets (carré jaune), aux milieux d'arêtes (triangle) et aux surfaces (rond bleu).`,
          items: [['Clique sur le bouton <b>Mesurer</b> (la règle), en haut de la vue 3D.', '#v3-mes-btn', 'Mesurer', () => G.mode() === 'measure'],
                  ['Clique sur le dessus de la dalle, puis sous une poutre : lis la distance et le ΔZ en bas.', null, '', () => (window.d3Measured || 0) > P.m0]],
          init: () => { P.m0 = window.d3Measured || 0; } }),
        PS({ title: 'Les collisions', in3D: true,
          why: `Dernier contrôle, le plus précieux avant de commander : les <b>collisions</b>. Nos poteaux partent du sol, donc ils traversent la dalle ; et leur tête rentre dans les poutres. MomoCAD va les trouver.`,
          items: [['Clique sur le bouton <b>Collisions</b> (le point d\'exclamation), en haut de la vue 3D.', '#v3-col-btn', 'Collisions', () => (gv(() => d3Col.length) || 0) > 0],
                  ['Regarde les volumes rouges, et clique une ligne du tiroir : les deux objets se sélectionnent.', '#t2-panel', '', () => G.sel().length >= 2]],
          more: `Pour corriger, on poserait les poteaux sur la dalle (${K('Y')} : altitude 0,20) et on les arrêterait sous les poutres, puis <b>Recontrôler</b>.` }),
        { title: 'Dieu de MomoCAD !', why: `Bravo, tu es le dieu de MomoCAD ! Une pergola placée au centimètre avec les traits de construction, coupée, mesurée et contrôlée : tu sais construire juste, du terrain au bâtiment.`, more: `Il n'y a pas de niveau au-dessus… pour l'instant !`, last: true },
    ];

    // ---------- la voix de Momo : ce qu'il dit à chaque étape (prioritaire sur les textes des étapes) ----------
    // why = ce que Momo raconte (pourquoi, à quoi ça sert) · do = « À toi » · more = son aparté
    const HUMAN = {
        base: {
            'Bonjour, je suis Momo !': { why: `Salut ! Bon, alors : aujourd'hui on apprend les outils de base, mais pas avec des exercices tout secs. On va <b>redessiner le logo MOMOCAD</b>, lettre par lettre, et chaque lettre va t'apprendre un outil.`,
                do: `Regarde le plan : le modèle est tracé en <b>pointillés</b>. En <b style="color:#fbbf24">jaune</b>, ce qu'on dessine maintenant ; en <b style="color:#4ade80">vert</b>, ce qui est déjà fait. Les points jaunes <b>attirent ta souris</b> : vise-les.<br>Je coche l'étape ✓ seulement quand ton dessin colle au modèle. Ensuite c'est toi qui avances avec ${K('▶')}, à ton rythme.<br>En haut de ma bulle : la <b>maison</b> revient au choix (tuto ou question), l'<b>épingle</b> fige ma bulle par-dessus tous les menus, le <b>trait</b> la réduit : je me cache derrière la barre de commande, clique sur mon chapeau pour me rouvrir.`,
                more: `Le mieux, c'est de partir d'un plan vierge. Et ici, tout se mesure en mètres : je règle l'unité du dessin pour toi.` },
            'Se déplacer dans le plan': { why: `Avant de dessiner, on apprend à regarder. Note bien ces trois gestes, tu vas t'en servir tout le temps.`,
                do: `<ul><li><b>molette</b> : tu zoomes, autour du curseur ;</li><li><b>clic molette maintenu</b> : tu fais glisser le plan ;</li><li><b>double-clic molette</b> : tu vois tout.</li></ul>Essaie un peu, puis reviens : le logo t'attend au milieu de l'écran.` },
            'Le M, première moitié': { why: `On commence par le M. Petite astuce : il est symétrique, alors on n'en dessine que <b>la moitié</b>. Pour ça, on prend la <b>polyligne</b> : plusieurs segments d'un seul tenant, qui forment un seul objet. C'est l'outil des bordures, des réseaux… et des lettres.`,
                do: ol('Clique sur l\'outil <b>Polyligne</b>.', 'Clique sur les 3 points jaunes, dans l\'ordre : en bas à gauche, en haut, puis au milieu.', `Appuie sur ${SP} pour terminer la polyligne.`),
                more: `${SP}, c'est la touche qui valide presque tout dans MomoCAD. Prends le réflexe !` },
            'Le M, l\'autre moitié en miroir': { why: `Super, la moitié est là ! Maintenant on fait apparaître l'autre avec la <b>copie miroir</b> : elle reflète ton dessin de l'autre côté d'un axe. Résultat parfaitement symétrique, sans rien recalculer.`,
                do: ol('Sélectionne la demi-lettre : clique sur son trait, il passe en rose.', 'Clique sur l\'outil <b>Copie miroir</b>.', 'Clique sur les 2 points jaunes de l\'axe vertical.', `Appuie sur ${SP} : le reflet apparaît, l\'original reste en place.`)},
            'Le M, d\'un seul morceau': { why: `Ton M a deux morceaux qui se touchent au milieu. On va les <b>joindre</b> en une seule polyligne. Note bien pourquoi c'est important : un seul objet, c'est un seul clic pour le sélectionner, et une seule longueur au métré.`,
                do: ol(`Sélectionne les deux moitiés : clique sur l'une, puis sur l'autre : chaque clic ajoute à la sélection.`, 'Clique sur le bouton <b>Joindre</b> (palette Modifier).')},
            'Le O': { why: `Le M est fini, bravo ! On passe au O : un <b>cercle</b>. Sur un vrai plan, c'est un regard, un arbre, un giratoire…`,
                do: () => ol('Clique sur l\'outil <b>Cercle</b>.', 'Clique sur le <b>centre</b> : le point jaune.', `Tape le rayon ${K(U(2))} au clavier, puis appuie sur ${SP}.`),
                more: `Taper la valeur au clavier, c'est LE réflexe à prendre : ton dessin est juste au millimètre, pas « à peu près ».` },
            'Sélectionner M et O ensemble': { why: `On a « MO ». Et tu sais quoi ? Pour faire « MOMO », pas besoin de redessiner : on va copier. Mais d'abord, il faut <b>sélectionner</b> le M et le O ensemble. Un <b>clic dans le vide, puis un 2<sup>e</sup> clic</b> trace une fenêtre : tout ce qui est entièrement dedans est pris. Petite astuce : tracée vers la gauche, la fenêtre devient verte et prend tout ce qu'elle touche.`,
                do: ol(`Appuie sur ${K('Échap')} : tu reviens à l'outil Sélection.`, 'Clique sur un coin de la fenêtre jaune, relâche, puis clique sur le coin opposé.', 'Le M et le O passent en rose : ils sont sélectionnés.'),
                more: `Il existe deux autres gestes : un clic directement sur un objet, ou bouton maintenu en glissant pour tracer un <b>lasso</b> à main levée.` },
            'MOMO : copier M et O': { why: `Parfait ! Maintenant on <b>copie</b> : le dessin est reproduit ailleurs, et l'original ne bouge pas. Note bien le principe, il revient partout : un <b>point de départ</b>, puis un <b>point d'arrivée</b>.`,
                do: ol('Vérifie que le M et le O sont toujours en rose : ils sont sélectionnés.', 'Clique sur l\'outil <b>Copier</b>.', 'Clique sur le point de départ : le coin en bas à gauche du M.', 'Clique sur l\'arrivée : le point jaune au bout de la flèche.', `Appuie sur ${K('Entrée')} : la copie est faite et tu reviens en sélection.`),
                more: () => `Tu peux aussi taper la distance (${U(8.5)}) au lieu de cliquer l'arrivée.` },
            'Le C': { why: `Et voilà « MOMO » ! On attaque le C avec l'<b>arc</b>. Sur un chantier, c'est une bordure courbe, un rayon de giration… Ici, trois quarts de cercle.`,
                do: ol('Clique sur l\'outil <b>Arc</b>.', 'Clique sur le <b>centre</b> : le point jaune du milieu.', 'Clique sur le <b>départ</b> : le point jaune en bas à droite.', `Tourne la souris autour du centre, <b>par le bas puis vers la gauche</b> : l'arc suit ton geste. Clique sur le point jaune <b>en haut</b> à droite.`),
                more: `Autre façon, au clavier : après le départ, tape l'angle ${K('270')} puis ${SP}.` },
            'Le A': { why: `Joli C ! Pour le A, on reprend la polyligne : ce sont juste ses deux jambes.`,
                do: ol('Clique sur l\'outil <b>Polyligne</b>.', 'Clique sur les 3 points jaunes, de gauche à droite.', `Appuie sur ${SP} pour terminer.`)},
            'La barre du A, trop longue': { why: `Il manque la barre du A. On la trace avec la <b>droite</b>, le trait le plus simple… et on la fait exprès <b>trop longue</b>. Pourquoi ? Tu vas voir : l'outil d'après la recoupe pile au bon endroit.`,
                do: ol('Clique sur l\'outil <b>Droite</b>.', 'Clique sur les 2 points jaunes : la barre dépasse des deux côtés du A, c\'est normal.')},
            'Couper ce qui dépasse': { why: `Voilà la magie : <b>Couper</b>. Tu cliques le morceau en trop, il disparaît jusqu'au trait qui le croise. Note bien l'intérêt : plus besoin de viser les croisements au millimètre, on trace large et on nettoie.`,
                do: ol('Clique sur l\'outil <b>Couper</b>.', 'Clique sur le bout qui dépasse à <b>gauche</b> du A, puis sur celui qui dépasse à <b>droite</b>.')},
            'Le D, d\'abord un rectangle': { why: `Plus que le D ! On part d'un <b>rectangle</b> : bâtiment, place de parking, emprise… Ses dimensions se tapent au clavier, comme le rayon du cercle.`,
                do: () => ol('Clique sur l\'outil <b>Rectangle</b>.', 'Clique sur le point jaune : le coin en bas à gauche.', 'Amène la souris vers le haut à droite : le rectangle se dessine de ce côté.', `Tape la largeur ${K(U(2.5))} au clavier, puis ${SP}.`, `Tape la hauteur ${K(U(4))}, puis ${SP}.`)},
            'Éclater le rectangle': { why: `Un rectangle, c'est un seul objet. Pour arrondir ses angles, il faut d'abord le <b>décomposer</b> en 4 traits indépendants : c'est le rôle d'<b>Éclater</b>.`,
                do: ol('Sélectionne le rectangle : clique sur un de ses côtés, il passe en rose.', 'Clique sur le bouton <b>Éclater</b>, juste à côté du cadenas Grouper.')},
            'Arrondir le haut du D': { why: `On donne maintenant au D sa panse ronde avec <b>Arrondir</b> : il raccorde deux traits par un arc bien tangent. C'est l'outil des angles de bordure et des rayons de giration.`,
                do: () => ol('Clique sur l\'outil <b>Arrondir</b>.', 'Clique sur le côté <b>du haut</b>, puis sur le côté <b>de droite</b>.', `Tape le rayon ${K(U(1.25))} au clavier, puis ${SP} : l'outil reste actif pour la suite.`)},
            'Arrondir le bas du D': { why: `C'est bien ! Même geste pour l'angle du bas.`,
                do: () => ol('L\'outil <b>Arrondir</b> est toujours actif : clique sur le côté <b>du bas</b>, puis sur le côté <b>de droite</b>.', `Appuie sur ${SP} : il reprend le dernier rayon (${U(1.25)}). Puis ${K('Entrée')} pour quitter l'outil.`)},
            'Le soulignement': { why: `Toutes les lettres sont là ! On finit par un double soulignement. D'abord une <b>droite à la cote</b> : tu cliques le départ, tu tapes la longueur, et elle part dans la direction de ta souris.`,
                do: () => ol('Clique sur l\'outil <b>Droite</b>.', 'Clique sur le point jaune de départ.', `Garde ${K('Maj')} enfoncée (trait bien horizontal) et amène la souris vers la droite.`, `Tape la longueur ${K(U(20))} au clavier, puis ${SP}.`)},
            'Le soulignement à la bonne longueur': { why: `Oups, elle est trop courte ! Pas de panique, on ne la redessine pas : <b>Longueur</b> donne une longueur exacte à un trait qui existe déjà.`,
                do: () => ol('Clique sur l\'outil <b>Longueur</b>.', `Tape la longueur totale ${K(U(28.5))} au clavier, puis ${SP}.`, 'Clique près du bout <b>droit</b> du soulignement : il s\'allonge.')},
            'Doubler le soulignement': { why: `Pour doubler le trait, on utilise <b>Décaler</b> : une copie parallèle, à une distance précise. Note bien cet outil, en VRD il sert tout le temps : bordure, trottoir, fil d'eau…`,
                do: () => ol('Clique sur l\'outil <b>Décaler</b>.', `Tape la distance ${K(U(0.5))} au clavier, puis ${SP}.`, 'Clique sur le soulignement.', 'Clique <b>en dessous</b> : la copie parallèle apparaît.')},
            'Remplir les O': { why: `Dernière touche : on remplit les O avec la <b>hachure</b>. Elle remplit une zone fermée et te donne sa surface. Sur un plan : un enrobé, un espace vert, une dalle…`,
                do: ol('Clique sur l\'outil <b>Hachure</b>.', 'Clique <b>à l\'intérieur</b> du premier O, puis à l\'intérieur du second.', 'Regarde en bas de l\'écran : la surface hachurée s\'affiche.')},
            'Votre logo !': { why: `Regarde ce que tu as fait : <b>MOMOCAD</b>, dessiné à la cote ! En chemin, tu as utilisé 15 outils : polyligne, miroir, joindre, cercle, sélection, copier, arc, droite, couper, rectangle, éclater, arrondir, longueur, décaler et hachure. Franchement, bravo.`,
                do: `Double-clic molette pour tout voir. Et retiens ces raccourcis de survie : ${K('Ctrl')}+${K('Z')} annule, ${K('Ctrl')}+${K('Y')} refait, ${K('Suppr')} efface la sélection.`,
                more: `Prochain tuto : <b>Les outils avancés</b> (niveau Initié). On dessinera un petit parking, avec calques, réseau, cotes et blocs.` },
        },
        adv: {
            'Les outils avancés': { why: `Te revoilà ! Cette fois, on passe à un vrai petit projet : <b>un parking</b>. On va le monter comme au bureau : un calque propre, l'emprise, un accès en biais, les places, une haie, les cotes, un regard, les textes… puis on contrôle et on sort le métré.`,
                do: `Même principe que pour le logo : le modèle en pointillés, jaune = maintenant, vert = fait. Je coche quand ton dessin colle.`,
                more: `Si tu n'as pas fait « Les outils de base », commence par lui : ce sera plus confortable.` },
            'Les points d\'accroche': { why: `D'abord, un mot sur les <b>accroches</b>, parce que c'est important. Un trait qui « tombe presque » sur un autre, ça fausse les surfaces, les hachures et les cubatures. Les accroches font sauter ton curseur pile sur le bout d'un trait, son milieu, un centre, un croisement…`,
                do: `Regarde la barre jaune en haut : un bouton par type d'accroche, allumé = actif. Le petit repère n'apparaît que pendant un tracé, pas quand tu sélectionnes.` },
            'Un calque Parking': { why: `Bon, alors on commence par ranger. Les <b>calques</b>, c'est comme des transparents posés les uns sur les autres : chacun sa couleur, son trait… et surtout, note bien : <b>le métré compte par calque</b>. Un dessin bien rangé, c'est un métré juste.`,
                do: ol('Clique sur le bouton <b>Gérer les calques</b>, en haut, à côté de la liste des calques.', `Clique dans la case « Nouveau calque », tape <b>Parking</b>, puis ${K('Entrée')}.`, 'Parking devient le calque actif : ferme le gestionnaire avec la croix ✕.'),
                more: `Ici, c'est ${K('Entrée')} qui valide : la barre d'espace sert à écrire le nom.` },
            'L\'emprise du parking': { why: `Parfait, tout ce qu'on dessine va maintenant sur le calque Parking. On trace le contour : 20 m sur 12.`,
                do: () => ol('Clique sur l\'outil <b>Rectangle</b>.', 'Clique sur le point jaune : le coin en bas à gauche.', `Amène la souris en haut à droite, tape la longueur ${K(U(20))} au clavier, puis ${SP}.`, `Tape la largeur ${K(U(12))}, puis ${SP}.`)},
            'L\'accès en biais (suivi polaire)': { why: `Maintenant l'accès, en biais à 45°. Pas besoin de sortir la calculette : le <b>suivi polaire</b> aimante ton trait sur les angles ronds (15°, 30°, 45°…).`,
                do: () => ol(`Appuie sur ${K('F10')} pour allumer le suivi polaire (l'Ortho, ${K('F8')}, doit être éteint).`, 'Clique sur l\'outil <b>Droite</b>.', 'Clique sur le point jaune, sur le bord droit de l\'emprise.', 'Amène la souris vers 45°, en haut à droite : une ligne pointillée bleue apparaît.', `Tape la longueur ${K(U(4))} au clavier, puis ${SP}.`)},
            'Une place de parking': { why: `On dessine une place de parking, une seule pour l'instant. Une place standard, c'est 2,50 × 5,00 m.`,
                do: () => ol('Clique sur l\'outil <b>Rectangle</b>.', 'Clique sur le point jaune.', `Amène la souris en haut à droite, tape ${K(U(2.5))} au clavier, puis ${SP}.`, `Tape ${K(U(5))}, puis ${SP}.`)},
            'Six places d\'un coup : le réseau': { why: `Une place, c'est bien ; six, c'est mieux ! Plutôt que de copier six fois, on fait un <b>réseau</b> : il répète un objet de façon régulière, d'un coup, avec un aperçu en direct. Places, plots, bornes, candélabres…`,
                do: () => ol('Sélectionne la place : clique sur un de ses côtés, elle passe en rose.', 'Clique sur l\'outil <b>Réseau</b>.', `Dans la fenêtre, onglet <b>Grille</b> : <b>6</b> colonnes, <b>1</b> ligne, écart entre colonnes ${K(U(2.5))}.`, 'Vérifie l\'aperçu, puis clique sur <b>Créer</b>.')},
            'La limite plantée': { why: `C'est bien ! Le long du parking, on va planter une haie d'arbres. On commence par tracer sa ligne.`,
                do: ol('Clique sur l\'outil <b>Droite</b>.', 'Clique sur les 2 points jaunes.')},
            'Planter les arbres : diviser': { why: `Et maintenant on plante, avec <b>Diviser</b> : il jalonne un tracé sans le couper. Sur un chantier, c'est un regard tous les 50 m ou un candélabre tous les 25 m. Ici, un arbre tous les 5 m.`,
                do: ol('Clique sur l\'outil <b>Diviser</b>.', 'Clique sur la ligne plantée.', 'Dans la fenêtre, choisis <b>En parts égales</b> : 4 parts.', 'Que poser : <b>❖ Bloc</b>, puis « Arbre feuillu ».', 'Décoche « aux deux bouts », puis clique sur <b>Poser</b>.')},
            'Coter la largeur': { why: `On passe à la cotation. Une <b>cote</b> affiche une distance sur le plan. Note bien son gros avantage : si tu déplaces ses points, elle se met à jour toute seule.`,
                do: ol('Clique sur l\'outil <b>Cote ortho</b>.', 'Clique sur les deux coins du bas de l\'emprise.', 'Clique sous le parking pour placer la ligne de cote.'),
                more: `Flèches ou traits obliques, pointillés, traits d'accroche, valeur dans une pastille… Tu règles l'allure de toutes tes cotes dans Paramètres, onglet <b>Cotes</b>.` },
            'Le regard': { why: `On ajoute un regard d'eaux pluviales au milieu de l'allée. Un cercle : tu connais, maintenant !`,
                do: () => ol('Clique sur l\'outil <b>Cercle</b>.', 'Clique sur le centre jaune.', `Tape le rayon ${K(U(0.5))} au clavier, puis ${SP}.`)},
            'Coter le regard': { why: `Pour dire sa taille sur le plan, on lui met une <b>cote de diamètre</b> (celle de rayon est juste à côté). Regard, bassin, giration…`,
                do: ol('Clique sur l\'outil <b>Cote de diamètre</b>.', 'Clique sur le regard.', 'Amène le texte à l\'extérieur du cercle et clique pour le poser.')},
            'Le nom du parking': { why: `Un plan doit se lire tout seul, sans toi à côté pour l'expliquer. Alors on nomme l'ouvrage.`,
                do: ol('Clique sur l\'outil <b>Texte</b>.', 'Clique au milieu du parking : une zone de texte s\'ouvre.', `Tape <b>PARKING</b>, puis ${K('Entrée')}.`)},
            'Signaler l\'entrée': { why: `Maintenant, on montre par où on entre. L'<b>infobulle</b> est une étiquette reliée par une flèche à ce qu'elle désigne. On va écrire « Entrée » à côté de l'accès en biais.`,
                do: ol('Clique sur l\'outil <b>Infobulle</b>.', '1<sup>er</sup> clic : la <b>pointe de la flèche</b>, sur le point jaune au milieu de l\'accès.', '2<sup>e</sup> clic : la <b>place de l\'étiquette</b>, sur le second point jaune.', `Une zone de texte s'ouvre : écris le mot <b>Entrée</b>, puis appuie sur la touche ${K('Entrée')} pour valider.`),
                more: `Oui, le mot et la touche ont le même nom, c'est un hasard ! On écrit « Entrée », puis on valide avec la touche ${K('Entrée')}.` },
            'Contrôler : mesurer': { why: `Le dessin est fini. Avant d'envoyer un plan, on vérifie toujours : note bien ce réflexe. <b>Mesurer</b> te donne distances, angle et surface <b>sans rien dessiner</b>.`,
                do: () => ol('Clique sur l\'outil <b>Mesurer</b>.', `Clique sur deux coins opposés de l'emprise : la diagonale s'affiche, environ ${U(23.32)} ${UN()}.`)},
            'Le métré': { why: `Et voilà la récompense : le <b>métré</b> transforme ton dessin en quantités, calque par calque. Longueurs, surfaces, nombres d'objets : tout est compté.`,
                do: `Clique sur le bouton <b>Σ Métré</b>, en haut, et retrouve le calque Parking. « Copier (tableur) » le colle directement dans un devis.`},
            'L\'aperçu': { why: `Dernière étape : voir la feuille exactement comme elle sortira de l'imprimante.`,
                do: ol('Ferme le métré avec la croix ✕.', 'Clique sur le bouton <b>Aperçu</b>, en haut.', `Molette = échelle, ${SP} = portrait ou paysage, ${K('Entrée')} = imprimer, ${K('Échap')} = quitter.`)},
            'Bravo, vous êtes initié !': { title: 'Bravo, tu es initié !', why: `Tu viens de monter un vrai petit plan : calque, emprise, accès au suivi polaire, places en réseau, arbres jalonnés, cotes, regard, textes, contrôle et métré. Chapeau !`,
                do: `Pense à l'enregistrer avec ${K('Ctrl')}+${K('S')} (.mmc). Le DXF, lui, sert à l'échanger avec les autres.`,
                more: `Prochain tuto : <b>Le paramétrage</b> (niveau Expert).` },
        },
        cub: {
            'Le terrassement du parking': { why: `Niveau <b>maître</b> ! Tu te souviens du parking de l'Initié ? Bon, alors cette fois on le pose sur un vrai terrain en pente, et on fait l'étude de terrassement complète : plateforme, talus, structure, puis les <b>cubatures</b>, le <b>profil en long</b> et le <b>métré chiffré</b>.`,
                do: `Il nous faut d'abord un <b>terrain naturel</b>. En vrai, c'est le levé du géomètre (DXF, CSV…). Ici, je t'en crée un de 40 × 40 m, avec une pente et une petite bosse. Clique sur le bouton !`,
                more: `Le modèle en pointillés marche comme d'habitude : jaune = maintenant, vert = fait.` },
            'Compléter le levé : un point topo': { why: `Premier réflexe : on complète le levé. Il arrive que le géomètre oublie un point, ou qu'on relève un regard sur place. Un <b>point topo</b> porte une altitude Z, et le terrain se recalcule avec lui.`,
                do: () => ol('Clique sur l\'outil <b>Point topo</b>.', 'Clique sur le centre du rond jaune.', `Tape l'altitude ${K('102,4')} au clavier, puis ${SP}.`),
                more: `Survole un point coté : son Z s'affiche en bas à droite.` },
            'Lire le terrain en 3D': { why: `Avant de concevoir quoi que ce soit, on <b>comprend le terrain</b>. Note bien l'importance de ce coup d'œil : où sont les bosses, dans quel sens ça penche, où il faudra creuser…`,
                do: `Clique sur la bulle <b>œil 3D</b> près de la rosace. Glisser = tourner, molette = zoom ; <b>Aberration ×</b> exagère le relief. Repère la bosse.<br>Puis <b>referme la vue 3D</b> (bulle œil ou ${K('Échap')}) : la suite se fait sur le plan.` },
            'Les courbes de niveau': { why: `De retour sur le plan, on lit le relief à plat avec les <b>courbes de niveau</b>, comme sur une carte IGN : serrées, ça monte fort ; espacées, c'est plat.`,
                do: ol('Clique sur l\'outil <b>Courbes de niveau</b>.', `Dans la fenêtre, équidistance ${K('0,5')}, puis clique sur <b>Générer</b>.`)},
            'L\'emprise du parking': { why: `C'est bien ! Maintenant on pose le projet. La <b>plateforme</b>, c'est la forme du projet à son altitude : un parking, une dalle, une voirie. On commence par son contour.`,
                do: () => ol('Clique sur l\'outil <b>Rectangle</b>.', 'Clique sur le point jaune.', `Amène la souris en haut à droite, tape la longueur ${K(U(20))} au clavier, puis ${SP}.`, `Tape la largeur ${K(U(12))}, puis ${SP}.`)},
            'Le niveau du parking': { why: `On donne au parking son altitude finie : 102,00. Et regarde bien ce qui se passe : MomoCAD dessine aussitôt les <b>talus</b> jusqu'au terrain, <span style="color:#fca5a5">rouges en déblai</span> (on creuse) et <span style="color:#93c5fd">bleus en remblai</span> (on apporte).`,
                do: ol('Sélectionne le rectangle : clique sur un de ses côtés.', `Appuie sur ${K('Y')} : la fenêtre de réglage s'ouvre.`, `Onglet <b>Plateforme</b> (icône ▭) : nom <b>Parking</b>, Z de tous les sommets ${K('102')}.`, 'Clique sur <b>Appliquer</b>.')},
            'Adoucir le remblai': { why: `La pente des talus dépend du sol : 3/2 en remblai courant, 1/1 en déblai bien tenu. Note bien qu'un talus plus doux prend plus de place… et change les volumes. On adoucit le remblai.`,
                do: ol(`Sélectionne la plateforme, puis appuie sur ${K('Y')}.`, 'Ouvre l\'onglet <b>Talus</b> (icône ◢) : un schéma en coupe.', 'Clique <b>Remblai</b> au-dessus du schéma, puis tape <b>H = 1</b> et <b>L = 2</b> : 2 m à plat pour 1 m de haut.', 'Clique sur <b>Appliquer</b>, et regarde les talus bleus s\'élargir.'),
                more: `Une plateforme <b>inclinée</b> (une rampe) se règle au même endroit : un Z par sommet.` },
            'La structure de chaussée': { why: `Sous l'enrobé, il y a des couches : GNT, géotextile… On les décrit dans la <b>structure</b>. MomoCAD les quantifie (volume, tonnage, prix) et terrasse au <b>fond de forme</b>, sous la dernière couche.`,
                do: ol(`Sélectionne la plateforme, puis appuie sur ${K('Y')}.`, 'Ouvre le onglet <b>▤ Structure</b>.', 'Ajoute <b>GNT 0/31,5</b> sur 20 cm et <b>GNT 0/80</b> sur 30 cm.', 'Clique sur <b>Appliquer</b>.')},
            'Lancer les cubatures': { why: `Tout est prêt, on lance le calcul ! Les <b>cubatures</b> donnent les volumes de déblai et de remblai, plateforme par plateforme, talus et structure compris.`,
                do: ol('Clique sur le bouton <b>Cubatures</b>.', 'Coche la plateforme <b>Parking</b>.', 'Clique sur <b>2. Résultats</b>.')},
            'Lire les résultats': { why: `Regarde : le parking est à cheval sur la bosse, alors il y a du déblai d'un côté et du remblai de l'autre. Lis le <b>déblai</b> et le <b>remblai</b> : ce sont les deux chiffres qu'on va te demander en premier, poste par poste (plateforme, talus, recul, remblai périphérique).`,
                do: `<ul><li><b>PDF</b> : le rapport, avec vue en plan cotée et vues 3D ;</li><li><b>Copier (tableur)</b> : pour le devis ;</li><li><b>Tracer sur le plan</b> : la limite entre déblai et remblai.</li></ul>` },
            'Le profil en long': { why: `On fait maintenant une coupe : le <b>profil en long</b>. Il montre le terrain et le projet le long d'un axe, avec son tableau de cotes. D'un coup d'œil, tu vois où on creuse et où on remblaie.`,
                do: () => ol('Clique sur l\'outil <b>Profil en long</b>.', 'Clique sur les 2 points jaunes de l\'axe.', `Appuie sur ${SP} : le profil s'affiche.`)},
            'Le métré chiffré': { why: `Et pour finir, la synthèse pour le devis : le <b>métré chiffré</b>. Déblai, remblai, chaque produit de la structure, avec tes prix et le <b>total HT</b>.`,
                do: ol('Ferme le profil avec la croix ✕.', 'Clique sur le bouton <b>Σ Métré</b> : tableau « Terrassement et matériaux ».')},
            'Maître du terrassement !': { why: `Bravo, tu es maître du terrassement ! Levé complété, relief lu, plateforme calée à 102,00, talus réglés, structure, cubatures, profil, tranchée et métré chiffré : c'est le circuit complet d'une vraie étude.`,
                more: `Prochain tuto : <b>Le bâtiment — une cabane</b> (niveau Seigneur).` },
        },
        model: {
            'La cabane : les murs': { why: `Bon, alors place au bâtiment ! On commence par les murs. Un mur porte son matériau (parpaing, brique, béton…) : il se hachure en plan et deviendra un volume percé en 3D. Et quand tu les traces en chaîne, les angles se raccordent tout seuls.`,
                do: ol('Clique sur le bouton <b>Paroi</b> (palette Bâtiment), puis sur un mur dans le tiroir.', 'Clique sur les 4 coins jaunes, dans l\'ordre…', '…puis à nouveau sur le premier : le contour se referme.', `Appuie sur ${K('Échap')}.`)},
            'La hauteur des murs': { why: `Note bien ce point, on l'oublie souvent : en plan, un mur n'a pas de hauteur. On lui donne un <b>niveau bas</b> et un <b>niveau haut</b> pour qu'il existe en 3D, et que les ouvertures le percent.`,
                do: ol('Sélectionne les murs : clique sur l\'un d\'eux, toute la chaîne passe en rose.', `Appuie sur ${K('Y')} : la fenêtre de réglage s'ouvre.`, 'Niveau bas <b>0</b>, niveau haut <b>2,50</b>, puis clique sur <b>Appliquer</b>.')},
            'La fenêtre': { why: `On perce la fenêtre, proprement : au bon endroit et à la bonne largeur. Tu accroches le début, tu tapes la largeur.`,
                do: () => ol('Clique sur l\'outil <b>Ouverture</b>.', 'Clique sur le point jaune, sur le mur.', `Amène la souris vers la droite, tape la largeur ${K(U(1.2))} au clavier, puis ${SP}.`, 'Dans la fenêtre : choisis <b>Fenêtre</b> (allège 1,00, hauteur 1,25), puis clique sur <b>Valider</b>.')},
            'La porte': { why: `C'est bien ! Maintenant la porte. Elle se dessine avec son battant : tu choisis le côté de la charnière et le sens d'ouverture. Pratique pour vérifier qu'elle ne tape dans rien !`,
                do: () => ol('Clique sur l\'outil <b>Ouverture</b>.', 'Clique sur le point jaune.', `Amène la souris vers le haut, tape la largeur ${K(U(0.9))} au clavier, puis ${SP}.`, 'Dans la fenêtre : choisis <b>Porte</b>, la charnière et le sens d\'ouverture (vers l\'intérieur), puis clique sur <b>Valider</b>.'),
                more: `Double-clic sur une ouverture pour la modifier.` },
            'La panne faîtière': { why: `Avant le toit, on pose ce qui le porte : la <b>panne faîtière</b>. L'outil <b>Poutre</b> fait du bois ou de l'acier, droit ou en pente, et sa section reste perpendiculaire, comme un vrai chevron.`,
                do: ol('Clique sur l\'outil <b>Poutre</b>.', 'Clique sur les 2 points jaunes.', 'Dans la fenêtre, garde le bois 63×175.', 'Onglet <b>Altitudes de l\'axe</b> (icône ↕ du bandeau à gauche) : Z départ et Z arrivée <b>4,70</b>, puis clique sur <b>Appliquer</b>.')},
            'Le toit deux pans': { why: `Et maintenant on couvre la cabane, en une seule fois. Tu dessines le toit sur le <b>contour des murs</b>, et MomoCAD ajoute tout seul le <b>débord</b> (l'avancée de toiture) tout autour : les pignons, eux, restent alignés sur les murs.`,
                do: () => ol('Clique sur l\'outil <b>Toiture</b>.', 'Clique sur le point jaune, le coin des murs.', `Amène la souris en haut à droite, tape ${K(U(5))} au clavier, puis ${SP}.`, `Tape ${K(U(4))}, puis ${SP}.`, 'Dans la fenêtre : <b>2 pans</b>, faîtage parallèle <b>au grand côté</b>, égout <b>2,50</b>, faîtage <b>5,00</b>, débord <b>0,30</b>.', 'Coche <b>Combler les pignons</b>, puis clique sur <b>Créer le toit</b>.'),
                more: `Plus tard, ${K('Y')} sur le toit puis <b>Modifier la toiture</b> : débord, hauteurs, et une texture pour la couverture et une autre pour la sous-face de l'avancée.` },
            'Les tuiles': { why: `La touche finale : une couverture en tuiles, à l'échelle.`,
                do: ol('Clique sur l\'outil <b>Peindre</b>.', 'Dans la fenêtre des textures, clique sur <b>Tuiles</b>.', 'Clique sur les deux pans du toit.')},
            'Admirez': { title: 'Admire !', why: `Le moment de vérité : murs percés, porte, fenêtre, panne, toit et pignons… Fais-en le tour ! Et en plan, en vue de côté (X ou Y sur la rosace), tu as tes façades en traits, prêtes à coter.`,
                do: ol('Clique sur la bulle <b>œil 3D</b>, près de la rosace.', 'Fais le tour de la cabane : glisser = tourner, molette = zoom.', `Referme la vue 3D : bulle œil ou ${K('Échap')}.`)},
        },
        build: {
        },
    };
    function applyVoice(id, steps) {
        const V = HUMAN[id] || {};
        steps.forEach(s => { const v = V[s.title]; const jl = (JAL[id] || {})[s.title]; if (v) Object.assign(s, v); if (jl) s.jal = jl; });
    }

    // ---------- confettis : Momo fête chaque étape réussie ----------
    function confetti() {
        try {
            if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            const r = (momo || root).getBoundingClientRect(), x0 = r.left + r.width / 2, y0 = r.top + r.height * 0.3;
            const cv = document.createElement('canvas'), dpr = window.devicePixelRatio || 1;
            cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:90';
            cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; document.body.appendChild(cv);
            const c = cv.getContext('2d'); c.scale(dpr, dpr);
            const COL = ['#f59e0b', '#22c55e', '#7c3aed', '#38bdf8', '#f43f5e', '#fde047', '#a78bfa'];
            const P = Array.from({ length: 90 }, () => { const a = -Math.PI / 2 + (Math.random() - 0.6) * 1.9, v = 6 + Math.random() * 8;
                return { x: x0, y: y0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: 5 + Math.random() * 6, h: 3 + Math.random() * 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, col: COL[(Math.random() * COL.length) | 0], round: Math.random() < 0.25 }; });
            const t0 = performance.now();
            (function frame(t) {
                const k = (t - t0) / 1600; c.clearRect(0, 0, innerWidth, innerHeight);
                if (k >= 1) { cv.remove(); return; }
                c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
                P.forEach(p => { p.vy += 0.32; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
                    c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.col;
                    if (p.round) { c.beginPath(); c.arc(0, 0, p.h / 1.4, 0, 2 * Math.PI); c.fill(); } else c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 1.7)) + 1);
                    c.restore(); });
                requestAnimationFrame(frame);
            })(t0);
        } catch (e) {}
    }

    // ---------- jalons vérifiés en direct : chaque ligne de « À toi » a son contrôle ----------
    // Une ligne est cochée si son contrôle est vrai ET que toutes les lignes d'avant le sont aussi ; sinon elle se décoche.
    const gv = (f) => { try { return f(); } catch (e) { return undefined; } };
    const uv = (v) => gv(() => v * 1000 / (UNIT_MM[currentUnit] || 1)) || v;
    const num = (t) => gv(() => t2Num(t));
    const J = {
        btn: (id) => () => { const e = document.getElementById(id); return !!e && e.classList.contains('active'); },
        mode: (m) => () => G.mode() === m,
        solid: (k) => () => gv(() => solidTool) === k,
        start: (p, m) => () => (!m || G.mode() === m) && !!gv(() => isDrawing) && near({ x: gv(() => startX), y: gv(() => startY) }, W(...p)),
        typed: (v, raw) => () => { const t = gv(() => typedInput); if (!t) return false; const n = num(t); return isFinite(n) && Math.abs(n - (raw ? v : uv(v))) < 1e-6 + Math.abs(raw ? v : uv(v)) * 1e-6; },
        pline: (pts) => () => { const C = gv(() => currentPolygon) || []; return G.mode() === 'pline' && C.length >= pts.length && pts.every((p, i) => near(C[i], W(...p))); },
        selHas: (...f) => () => { const S = G.sel(); return f.every(g => { const o = g(); return !!o && S.includes(o); }); },
        selAny: () => G.sel().length > 0,
        shown: (id) => () => G.shown(id),
        modal: (txt) => () => G.modalHas(txt),
        clicks: (n) => (j) => j.clicks >= n,
        res: (f) => () => !!f(),
    };
    const halfL = () => polyOf([[0, 0], [0, 4], [1.5, 2]], false), halfR = () => polyOf([[3, 0], [3, 4], [1.5, 2]], false);
    const rectW = () => G.mode() === 'rect' && !!gv(() => isDrawing) && gv(() => rectDimStep) >= 1;   // 1re dimension du rectangle validée
    const towardUR = () => !!gv(() => isDrawing) && gv(() => currentX) > gv(() => startX) && gv(() => currentY) < gv(() => startY);
    const selHasPlat = () => J.selHas(() => polyOf(PLAT, true))();
    const JAL = {
        base: {
            'Le M, première moitié': [J.mode('pline'), J.pline([[0, 0], [0, 4], [1.5, 2]])],
            'Le M, l\'autre moitié en miroir': [J.selHas(halfL), J.mode('mirror'), () => { const a = gv(() => mirrorA), b = gv(() => mirrorB), X = W(1.5, 0).x, t = TOL(); return !!a && !!b && Math.abs(a.x - X) <= t && Math.abs(b.x - X) <= t; }],
            'Le M, d\'un seul morceau': [J.selHas(halfL, halfR)],
            'Le O': [J.mode('circle'), J.start([5.5, 2], 'circle'), J.typed(2)],
            'Sélectionner M et O ensemble': [J.mode('select-box'), () => !!gv(() => isDrawing) && G.mode() === 'select-box' && (near({ x: startX, y: startY }, W(-0.6, 4.6)) || near({ x: startX, y: startY }, W(7.9, -0.6))), J.selHas(() => polyOf(M1, false), () => circleOf([5.5, 2], 2))],
            'MOMO : copier M et O': [J.selHas(() => polyOf(M1, false), () => circleOf([5.5, 2], 2)), J.mode('copy'), () => G.mode() === 'copy' && near(gv(() => t2.cpBase) || { x: 1e18, y: 0 }, W(0, 0)), () => !!polyOf(M2, false) && !!circleOf([14, 2], 2)],
            'Le C': [J.mode('arc'), () => G.mode() === 'arc' && gv(() => arcStep) >= 1 && near(arcCenter, W(19, 2)), () => G.mode() === 'arc' && gv(() => arcStep) >= 2 && near(arcP1, W(19 + 2 * Math.SQRT1_2, 2 - 2 * Math.SQRT1_2))],
            'Le A': [J.mode('pline'), J.pline([[22, 0], [23.5, 4], [25, 0]])],
            'La barre du A, trop longue': [J.mode('line')],
            'Couper ce qui dépasse': [J.mode('trim')],
            'Le D, d\'abord un rectangle': [J.mode('rect'), J.start([26, 0], 'rect'), () => J.start([26, 0], 'rect')() && towardUR(), rectW],
            'Éclater le rectangle': [J.selHas(() => polyOf([[26, 0], [28.5, 0], [28.5, 4], [26, 4]], true))],
            'Arrondir le haut du D': [J.mode('fillet'), () => G.mode() === 'fillet' && !!gv(() => filletA) && !!gv(() => filletB)],
            'Arrondir le bas du D': [() => G.mode() === 'fillet' && !!gv(() => filletA) && !!gv(() => filletB)],
            'Le soulignement': [J.mode('line'), J.start([0, -1], 'line'), () => !!gv(() => isDrawing) && G.mode() === 'line' && (gv(() => shiftHeld) || G.ortho()) && gv(() => currentX) > gv(() => startX), J.typed(20)],
            'Le soulignement à la bonne longueur': [J.mode('lengthen'), () => { const L = gv(() => t2.lenSpec); return G.mode() === 'lengthen' && !!L && L.kind === 'total' && Math.abs(L.v - uv(28.5)) < 1e-6; }],
            'Doubler le soulignement': [J.mode('offset'), () => G.mode() === 'offset' && J.typed(0.5)(), () => { const t = gv(() => offsetTarget), Y = W(0, -1).y; return G.mode() === 'offset' && !!t && t.type === 'line' && Math.abs(t.y1 - Y) <= TOL() && Math.abs(t.y2 - Y) <= TOL(); }],
            'Remplir les O': [J.mode('hatch'), () => hatchAt([5.5, 2]) && hatchAt([14, 2])],
        },
        adv: {
            'Un calque Parking': [() => G.shown('layer-modal') || !!parkLayer(), () => !!parkLayer() && G.active() === parkLayer().id],
            'L\'emprise du parking': [J.mode('rect'), J.start([0, 0], 'rect'), rectW],
            'L\'accès en biais (suivi polaire)': [() => G.polar() && !G.ortho(), J.mode('line'), J.start([20, 4], 'line'), () => !!gv(() => isDrawing) && G.mode() === 'line' && Math.abs(Math.atan2(startY - currentY, currentX - startX) * 180 / Math.PI - 45) < 0.5, J.typed(4)],
            'Une place de parking': [J.mode('rect'), J.start([1, 0], 'rect'), rectW],
            'Six places d\'un coup : le réseau': [J.selHas(() => polyOf(PLACE(0), true)), () => G.mode() === 'array', () => { const A = gv(() => t2.arr); return G.mode() === 'array' && !!A && A.kind === 'rect' && +A.nx === 6 && +A.ny === 1 && Math.abs(num(String(A.dx)) - uv(2.5)) < 1e-6; }],
            'La limite plantée': [J.mode('line')],
            'Planter les arbres : diviser': [J.mode('divide'), () => G.mode() === 'divide' && !!gv(() => t2.div), () => gv(() => t2.div.mode) === 'n' && +gv(() => t2.div.n) === 4, () => gv(() => t2.div.what) === 'block' && /arbre/i.test(String(gv(() => t2.div.blk) || ''))],
            'Coter la largeur': [J.mode('dim-ortho'), () => G.mode() === 'dim-ortho' && gv(() => dimStep) >= 2 && [dimP1, dimP2].every(q => q && (near(q, W(0, 0)) || near(q, W(20, 0))))],
            'Le regard': [J.mode('circle'), J.start([10, 9], 'circle'), J.typed(0.5)],
            'Coter le regard': [J.mode('dim-dia'), () => G.mode() === 'dim-dia' && !!gv(() => t2.dr) && t2.dr.s === circleOf([10, 9], 0.5)],
            'Le nom du parking': [J.mode('text'), () => !!gv(() => inlineEdit)],
            'Signaler l\'entrée': [J.mode('detail'), () => G.mode() === 'detail' && gv(() => detailStep) >= 1 && near(detailTarget, W(...ACM)), () => G.mode() === 'detail' && gv(() => detailStep) >= 2],
            'Contrôler : mesurer': [J.mode('measure')],
            'L\'aperçu': [() => !G.shown('topo-modal'), () => G.mode() === 'preview'],
        },
        cub: {
            'Compléter le levé : un point topo': [J.mode('topo'), () => { const t = gv(() => lastTopo); return G.mode() === 'topo' && !!t && near(t, W(12.5, 32.5)); }],
            'Les courbes de niveau': [() => G.modalHas('niveau')],
            'L\'emprise du parking': [J.mode('rect'), J.start([10, 14], 'rect'), rectW],
            'Le niveau du parking': [selHasPlat, () => G.shown('selparam-modal') && selHasPlat(), () => G.shown('selparam-modal') && G.val('sp-zall').replace(',', '.').trim() === '102'],
            'Adoucir le remblai': [() => G.shown('selparam-modal') && selHasPlat(), () => G.shown('selparam-modal') && !!document.getElementById('tj-rh-u') && document.getElementById('tj-dr-u').style.display !== 'none', () => G.shown('selparam-modal') && G.val('tj-rh-u').replace(',', '.') == 1 && G.val('tj-rl-u').replace(',', '.') == 2],
            'La structure de chaussée': [() => G.shown('selparam-modal') && selHasPlat(), () => G.shown('selparam-modal') && !!document.getElementById('st-box'), () => (gv(() => structEdit && structEdit.layers.length) || 0) >= 2],
            'Lancer les cubatures': [() => G.modalHas('ubatures')],
            'Le profil en long': [J.mode('profile'), () => G.mode() === 'profile' && (gv(() => profileAxis.length) || 0) >= 2],
            'Le métré chiffré': [() => !G.modalHas('Profil')],
        },
        model: {
            'La cabane : les murs': [J.mode('wall'), () => { const C = gv(() => wallChain); return G.mode() === 'wall' && !!C && C.pts.length >= 4 && CAB.every((p, i) => near(C.pts[i], W(...p))); }, () => !!wallGroup()],
            'La hauteur des murs': [() => G.sel().some(x => x.wallMat), () => G.sel().some(x => x.wallMat) && G.shown('selparam-modal')],
            'La fenêtre': [J.mode('opening'), () => G.mode() === 'opening' && !!gv(() => openA) && near(openA, W(8.5, 0)), () => J.typed(1.2)() || openings().some(o => o.a && o.b && Math.abs(Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) - mw(1.2)) <= mw(0.03))],
            'La porte': [J.mode('opening'), () => G.mode() === 'opening' && !!gv(() => openA) && near(openA, W(12, 1)), () => J.typed(0.9)() || openings().some(o => o.a && o.b && near(o.a, W(12, 1)) && Math.abs(Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) - mw(0.9)) <= mw(0.03))],
            'La panne faîtière': [J.solid('beam'), () => G.shapes().some(s => s.type === 'line' && s.sweep && s.sweep.perp && ((near({ x: s.x1, y: s.y1 }, W(7, 2)) && near({ x: s.x2, y: s.y2 }, W(12, 2))) || (near({ x: s.x1, y: s.y1 }, W(12, 2)) && near({ x: s.x2, y: s.y2 }, W(7, 2))))), () => G.shown('selparam-modal')],
            'Le toit deux pans': [J.solid('roof'), () => J.solid('roof')() && J.start([7, 0], 'rect')(), () => J.solid('roof')() && rectW(), () => G.modalHas('Toiture') || !!roofPans(), () => !!roofPans()],
            'Les tuiles': [() => !!gv(() => texPaint), () => gv(() => texPaint && texPaint.tex) === 'tuile'],
            'Admirez': [() => G.is3D()],
        },
        build: {
        },
    };
    // ---------- interface ----------
    const CSS = `
    #mt-root { position:absolute; inset:0; pointer-events:none; font-family: system-ui, 'Segoe UI', sans-serif; }
    #mt-bubble { display:none; z-index:80; pointer-events:auto; position:absolute; left:10px; bottom:118px; width:400px; max-width:calc(100vw - 260px); max-height:calc(100vh - 170px); overflow:auto; background:#111827f5; color:#e5e7eb; border:1.5px solid #7c3aed; border-radius:16px; padding:14px 16px 12px; font-size:14px; line-height:1.55; box-shadow:0 12px 32px #0009; backdrop-filter: blur(4px); transition: border-color .3s; }
    #mt-bubble.done { border-color:#22c55e; }
    #mt-bubble .mt-h { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
    #mt-bubble .mt-n { color:#a78bfa; font-size:11.5px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; white-space:nowrap; }
    #mt-bubble .mt-t { font-weight:800; color:#fff; font-size:16.5px; line-height:1.3; margin:0 0 8px; display:flex; align-items:center; gap:8px; }
    #mt-bubble .mt-ck { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:#22c55e; color:#052e16; font-size:14px; font-weight:900; flex:0 0 22px; }
    #mt-bubble .mt-x { color:#9ca3af; font-size:17px; line-height:1; padding:0 2px; background:none; border:0; cursor:pointer; }
    #mt-bubble .mt-x:hover { color:#fff; }
    #mt-bubble .mt-lab { display:block; font-size:11px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; margin-bottom:3px; }
    #mt-bubble .mt-why { margin-bottom:10px; } #mt-bubble .mt-why .mt-lab { color:#c4b5fd; }
    #mt-bubble .mt-do { background:#1f2937; border:1px solid #374151; border-radius:10px; padding:9px 11px; margin-bottom:8px; } #mt-bubble .mt-do .mt-lab { color:#fbbf24; }
    #mt-bubble .mt-more { background:#f59e0b14; border-left:3px solid #f59e0b; border-radius:6px; padding:6px 9px; color:#fde68a; font-size:13px; margin-bottom:8px; }
    #mt-bubble ol, #mt-bubble ul { margin:4px 0 0; padding-left:20px; } #mt-bubble li { margin:2px 0; }
    #mt-bubble .mt-do ol { list-style:none; padding-left:0; counter-reset: jl; }
    #mt-bubble .mt-do ol > li { position:relative; padding-left:28px; counter-increment: jl; transition: color .3s; }
    #mt-bubble .mt-do ol > li:before { content: counter(jl); position:absolute; left:0; top:2px; width:19px; height:19px; border-radius:50%; border:1.5px solid #6b7280; color:#9ca3af; font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; box-sizing:border-box; transition: all .3s; }
    #mt-bubble .mt-do ol > li.ck { color:#bbf7d0; }
    #mt-bubble .mt-do ol > li.ck:before { content:'✓'; background:#22c55e; border-color:#22c55e; color:#052e16; font-size:12px; animation: mt-pop .35s ease-out; }
    @keyframes mt-pop { 0% { transform: scale(.4); } 70% { transform: scale(1.25); } 100% { transform: scale(1); } }
    #mt-bubble kbd { display:inline-block; min-width:18px; text-align:center; padding:0 5px; margin:0 1px; border:1px solid #6b7280; border-bottom-width:2px; border-radius:4px; background:#1f2937; color:#fde68a; font-family:ui-monospace,monospace; font-size:12px; }
    #mt-bubble small { color:#9ca3af; }
    #mt-state { font-size:13px; font-weight:600; margin:2px 0 0; }
    #mt-state.wait { color:#9ca3af; } #mt-state.ok { color:#86efac; }
    #mt-bar { height:4px; background:#374151; border-radius:2px; margin:10px 0 9px; overflow:hidden; }
    #mt-bar i { display:block; height:100%; background:linear-gradient(90deg,#7c3aed,#22c55e); transition:width .35s; }
    #mt-acts { display:flex; gap:8px; justify-content:flex-end; align-items:center; }
    #mt-acts button { border:0; border-radius:10px; width:46px; height:36px; font-size:18px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
    .mt-arw { background:#374151; color:#e5e7eb; } .mt-arw:hover { background:#4b5563; }
    .mt-arw.go { background:#22c55e; color:#052e16; animation: mt-go 1.2s ease-in-out infinite; } .mt-arw.go:hover { background:#4ade80; }
    @keyframes mt-go { 0%,100% { box-shadow:0 0 0 0 #22c55e66; } 50% { box-shadow:0 0 0 7px #22c55e00; } }
    .mt-link { border:0; background:#065f46; color:#d1fae5; border-radius:8px; padding:6px 10px; font-weight:700; font-size:13px; cursor:pointer; margin-top:8px; }
    /* barre de défilement discrète, dans les tons de Momo */
    #mt-bubble { scrollbar-width: thin; scrollbar-color: rgba(167,139,250,.45) transparent; }
    #mt-bubble::-webkit-scrollbar { width: 6px; }
    #mt-bubble::-webkit-scrollbar-track { background: transparent; margin: 14px 0; }
    #mt-bubble::-webkit-scrollbar-thumb { background: rgba(167,139,250,.35); border-radius: 6px; }
    #mt-bubble::-webkit-scrollbar-thumb:hover { background: rgba(167,139,250,.7); }
    #mt-bubble::-webkit-scrollbar-button { display: none; height: 0; }
    #mt-root.open #mt-bubble { display:block; }
    #mt-momo .mt-hat-cap { display:none; } #mt-root.cap #mt-momo .mt-hat-cap { display:inline; } #mt-root.cap #mt-momo .mt-hat-toque { display:none; }
    #mt-bubble .mt-menu { display:flex; flex-direction:column; gap:6px; margin-top:6px; }
    #mt-bubble .mt-tu { display:grid; grid-template-columns:auto 1fr; gap:2px 8px; align-items:center; text-align:left; background:#1f2937; border:1px solid #374151; border-radius:10px; padding:7px 10px; color:#e5e7eb; cursor:pointer; }
    #mt-bubble .mt-tu:hover { border-color:#7c3aed; background:#2e1065; }
    #mt-bubble .mt-lvl { grid-row:span 2; font-size:10.5px; font-weight:800; color:#fff; border-radius:6px; padding:2px 6px; text-transform:uppercase; letter-spacing:.03em; }
    #mt-bubble .mt-tt { font-weight:700; font-size:13.5px; color:#fff; } #mt-bubble .mt-td { font-size:11.5px; color:#9ca3af; }
    #mt-bubble .mt-big { grid-template-columns:auto 1fr; padding:10px 12px; } #mt-bubble .mt-big .mt-ico { grid-row:span 2; font-size:26px; }
    #mt-bubble .mt-ia:hover { border-color:#eab308; background:#422006; }
    #mt-bubble .mt-menu-b { font-size:15px; margin-right:4px; vertical-align:middle; }
    #mt-root.pinned #mt-bubble { z-index:100; border-style:double; border-width:3px; }
    #mt-bubble .mt-pin { display:inline-flex; color:#6b7280; } #mt-bubble .mt-pin:hover { color:#fff; } #mt-bubble .mt-pin.on { color:#fbbf24; transform:rotate(-30deg); }
    #mt-root.under #mt-bubble { opacity:.13; pointer-events:none; transition: opacity .2s; } #mt-root.under #mt-dock:hover + #mt-bubble { opacity:1; pointer-events:auto; }
    /* Momo docké derrière la barre de commande : on ne voit que sa toque ; survolé, il sort les yeux ; ouvert, il sort en entier */
    #mt-dock { position:absolute; left:10px; bottom:0; z-index:25; width:64px; height:78px; pointer-events:auto; cursor:pointer; transform:translateY(20px); transition:transform .28s cubic-bezier(.3,1.4,.5,1); }
    #mt-dock:hover, #mt-root.hello #mt-dock { transform:translateY(-6px); } #mt-root.open #mt-dock { transform:translateY(-36px); }
    /* bonjour au démarrage : Momo sort les yeux et dit qu'il est là, 5 s */
    #mt-hello { position:absolute; left:80px; bottom:58px; z-index:26; max-width:250px; background:#2e1065; color:#f5f3ff; border:2px solid #7c3aed; border-radius:14px; padding:9px 13px; font:600 13px/1.4 Arial, sans-serif; box-shadow:0 8px 20px #0009; cursor:pointer; pointer-events:auto; opacity:0; transform:translateY(8px) scale(.92); transform-origin:left bottom; transition:opacity .3s, transform .35s cubic-bezier(.3,1.5,.5,1); }
    #mt-hello.on { opacity:1; transform:none; }
    #mt-hello:before { content:''; position:absolute; left:-11px; bottom:12px; border:9px solid transparent; border-right-color:#7c3aed; border-left:0; }
    #mt-dot { display:none; position:absolute; top:-6px; right:-10px; background:#7c3aed; color:#fff; font-size:11px; font-weight:800; border-radius:10px; padding:0 6px; line-height:18px; pointer-events:none; }
    #mt-root:not(.open) #mt-dot { display:block; } #mt-dot.ok { background:#22c55e; color:#052e16; }
    #mt-momo { width:64px; height:78px; display:block; filter: drop-shadow(0 4px 6px #0008); }
    #mt-momo.jump { animation: mt-jump .6s ease-out; }
    #mt-momo .mt-eye { transform-box: fill-box; transform-origin:center; animation: mt-blink 4.6s infinite; }
    #mt-momo .mt-mouth { transform-box: fill-box; transform-origin:center top; }
    #mt-momo.talk .mt-mouth { animation: mt-talk .18s 6 alternate; }
    #mt-momo .mt-tassel { transform-box: view-box; transform-origin: 66px 22px; animation: mt-swing 2.4s ease-in-out infinite; }
    @keyframes mt-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
    @keyframes mt-jump { 0% { transform: translateY(0) scale(1); } 30% { transform: translateY(-22px) scale(1.06, .96); } 60% { transform: translateY(0) scale(.96, 1.05); } 100% { transform: translateY(0) scale(1); } }
    @keyframes mt-blink { 0%, 93%, 100% { transform: scaleY(1); } 96% { transform: scaleY(.12); } }
    @keyframes mt-talk { from { transform: scaleY(1); } to { transform: scaleY(.55); } }
    @keyframes mt-swing { 0%,100% { transform: rotate(-6deg); } 50% { transform: rotate(7deg); } }
    #mt-ring { position:fixed; z-index:85; pointer-events:none; border:2px solid #f59e0b; border-radius:8px; box-shadow:0 0 0 4px #f59e0b44, 0 0 18px #f59e0b88; animation: mt-pulse 1.1s ease-in-out infinite; transition: all .25s; }
    @keyframes mt-pulse { 0%,100% { box-shadow:0 0 0 3px #f59e0b44, 0 0 10px #f59e0b66; } 50% { box-shadow:0 0 0 8px #f59e0b22, 0 0 22px #f59e0baa; } }
    #mt-tip { position:fixed; z-index:86; pointer-events:none; background:#f59e0b; color:#111827; font-weight:700; font-size:12.5px; line-height:1.3; padding:6px 10px; border-radius:8px; box-shadow:0 6px 16px #0008; white-space:nowrap; transition: top .25s, left .25s; }
    #mt-tip small { font-weight:500; color:#3b2a06; }
    #mt-tip:before { content:''; position:absolute; left:-7px; top:50%; margin-top:-7px; border:7px solid transparent; border-right-color:#f59e0b; border-left:0; }
    #mt-tip.r:before { left:auto; right:-7px; border-right:0; border-left:7px solid #f59e0b; }
    #mt-tip.back { background:#38bdf8; } #mt-tip.back.r:before { border-left-color:#38bdf8; } #mt-tip.back:not(.r):before { border-right-color:#38bdf8; }
    @media (prefers-reduced-motion: reduce) { #mt-momo, #mt-momo .mt-eye, #mt-momo .mt-tassel, #mt-ring, .mt-arw.go { animation:none !important; } }`;

    // Momo : la toque de diplômé posée sur le visage O O / M du logo
    const MOMO_SVG = `<svg id="mt-momo" viewBox="0 0 100 122" xmlns="http://www.w3.org/2000/svg" aria-label="Momo, la mascotte">
        <defs><linearGradient id="mtCapTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d5bc4"/><stop offset="1" stop-color="#3f2f86"/></linearGradient>
        <linearGradient id="mtCap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2c78"/><stop offset="1" stop-color="#271c55"/></linearGradient><linearGradient id="mtBase" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#60a5fa"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs>
        <g class="mt-hat-toque"><path d="M27 24 Q50 32 73 24 L71 40 Q50 47 29 40 Z" fill="url(#mtCap)"/>
        <path d="M50 4 L94 20 L50 34 L6 20 Z" fill="url(#mtCapTop)" stroke="#2a1f5c" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M6 20 L50 34 L94 20 L94 22.5 L50 36.5 L6 22.5 Z" fill="#2a1f5c"/>
        <circle cx="50" cy="19" r="2.6" fill="#f59e0b"/>
        <g class="mt-tassel"><path d="M50 19 Q60 21 66 22 L66 44" fill="none" stroke="#f59e0b" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M63 43 L69 43 L70 52 L62 52 Z" fill="#f59e0b"/><circle cx="66" cy="54" r="4.2" fill="#fb923c"/></g></g>
        <g class="mt-hat-cap" transform="rotate(-14 50 34)"><path d="M24 41 Q22 13 52 12 Q80 13 80 41 Z" fill="url(#mtBase)" stroke="#1e3a8a" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M52 12 Q46 26 47 41 M66 15 Q70 28 68 41" fill="none" stroke="#1e40af" stroke-width="1.2" opacity=".75"/>
        <ellipse cx="52" cy="12.5" rx="3.6" ry="2.2" fill="#1e3a8a"/>
        <path d="M80 39 Q94 37 99 42 Q96 47 80 45 Z" fill="#1e40af" stroke="#172554" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M23 40 Q52 46 81 40 L81 44 Q52 50 23 44 Z" fill="#1d4ed8" stroke="#172554" stroke-width="1"/></g>
        <circle class="mt-eye" cx="32" cy="64" r="11" fill="none" stroke="#a1a1aa" stroke-width="6.5"/>
        <circle class="mt-eye" cx="68" cy="64" r="11" fill="none" stroke="#a1a1aa" stroke-width="6.5"/>
        <path class="mt-mouth" d="M36 116 L36 88 L50 104 L64 88 L64 116" fill="none" stroke="#a1a1aa" stroke-width="6.5" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;

    // catalogue des tutos (affiché dans le guide, onglet « Apprendre avec Momo »)
    const TUTOS = [
        { id: 'base', level: 'Débutant', title: 'Les outils de base — le logo MOMOCAD', desc: 'Exercice : redessiner le logo MOMOCAD lettre par lettre. Polyligne, miroir, joindre, cercle, sélection en fenêtre, copier, arc, droite, couper, rectangle, éclater, arrondir, longueur, décaler, hachure', minutes: 25, steps: BASE, setup: () => setupExercise(-1, 29.5, -2.5, 5) },
        { id: 'adv', level: 'Initié', title: 'Les outils avancés — un petit parking', desc: 'Exercice : le plan d\'un parking. Calque, accroches, suivi polaire, réseau de places, arbres plantés avec Diviser, cotes, regard et cote de diamètre, texte, infobulle, mesure, métré et aperçu', minutes: 25, steps: ADV, setup: () => setupExercise(-1, 24, -3, 15.5, 380) },
        { id: 'param', level: 'Expert', title: 'Le paramétrage', desc: 'Paramètres ⛯ expliqués réglage par réglage : précision et grille, impression, cartouche et indices, fond de plan, planches, Momo IA, catalogue de prix ; calques avancés (ligne -T-, hachures, points topo) et gabarit d\'entreprise', minutes: 25, steps: PARAM },
        { id: 'cub', level: 'Maître', title: 'Les cubatures — le terrassement du parking', desc: 'Exercice : caler le parking sur un terrain en pente. Point topo, vue 3D, courbes de niveau, plateforme à 102,00, talus, structure de chaussée, cubatures et rapport PDF, profil en long, tranchée d\'eaux pluviales, métré chiffré', minutes: 30, steps: CUB, setup: () => setupExercise(-2, 42, -2, 42, 380) },
        { id: 'model', level: 'Seigneur', title: 'Le bâtiment — une cabane', desc: 'Exercice : une cabane de 5 × 4 m. Dalle, parois, hauteur des murs, fenêtre, porte, panne faîtière, toit deux pans avec pignons, tuiles, tour en 3D', minutes: 25, steps: MODEL, setup: () => setupExercise(6.2, 12.8, -0.8, 4.8, 380) },
        { id: 'build', level: 'Dieu', title: 'Construire juste — une pergola', desc: 'Exercice : une pergola de 4 × 3 m. Dalle, traits de construction parallèles, poteaux aux croisements, poutres, trait de coupe, mesure et contrôle des collisions dans la vue 3D', minutes: 25, steps: BUILD, setup: () => setupExercise(-1.2, 5.2, -1.5, 4.5, 380) },
    ];
    let STEPS = null, done = [];   // STEPS null : Momo est actif, sans tuto en cours (menu)
    let view = 'home', menuMsg = '', pinned = false, cele = [], last3D = false, lastH = 0, root, bubble, ring, tip, momo, idx = 0, ctx = {}, timer = null;

    function build() {
        if (!document.getElementById('mt-css')) { const st = document.createElement('style'); st.id = 'mt-css'; st.textContent = CSS; document.head.appendChild(st); }
        const host = document.getElementById('canvas-container') || document.body;
        root = document.createElement('div'); root.id = 'mt-root';
        root.innerHTML = `<div id="mt-dock" title="Momo, ton prof : clique pour ouvrir ou refermer sa bulle">${MOMO_SVG}<span id="mt-dot">…</span></div><div id="mt-bubble"></div>`;
        host.appendChild(root);
        bubble = root.querySelector('#mt-bubble'); momo = root.querySelector('#mt-momo');
        root.querySelector('#mt-dock').addEventListener('click', () => setOpen(!root.classList.contains('open')));
        ring = document.createElement('div'); ring.id = 'mt-ring'; document.body.appendChild(ring);
        tip = document.createElement('div'); tip.id = 'mt-tip'; document.body.appendChild(tip);
        bubble.addEventListener('click', (e) => { const b = e.target.closest('button[data-a]'); if (!b) return; e.stopPropagation(); act(b.dataset.a); });
        bubble.addEventListener('mousedown', (e) => e.stopPropagation());
    }
    // ouvrir / replier la bulle (une seule bulle ouverte à la fois : le prof ou l'aide de chantier)
    function setOpen(v) {
        if (!root) return; if (v) endHello(); root.classList.toggle('open', !!v);
        if (v) { try { if (typeof mcToggle === 'function' && document.getElementById('mc-root') && document.getElementById('mc-root').classList.contains('open')) mcToggle(false); } catch (e) {} render(); }
        place();
    }
    let helloT = null;
    function hello() {   // au démarrage : les yeux sortent, petite bulle « clique sur moi », 5 s
        ensure(); if (!root || root.classList.contains('open') || STEPS) return;
        let h = root.querySelector('#mt-hello');
        if (!h) { h = document.createElement('div'); h.id = 'mt-hello'; h.textContent = "💡 Hey ! Si tu as besoin d'un coup de main, clique sur moi !";
            h.addEventListener('click', (e) => { e.stopPropagation(); endHello(); setOpen(true); }); h.addEventListener('mousedown', (e) => e.stopPropagation()); root.appendChild(h); }
        root.classList.add('hello'); requestAnimationFrame(() => h.classList.add('on'));
        clearTimeout(helloT); helloT = setTimeout(endHello, 5000);
    }
    function endHello() { clearTimeout(helloT); if (!root) return; root.classList.remove('hello'); const h = root.querySelector('#mt-hello'); if (h) { h.classList.remove('on'); setTimeout(() => { if (h.parentNode && !h.classList.contains('on')) h.remove(); }, 350); } }
    function jump() { momo.classList.remove('jump'); void momo.getBoundingClientRect(); momo.classList.add('jump'); }
    function act(a) {
        if (a === 'pin') { pinned = !pinned; root.classList.toggle('pinned', pinned); render(); return; }
        if (a === 'x') return setOpen(false);
        if (a.startsWith('t:')) return start(a.slice(2));   // la croix replie Momo
        if (a === 'home') { menuMsg = ''; view = 'home'; if (STEPS) return toMenu(); return render(); }
        if (a === 'list') { view = a; menuMsg = ''; return render(); }
        if (a === 'ia') { if (typeof momoGoIA === 'function') momoGoIA(); return; }
        if (!STEPS) return;
        if (a === 'prev') return go(Math.max(0, idx - 1));
        if (a === 'act') { const s = STEPS[idx]; if (s.action) s.action.fn(); return; }
        if (a === 'next') { if (STEPS[idx].last) { menuMsg = 'Bravo, tuto terminé ! 🎉'; view = 'list'; return toMenu(); } return go(idx + 1); }
        if (a === 'menu') { menuMsg = ''; view = 'list'; return toMenu(); }
        if (a.startsWith('t:')) return start(a.slice(2));
    }
    const BRAVO = ['Bravo, c\'est exactement ça !', 'Nickel !', 'Bien joué !', 'Impeccable !', 'Trop fort !', 'Yes, parfait !', 'Joli coup !', 'C\'est tout bon !'];
    const LVL_COL = { 'Débutant': '#15803d', 'Initié': '#0369a1', 'Expert': '#b45309', 'Maître': '#b91c1c', 'Seigneur': '#6d28d9', 'Dieu': 'linear-gradient(90deg,#a16207,#eab308)' };
    const PIN_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/></svg>';
    const HOME_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>', MIN_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 18h14"/></svg>';
    // en haut de la bulle : HOME (retour au choix de Momo) · PIN (figer la bulle par-dessus tout) · RÉDUIRE (Momo se cache derrière la barre)
    const headBtns = (xTitle) => `<span style="display:flex;gap:6px;align-items:center"><button class="mt-x" data-a="home" title="Retour au choix : tuto ou question">${HOME_SVG}</button><button class="mt-x mt-pin${pinned ? ' on' : ''}" data-a="pin" title="${pinned ? 'Désépingler la bulle' : 'Épingler : la bulle reste figée par-dessus tous les menus'}">${PIN_SVG}</button><button class="mt-x" data-a="x" title="${xTitle}">${MIN_SVG}</button></span>`;
    // pas de tuto en cours : Momo propose de choisir un tuto, depuis sa bulle
    let hatNow = '';
    function hatSet(h) {
        root.classList.toggle('cap', h === 'cap');
        if (hatNow && hatNow !== h && root.style.display !== 'none' && typeof momoTransform === 'function') momoTransform(root.querySelector('#mt-dock'));
        hatNow = h;
    }
    function renderMenu() {
        hatSet(view === 'home' ? 'cap' : 'toque');   // à l'accueil, Momo porte sa casquette ; pour les tutos, sa toque
        bubble.classList.remove('done');
        const dot = root.querySelector('#mt-dot'); if (dot) { dot.textContent = '…'; dot.classList.remove('ok'); }
        const E = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
        if (view === 'home') {
            bubble.innerHTML = `<div class="mt-h"><span class="mt-n">Momo</span>${headBtns('Réduire la bulle')}</div>
                <div class="mt-t">${menuMsg || 'Salut, moi c\'est Momo ! 👋'}</div>
                <div class="mt-why">Qu'est-ce qu'on fait ensemble ?</div>
                <div class="mt-menu">
                    <button type="button" class="mt-tu mt-big" data-a="list"><span class="mt-ico">🎓</span><span class="mt-tt">Apprendre avec un tuto</span><span class="mt-td">Six niveaux, du logo MOMOCAD à la cabane en 3D : je te guide geste par geste.</span></button>
                    <button type="button" class="mt-tu mt-big mt-ia" data-a="ia"><span class="mt-ico">👷</span><span class="mt-tt">Poser une question à Momo IA</span><span class="mt-td">Mon côté aide de chantier : une IA qui répond sur MomoCAD et sur ton plan. Il faut une clé Gemini (gratuite pour commencer) ou Claude.</span></button>
                </div>`;
            place(); return;
        }
        bubble.innerHTML = `<div class="mt-h"><span class="mt-n">Les tutos</span>${headBtns('Réduire la bulle')}</div>
            <div class="mt-t">${menuMsg || 'Quel tuto on fait ? 🎓'}</div>
            <div class="mt-why">On dessine pour de vrai, une action à la fois : je te montre le bouton, tu fais le geste, je coche ✓. Avec moi, tu vas devenir un vrai <b>cador de la DAO</b>.</div>
            <div class="mt-menu">${TUTOS.map(t => `<button type="button" class="mt-tu" data-a="t:${t.id}"><span class="mt-lvl" style="background:${LVL_COL[t.level] || '#374151'}">${E(t.level)}</span><span class="mt-tt">${E(t.title)}</span><span class="mt-td">${t.steps.length} étapes · ${t.minutes} min</span></button>`).join('')}</div>`;
        place();
    }
    function render() {
        if (!STEPS) return renderMenu();
        hatSet('toque');
        const s = STEPS[idx], n = STEPS.length, ok = !!done[idx], hasWait = typeof s.wait === 'function';
        const ready = ok || !hasWait;
        const btns = [];
        if (idx > 0) btns.push(`<button class="mt-arw" data-a="prev" title="Étape précédente">◀</button>`);
        btns.push(`<button class="mt-arw${ready ? ' go' : ''}" data-a="next" title="${s.last ? 'Terminer' : ready ? 'Étape suivante' : 'Passer cette étape'}">▶</button>`);
        let doTxt = typeof s.do === 'function' ? s.do() : (s.do || s.say);
        if (doTxt && hasWait && !/<ol[\s>]/.test(doTxt)) doTxt = ol(doTxt);   // même une action seule a sa case à cocher
        const doHtml = doTxt ? `<div class="mt-do"><span class="mt-lab">${hasWait ? 'À toi' : 'Comment on fait'}</span>${doTxt}${s.action ? `<div><button class="mt-link" data-a="act">${s.action.label}</button></div>` : ''}</div>` : (s.action ? `<button class="mt-link" data-a="act">${s.action.label}</button>` : '');
        const back3D = G.is3D() && !s.in3D && !s.last && !ok ? `<div class="mt-more" style="border-left-color:#38bdf8;color:#bae6fd;background:#38bdf814">↩ Attends, cette étape se fait sur le plan : referme d'abord la vue 3D (bulle œil ou ${K('Échap')}).</div>` : '';
        const state = hasWait ? (ok ? `<div id="mt-state" class="ok">✓ ${BRAVO[idx % BRAVO.length]} Quand tu es prêt, clique ▶ et on continue.</div>` : `<div id="mt-state" class="wait">⏳ Vas-y, je regarde… je coche dès que c'est bon.</div>`) : '';
        bubble.classList.toggle('done', ok);
        const dot = root.querySelector('#mt-dot'); if (dot) { dot.textContent = ok ? '✓' : '…'; dot.classList.toggle('ok', ok); }
        bubble.innerHTML = `<div class="mt-h"><span class="mt-n">Étape ${idx + 1} / ${n}</span>${headBtns('Réduire la bulle (le tuto continue)')}</div>
            <div class="mt-t">${ok ? '<span class="mt-ck">✓</span>' : ''}${s.title}</div>
            ${s.why ? `<div class="mt-why">${s.why}</div>` : ''}
            ${doHtml}
            ${s.more ? `<div class="mt-more">💡 ${typeof s.more === 'function' ? s.more() : s.more}</div>` : ''}
            ${back3D}${state}
            <div id="mt-bar"><i style="width:${Math.round((idx + (ready ? 1 : 0)) / n * 100)}%"></i></div><div id="mt-acts">${btns.join('')}</div>`;
        momo.classList.remove('talk'); void momo.getBoundingClientRect(); momo.classList.add('talk');
        bubble.scrollTop = 0; place(); if (jal) { jal.rules = null; jalTick(); }
    }
    // la cible peut être dans une fenêtre fermée : on montre alors le bouton qui la rouvre
    const OPENERS = [['#cartouche-modal', 'btn-print-settings', '↩ Rouvrir les Paramètres ⛯'], ['#menu-dxf', 'btn-dxf-menu', '↩ Rouvrir le menu fichier'], ['#layer-modal', 'button[onclick="openLayerModal()"]', '↩ Rouvrir le gestionnaire de calques']];
    const findEl = (sel) => !sel ? null : (sel instanceof Element ? sel : document.getElementById(sel) || (/[\[\.#\s]/.test(sel) ? document.querySelector(sel) : null));
    const visible = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    function resolveTarget() {
        const s = STEPS[idx]; if (!s) return { el: null };
        // étape sur le plan alors que la vue 3D est ouverte : on montre d'abord comment la refermer
        if (G.is3D() && !s.in3D && !s.last) { const eye = findEl('#v3-rose .rose-eye'); if (visible(eye)) return { el: eye, tip: '↩ Referme la vue 3D<br><small>œil ou Échap</small>', back: true }; }
        if (!s.target) return { el: null };
        const sel = typeof s.target === 'function' ? s.target() : s.target, tipTxt = typeof s.tip === 'function' ? s.tip() : s.tip;
        const e = findEl(sel);
        if (visible(e)) return { el: e, tip: tipTxt };
        const sels = typeof sel === 'string' ? sel : '';
        for (const [box, op, lab] of OPENERS) if (sels.startsWith(box) && !G.shown(box.slice(1))) { const o = findEl(op); if (visible(o)) return { el: o, tip: lab, back: true }; }
        return { el: e, tip: tipTxt };
    }
    function targetEl() { return resolveTarget().el; }
    // fenêtre ouverte (paramètres, calques, Y, cubatures…) : Momo ne doit pas cacher ses boutons
    function modalCard() {
        const L = [['topo-modal', 1], ['cartouche-modal', 1], ['selparam-modal', 1], ['layer-modal', 0], ['snap-modal', 0], ['help-modal', 1], ['t2-panel', 0]];
        for (const [id, child] of L) { if (!G.shown(id)) continue; const e = document.getElementById(id), c = child ? e.firstElementChild : e; if (c) { const r = c.getBoundingClientRect(); r.side = id === 't2-panel'; return r; } }
        return null;
    }
    function place() {
        if (root.style.display === 'none') return;
        const host = root.parentElement.getBoundingClientRect(), BOT = 118, DL = 10;
        let under = false, left = DL, bottom = BOT, bw = 400, maxH = host.height - BOT - 20;
        const mc = pinned ? null : modalCard();   // épinglée : elle reste à sa place, par-dessus les menus
        if (mc) {
            // une fenêtre est ouverte : la bulle prend la forme de la place libre autour d'elle
            const g = 12, fullB = host.bottom - BOT, top = host.top + 8;
            const raw = [
                { L: host.left + DL, R: mc.left - g, T: top, B: fullB },
                { L: mc.right + g, R: host.right - 8, T: top, B: fullB },
                { L: host.left + DL, R: host.right - 8, T: mc.bottom + g, B: fullB },
                { L: host.left + DL, R: host.right - 8, T: top, B: mc.top - g },
            ].map(z => Object.assign(z, { w: Math.min(440, z.R - z.L - 8), h: z.B - z.T })).filter(z => z.w >= 220 && z.h >= 160);
            raw.sort((a, b) => Math.min(b.h, 560) * Math.min(b.w, 400) - Math.min(a.h, 560) * Math.min(a.w, 400));
            const z = raw[0];
            if (z) { bw = z.w; maxH = z.h; left = z.L - host.left; bottom = host.bottom - z.B; }
            else under = true;   // vraiment pas de place : la bulle passe sous la fenêtre ; survoler Momo la fait revenir dessus
        }
        bubble.style.width = Math.round(bw) + 'px'; bubble.style.maxWidth = 'none';
        bubble.style.maxHeight = Math.max(150, Math.round(maxH)) + 'px';
        bubble.style.left = Math.round(left) + 'px'; bubble.style.bottom = Math.round(bottom) + 'px';
        root.classList.toggle('under', under);
        if (!STEPS) { ring.style.display = 'none'; tip.style.display = 'none'; return; }
        const R = resolveTarget(), t = R.el, s = STEPS[idx];
        if (!t) { ring.style.display = 'none'; tip.style.display = 'none'; return; }
        if (!t.offsetParent) { const pal = t.closest('.pal'); if (pal && pal.dataset.pal && typeof togglePal === 'function' && pal.classList.contains('closed')) togglePal(pal.dataset.pal); }
        const r = t.getBoundingClientRect();
        if (!r.width) { ring.style.display = 'none'; tip.style.display = 'none'; return; }
        const aside = t.closest('aside'); if (aside) { const ar = aside.getBoundingClientRect(); if (r.top < ar.top || r.bottom > ar.bottom) t.scrollIntoView({ block: 'nearest' }); }
        Object.assign(ring.style, { display: 'block', left: (r.left - 4) + 'px', top: (r.top - 4) + 'px', width: (r.width + 8) + 'px', height: (r.height + 8) + 'px' });
        if (R.tip) { tip.innerHTML = R.tip; tip.classList.toggle('back', !!R.back); tip.style.display = 'block'; const th = tip.offsetHeight, tw = tip.offsetWidth; let L = r.right + 14, right = false; if (L + tw > window.innerWidth - 8) { L = Math.max(8, r.left - tw - 14); right = true; } tip.classList.toggle('r', right); tip.style.left = L + 'px'; tip.style.top = Math.max(6, r.top + r.height / 2 - th / 2) + 'px'; }
        else tip.style.display = 'none';
    }
    function setGhost() {
        const items = [];
        (STEPS || []).forEach((st, j) => { if (!st.ghost || j > idx) return; (st.ghost() || []).forEach(it => { it.cur = j === idx; if (typeof it.label === 'function') it.label = it.label(); items.push(it); }); });
        window.tutoGhost = items.length ? { items, pts: [].concat(...items.filter(it => it.cur).map(it => it.snap || [])) } : null;
        try { invalidateCache(); draw(); } catch (e) {}
    }
    // ---------- jalons : chaque ligne de « À toi » se coche au fur et à mesure ----------
    let jal = null;   // { rules:[…], ok:[…], clicks, typed, tool, m0, sel0 }
    const jalTxt = (li) => (li.textContent || '').replace(/\s+/g, ' ').trim();
    function jalRules(items) {
        let need = 0, acted = false;
        const NB = { deux: 2, trois: 3, quatre: 4 };
        return items.map(t => {
            const T = t.toLowerCase(), nbm = T.match(/\b(\d|deux|trois|quatre) (points|coins|pans)\b/), nb = nbm ? (NB[nbm[1]] || +nbm[1]) : 0;
            const early = !acted;
            if (/^Clique [A-ZÉ]/.test(t)) return { k: 'end' };                                          // un bouton (Joindre, Éclater…)
            if (/appliquer|valider|créer le toit|, puis poser/.test(T)) return { k: 'end' };            // la ligne qui conclut
            if (/sélectionne|toujours en rose/.test(T) && !/fenêtre jaune/.test(T)) { if (early) return { k: 'sel' }; return { k: 'end' }; }
            const clicks = /clic|clique/.test(T) && /(point|coin|centre|côté du|bord|bout|fenêtre jaune|la dalle|le regard|le couvercle|la rampe|la polyligne|la ligne|le rectangle|le soulignement|l'emprise|la pièce|le mur|un mur|pans|sous le|à l'intérieur)/.test(T)
                ? (nb || Math.max(1, (T.match(/clique|clic\b|puis (celui|le|la|du)\b/g) || []).length)) : 0;
            if (clicks) { need += clicks; acted = true; return { k: 'clk', n: need }; }
            if (/\btape\b/.test(T)) { acted = true; return { k: 'typ' }; }
            if (early && /^(prends|ouvre|outil|catalogue de blocs|allume|déplie|rouvre|y sur|chapitre|sur un calque|échap)/.test(T)) return { k: 'tool' };
            return { k: 'end' };
        });
    }
    function jalInit() {
        jal = { rules: null, ok: [], clicks: 0, typed: false, tool: false, m0: G.mode(), sel: false, modal: false };
    }
    function jalTick() {
        const lis = bubble ? [...bubble.querySelectorAll('.mt-do ol > li')] : []; if (!lis.length || !jal) return;
        if (!jal.rules) jal.rules = jalRules(lis.map(jalTxt));
        const m = G.mode();
        if (m && m !== jal.m0 && m !== 'select-box') jal.tool = true;
        const tg = targetEl(); if (tg && tg.classList && tg.classList.contains('active')) jal.tool = true;
        if (['topo-modal', 'selparam-modal', 'layer-modal', 'cartouche-modal', 't2-panel'].some(id => G.shown(id)) || G.is3D()) { jal.tool = true; jal.modal = true; }
        if (G.sel().length) jal.sel = true;
        try { if (typedInput && String(typedInput).length) jal.typed = true; } catch (e) {}
        const fin = !!done[idx], st = STEPS[idx];
        if (st && !st.jal && lis.length === 1) { lis[0].classList.toggle('ck', fin); return; }   // une seule action : cochée quand l'étape est réussie
        if (st && st.jal) {   // contrôle en direct : coché si valide ET toutes les lignes d'avant valides
            // une ligne est validée par son propre contrôle, ou par une ligne suivante validée (le geste d'avant est forcément fait)
            const own = lis.map((li, i) => { if (fin) return true; if (i >= st.jal.length) return false; try { return !!st.jal[i](jal); } catch (e) { return false; } });
            let after = false; for (let i = own.length - 1; i >= 0; i--) { after = after || own[i]; jal.ok[i] = after; }
            lis.forEach((li, i) => li.classList.toggle('ck', !!jal.ok[i]));
            return;
        }
        const raw = jal.rules.map((r, i) => fin || (r.k === 'tool' && jal.tool) || (r.k === 'sel' && jal.sel) || (r.k === 'clk' && jal.clicks >= r.n) || (r.k === 'typ' && jal.typed) );
        // une ligne cochée coche aussi celles d'avant (on avance dans l'ordre)
        let any = false; for (let i = raw.length - 1; i >= 0; i--) { if (raw[i]) any = true; if (any) jal.ok[i] = true; }
        lis.forEach((li, i) => li.classList.toggle('ck', !!jal.ok[i]));
    }
    function jalClick(e) { if (jal && e.button === 0) jal.clicks++; }
    function go(i) {
        idx = Math.max(0, Math.min(i, STEPS.length - 1)); ctx = {}; jalInit();
        const s = STEPS[idx]; if (s.init) s.init(ctx);
        setGhost(); render();
    }
    function tick() {
        if (!root || !root.isConnected) return disable();
        place();
        if (!STEPS) return;
        const s = STEPS[idx];
        const v3 = G.is3D(); if (v3 !== last3D) { last3D = v3; render(); }
        if (s.tick) s.tick(ctx);
        jalTick();
        // étape de dessin : si le résultat est défait (annuler, effacé…), elle se décoche
        if (s.wait && done[idx] && s.ghost) { let ok = true; try { ok = s.wait(ctx); } catch (e) {} if (!ok) { done[idx] = false; render(); } }
        if (s.wait && !done[idx]) {
            let ok = false; try { ok = s.wait(ctx); } catch (e) {}
            if (ok) { done[idx] = true; render(); jump(); if (!cele[idx]) { cele[idx] = true; confetti(); } }   // l'étape se coche ; on avance quand on veut, avec ▶
        }
    }
    function ensure() {
        if (root && root.isConnected) return;
        build(); STEPS = null; view = 'home'; render();
        try { canvas.addEventListener('mousedown', jalClick, true); } catch (e) {}
        clearInterval(timer); timer = setInterval(tick, 250);
        window.addEventListener('resize', place);
    }
    // activer Momo (depuis le guide) : il attend derrière la barre de commande, prêt à proposer un tuto
    function enable(open) { ensure(); if (open) setOpen(true); }
    function start(id) {
        ensure(); setVisible(true); try { if (typeof momoUseTuto === 'function') momoUseTuto(); } catch (e) {}
        const T = TUTOS.find(t => t.id === id) || TUTOS[0]; applyVoice(T.id, T.steps); STEPS = T.steps; done = []; cele = []; if (T.setup) T.setup();
        go(0); setOpen(true);
    }
    // fin du tuto (ou « changer de tuto ») : Momo reste là et repropose le menu
    function toMenu() {
        STEPS = null; done = []; window.tutoGhost = null; try { draw(); } catch (e) {}
        if (ring) ring.style.display = 'none'; if (tip) tip.style.display = 'none';
        if (root) { render(); setOpen(true); }
    }
    function stop() { menuMsg = ''; if (root && root.isConnected) toMenu(); }
    // désactiver Momo (depuis le guide) : il disparaît complètement
    function disable() {
        clearInterval(timer); timer = null; STEPS = null;
        [root, ring, tip].forEach(e => e && e.remove()); root = null;
        window.tutoGhost = null; try { draw(); } catch (e) {}
        try { canvas.removeEventListener('mousedown', jalClick, true); } catch (e) {}
        window.removeEventListener('resize', place);
    }
    function setVisible(v) { if (root) { root.style.display = v ? '' : 'none'; if (!v) { ring.style.display = 'none'; tip.style.display = 'none'; } } }
    function home() { ensure(); setVisible(true); if (!STEPS) { view = 'home'; menuMsg = ''; render(); } setOpen(true); }
    window.MomoTuto = { version: 3, start, stop, enable, disable, setVisible, home, hello, enabled: () => !!(root && root.isConnected), list: TUTOS, rules: jalRules, open: () => setOpen(true), collapse: () => setOpen(false), current: () => (root && root.isConnected && STEPS) ? { title: (TUTOS.find(t => t.steps === STEPS) || {}).title, step: idx + 1, n: STEPS.length } : null };
})();
