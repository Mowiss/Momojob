// Outils d'édition, à la souris et au clavier : chaque test part d'objets posés en mètres.
module.exports = { name: 'edition', run: async (H, t) => {
    const { p, ev } = H;
    await H.blank(14);
    // pose d'objets (mètres, Y vers le haut) ; renvoie leur index
    const mk = (o) => ev(o => { const W = v => mmToWorld(v * 1000), s = Object.assign({ layerId: activeLayerId }, o);
        if (s.type === 'line') Object.assign(s, { x1: W(o.x1), y1: -W(o.y1), x2: W(o.x2), y2: -W(o.y2) });
        if (s.type === 'poly') s.points = o.pts.map(([x, y]) => ({ x: W(x), y: -W(y) }));
        if (s.type === 'circle') Object.assign(s, { x: W(o.x), y: -W(o.y), r: W(o.r) });
        delete s.pts; shapes.push(s); saveState(); draw(); return shapes.length - 1; }, o);
    const M = (i) => ev(i => { const s = shapes.at(i), m = v => +(worldToMm(v) / 1000).toFixed(4); if (!s) return null;
        if (s.type === 'line') return [m(s.x1), -m(s.y1), m(s.x2), -m(s.y2)];
        if (s.type === 'poly') return s.points.map(q => [m(q.x), -m(q.y)]);
        if (s.type === 'circle' || s.type === 'arc') return [m(s.x), -m(s.y), m(s.r)];
        return s.type; }, i);
    const N = () => ev(() => shapes.length);
    const reset = async () => { await H.press('Escape'); await H.press('Escape'); await ev(() => { setMode('select-box'); selectedShapes = []; draw(); }); };
    const pick = async (x, y) => { await ev(() => setMode('select-box')); await H.click(await H.W(x, y)); };
    const near = (a, b, tol) => JSON.stringify(a) && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= (tol || 1e-3));

    // déplacer : point de base + destination
    let i = await mk({ type: 'line', x1: 0, y1: 0, x2: 4, y2: 0 });
    await pick(2, 0); await H.tool('btn-move'); await H.click(await H.W(0, 0)); await H.click(await H.W(1, 1)); await reset();
    t.ok('déplacer par deux clics', near(await M(i), [1, 1, 5, 1]), JSON.stringify(await M(i)));
    // déplacer : ΔX Espace ΔY Espace
    await pick(3, 1); await H.tool('btn-move'); await H.key('2 3 '); await reset();
    t.ok('déplacer de ΔX 2, ΔY 3 tapés', near(await M(i), [3, 4, 7, 4]), JSON.stringify(await M(i)));

    // copier : l'original reste
    let n = await N(); await pick(5, 4); await H.tool('btn-copy'); await H.click(await H.W(3, 4)); await H.click(await H.W(3, 6)); await H.press('Space'); await reset();
    t.ok('copier : une copie de plus, original en place', (await N()) === n + 1 && near(await M(i), [3, 4, 7, 4]) && near(await M(-1), [3, 6, 7, 6]), JSON.stringify(await M(-1)));

    // rotation de 90° autour d'un coin
    i = await mk({ type: 'poly', pts: [[10, 0], [14, 0], [14, 2], [10, 2]] });
    await pick(12, 0); await H.tool('btn-rotate'); await H.click(await H.W(10, 0)); await H.key('90 '); await reset();
    const r = await M(i); t.ok('rotation de 90° autour du coin', r && r.some(q => near(q, [10, 4])) && r.some(q => near(q, [8, 0])), JSON.stringify(r));

    // miroir : axe vertical, Espace garde l'original
    n = await N(); i = await mk({ type: 'line', x1: 20, y1: 0, x2: 22, y2: 2 });
    await pick(21, 1); await H.tool('btn-mirror'); await H.click(await H.W(24, 0)); await H.click(await H.W(24, 5)); await H.press('Space'); await reset();
    t.ok('copie miroir d\'axe vertical', (await N()) === n + 2 && near(await M(-1), [28, 0, 26, 2]), JSON.stringify(await M(-1)));

    // décaler une droite de 1 m vers le haut
    n = await N(); i = await mk({ type: 'line', x1: 0, y1: 10, x2: 6, y2: 10 });
    await ev(() => setMode('select-box')); await H.tool('btn-offset'); await H.key('1 '); await H.click(await H.W(3, 10)); await H.click(await H.W(3, 12)); await reset();
    t.ok('décaler de 1 m', (await N()) === n + 2 && near(await M(-1), [0, 11, 6, 11]), JSON.stringify(await M(-1)));
    // décaler une polyligne (rectangle) vers l'extérieur
    n = await N(); i = await mk({ type: 'poly', pts: [[30, 0], [34, 0], [34, 3], [30, 3]] });
    await H.tool('btn-offset'); await H.key('0.5 '); await H.click(await H.W(32, 0)); await H.click(await H.W(32, -2)); await reset();
    { const q = await M(-1); t.ok('décaler un rectangle de 0,5 m vers l\'extérieur', (await N()) === n + 2 && Array.isArray(q) && q.some(z => near(z, [29.5, -0.5])) && q.some(z => near(z, [34.5, 3.5])), JSON.stringify(q)); }

    // ajuster : on coupe le bout droit d'une droite au ras d'une autre
    const h = await mk({ type: 'line', x1: 0, y1: 20, x2: 10, y2: 20 }); await mk({ type: 'line', x1: 5, y1: 18, x2: 5, y2: 22 });
    await ev(() => setMode('select-box')); await H.tool('btn-trim'); await H.click(await H.W(8, 20)); await reset();
    { const all = await ev(() => shapes.filter(s => s.type === 'line').map(s => [s.x1, s.y1, s.x2, s.y2].map((v, k) => +((k % 2 ? -1 : 1) * worldToMm(v) / 1000).toFixed(3))));
      t.ok('ajuster au ras de la droite qui croise', all.some(q => near(q, [0, 20, 5, 20]) || near(q, [5, 20, 0, 20])) && !all.some(q => near(q, [0, 20, 10, 20])), JSON.stringify(all.filter(q => q[1] === 20 || q[3] === 20))); }

    // prolonger jusqu'à une limite
    i = await mk({ type: 'line', x1: 0, y1: 30, x2: 3, y2: 30 }); await mk({ type: 'line', x1: 6, y1: 28, x2: 6, y2: 32 });
    await H.tool('btn-extend'); await H.click(await H.W(2.8, 30)); await reset();
    { const all = await ev(() => shapes.filter(s => s.type === 'line').map(s => [s.x1, s.y1, s.x2, s.y2].map((v, k) => +((k % 2 ? -1 : 1) * worldToMm(v) / 1000).toFixed(3))));
      t.ok('prolonger jusqu\'à la limite', all.some(q => near(q, [0, 30, 6, 30])), JSON.stringify(all.filter(q => q[1] === 30))); }

    // agrandir : facteur tapé puis point de base
    i = await mk({ type: 'circle', x: 40, y: 10, r: 1 });
    await pick(41, 10); await H.tool('btn-scale-up'); await H.key('2 '); await H.click(await H.W(40, 10)); await reset();
    { const c = await M(i); t.ok('agrandir ×2 autour du centre', c && near(c, [40, 10, 2]), JSON.stringify(c)); }

    // arrondir deux droites en angle, rayon 1 m
    n = await N(); await mk({ type: 'line', x1: 0, y1: 40, x2: 5, y2: 40 }); await mk({ type: 'line', x1: 5, y1: 40, x2: 5, y2: 45 });
    await H.tool('btn-fillet'); await H.click(await H.W(2, 40)); await H.click(await H.W(5, 43)); await H.key('1 '); await reset();
    { const arcs = await ev(() => shapes.filter(s => s.type === 'arc').map(s => +(worldToMm(s.r) / 1000).toFixed(3)));
      t.ok('arrondi de rayon 1 m', arcs.includes(1), JSON.stringify(arcs)); }

    // joindre deux polylignes bout à bout
    await mk({ type: 'poly', open: true, pts: [[50, 0], [52, 0]] }); await mk({ type: 'poly', open: true, pts: [[52, 0], [52, 2]] });
    n = await N(); await ev(() => { selectedShapes = shapes.slice(-2); draw(); }); await H.tool('btn-join'); await reset();
    { const q = await M(-1); t.ok('joindre deux polylignes', (await N()) === n - 1 && Array.isArray(q) && q.length === 3, JSON.stringify(q)); }

    // réseau en grille : 3 colonnes × 2 lignes, écarts 3 et 2 m
    await mk({ type: 'circle', x: 60, y: 0, r: 0.5 }); n = await N();
    await pick(60.5, 0); await H.tool('btn-array'); await H.wait(300);
    await ev(() => { const v = { 'ar-nx': '3', 'ar-ny': '2', 'ar-dx': '3', 'ar-dy': '2' }; for (const k in v) { const e = document.getElementById(k); e.value = v[k]; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } t2ArrRead(); });
    await ev(() => [...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent.trim() === 'Créer').click()); await reset();
    { const c = await ev(() => shapes.filter(s => s.type === 'circle').map(s => [+(worldToMm(s.x) / 1000).toFixed(2), +(-worldToMm(s.y) / 1000).toFixed(2)]).filter(q => q[0] >= 59));
      t.ok('réseau 3 × 2 : 5 copies aux bons écarts', (await N()) === n + 5 && c.some(q => near(q, [66, 2])) && c.some(q => near(q, [63, 0])), JSON.stringify(c)); }

    // diviser une droite de 10 m en 4 parts égales, repères aux deux bouts
    await mk({ type: 'line', x1: 0, y1: -5, x2: 10, y2: -5 }); n = await ev(() => shapes.filter(s => s.type === 'point').length);
    await H.tool('btn-divide'); await H.click(await H.W(5, -5)); await H.wait(300);
    await ev(() => { t2.div.mode = 'n'; t2DivPanel(); }); await H.wait(100);
    await ev(() => { const e = document.getElementById('dv-n'); e.value = '4'; e.dispatchEvent(new Event('input', { bubbles: true })); const en = document.getElementById('dv-end'); en.checked = true; t2DivRead(); t2DivApply(); }); await reset();
    { const pts = await ev(() => shapes.filter(s => s.type === 'point').map(s => +(worldToMm(s.x) / 1000).toFixed(2)).sort((a, b) => a - b));
      t.ok('diviser en 4 : 5 repères tous les 2,50 m', pts.length === n + 5 && [0, 2.5, 5, 7.5, 10].every(x => pts.includes(x)), JSON.stringify(pts)); }

    // couper au point : une droite devient deux
    n = await N(); await mk({ type: 'line', x1: 70, y1: 10, x2: 78, y2: 10 });
    await H.tool('btn-break'); await H.click(await H.W(73, 10)); await reset();
    { const all = await ev(() => shapes.filter(s => s.type === 'line').map(s => [s.x1, s.y1, s.x2, s.y2].map((v, k) => +((k % 2 ? -1 : 1) * worldToMm(v) / 1000).toFixed(2))).filter(q => q[0] >= 70 && q[1] === 10 && q[3] === 10));
      t.ok('couper au point : deux morceaux de 3 et 5 m', all.length === 2 && all.map(q => Math.abs(q[2] - q[0])).sort().join() === '3,5', JSON.stringify(all)); }

    // chanfrein de 1 m entre deux droites en angle
    n = await N(); await mk({ type: 'line', x1: 70, y1: 20, x2: 75, y2: 20 }); await mk({ type: 'line', x1: 75, y1: 20, x2: 75, y2: 25 });
    await H.tool('btn-chamfer'); await H.click(await H.W(72, 20)); await H.click(await H.W(75, 23)); await H.key('1 '); await reset();
    { const all = await ev(() => shapes.filter(s => s.type === 'line').map(s => [s.x1, s.y1, s.x2, s.y2].map((v, k) => +((k % 2 ? -1 : 1) * worldToMm(v) / 1000).toFixed(2))));
      t.ok('chanfrein : pan coupé de 1 m sur chaque droite', all.some(q => (near(q, [74, 20, 75, 21], 0.01) || near(q, [75, 21, 74, 20], 0.01))), JSON.stringify(all.filter(q => q[0] >= 70 && q[1] >= 20))); }

    // sélection par fenêtre : vers la droite (rose) = objets entièrement dedans ; vers la gauche (verte) = tout ce qu'elle touche
    await ev(() => { shapes = []; selectedShapes = []; saveState(); draw(); });
    await mk({ type: 'line', x1: 2, y1: 22, x2: 12, y2: 22 }); await mk({ type: 'circle', x: 6, y: 26, r: 1 }); await mk({ type: 'poly', pts: [[20, 20], [30, 20], [30, 28], [20, 28]] });
    const win = async (a, b) => { await ev(() => { setMode('select-box'); selectedShapes = []; draw(); }); const A = await H.W(...a), B = await H.W(...b);
        await H.click(A); await p.mouse.move((A.x + B.x) / 2, (A.y + B.y) / 2, { steps: 4 }); await H.click(B); await H.wait(150);
        return ev(() => selectedShapes.map(s => s.type).sort().join(',')); };
    t.eq('fenêtre vers la droite : seul le cercle entièrement dedans', await win([4, 24], [9, 29]), 'circle');
    t.eq('capture vers la gauche : le cercle, la droite qu\'elle touche et le rectangle qu\'elle traverse', await win([24, 29], [4, 21]), 'circle,line,poly');
    await reset();

    // supprimer la sélection
    await mk({ type: 'poly', open: true, pts: [[50, 0], [52, 0]] }); n = await N(); await pick(51, 0); await H.press('Delete'); await reset();
    t.ok('Suppr efface l\'objet sélectionné', (await N()) === n - 1);
} };
