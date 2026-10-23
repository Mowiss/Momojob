// Aller-retour des fichiers : un plan riche est enregistré puis rouvert en .mmc, puis en DXF ; rien ne doit se perdre.
module.exports = { name: 'fichiers', timeout: 240, run: async (H, t) => {
    const { p, ev } = H;
    await H.blank(14);
    // --- un plan qui contient un peu de tout ---
    await ev(() => {
        const m = mmToWorld(1000), P = (x, y, z) => Object.assign({ x: x * m, y: -y * m }, z !== undefined ? { z } : {});
        const L = ensureLayer('EU', '#b91c1c'); const lay = layers.find(l => l.id === L); Object.assign(lay, { dash: 'text', ltText: 'EU Ø160', width: 2, hatch: 'cross', textH: 2.5 });
        shapes.push({ type: 'line', layerId: L, x1: 0, y1: 0, x2: 10 * m, y2: 0, z1: 101250, z2: 100900 });
        shapes.push({ type: 'poly', layerId: 'layer-0', open: true, points: [P(0, 3, 100000), P(5, 3, 100100), P(5, 6, 100200)] });
        shapes.push({ type: 'poly', layerId: 'layer-0', open: false, points: [P(20, 0), P(26, 0), P(26, 4), P(20, 4)] });
        shapes.push({ type: 'circle', layerId: 'layer-0', x: 30 * m, y: -10 * m, r: 2 * m });
        shapes.push({ type: 'arc', layerId: 'layer-0', x: 40 * m, y: 0, r: 3 * m, startAngle: -Math.PI / 2, endAngle: 0 });
        shapes.push({ type: 'text', layerId: 'layer-0', x: 0, y: -12 * m, content: 'Regard EP n°3', size: 20 });
        shapes.push(makeDim(P(0, 0), P(10, 0), P(5, -2), 'h'));
        shapes.push(makeDim(P(26, 0), P(26, 4), P(28, 2), 'v'));
        shapes.push(makeDim(P(20, 0), P(26, 4), P(22, 4), null));
        shapes.push({ type: 'dim-angle', layerId: DIM_LAYER_ID, vertex: P(50, 0), p1: P(55, 0), p2: P(50, 5) });
        const TN = ensureLayer('Terrain naturel', '#bef264');
        for (let i = 0; i < 4; i++) shapes.push({ type: 'point', layerId: TN, x: (60 + i * 5) * m, y: -20 * m, z: 100000 + i * 250, zk: 1, mat: 'TN' + (i + 1), code: i % 2 ? 'BORD' : 'TN' });
        shapes.push({ type: 'poly', layerId: 'layer-0', points: [[15, 12], [35, 12], [35, 28], [15, 28]].map(([x, y]) => P(x, y, 98000)), zk: 1,
            talus: { R: 1200, cx: true, edges: [{ off: true, pl: 'Mur de soutènement' }, { name: 'Côté route', kD: '2/1', R: 3000, zf: 99500 }, null, { kR: '3/1' }] }, cubRP: { on: true, z: 99000 } });
        trenchDraw = trClone(trCur); const tr = trCreate([P(2, 18), P(12, 18)]); trenchDraw = null; tr.points[1].reg = true; tr.points[1].regD = 1200; tr.points[1].tM = 100500;
        shapes.push({ type: 'poly', layerId: 'layer-0', points: [[40, 30], [48, 30], [48, 38], [40, 38]].map(([x, y]) => P(x, y)), open: false, water: { z: 99300, name: 'Étang' }, zk: 1 });
        startStamp('arbre'); currentX = 60 * m; currentY = -5 * m; placeStamp(); setMode('select-box');
        dimStyleSet({ term: 'arrow', line: 'dashed', txtPos: 'above', txtBg: 'pill', extMode: 'fix', extLen: 9 }); dimTextAligned = true;
        saveState(); invalidateCache(); draw();
    });
    // hachure posée à la souris dans le rectangle
    await H.tool('btn-hatch'); await H.click(await H.W(23, 2)); await H.press('Escape'); await ev(() => setMode('select-box'));
    t.ok('hachure créée dans le rectangle', await ev(() => shapes.some(s => s.type === 'hatch')));
    await H.tool('btn-dim-rad'); await H.click(await H.W(32, 10)); await H.click(await H.W(34, 12)); await H.press('Escape'); await ev(() => setMode('select-box'));
    t.ok('cote de rayon posée', await ev(() => shapes.some(s => s.type === 'dimr')));

    // empreinte de chaque objet : type, calque, géométrie au mm, altitudes et réglages métier
    await ev(() => { window.__sig = (opts) => { const mm = v => Math.round(worldToMm(v)), lay = id => (layers.find(l => l.id === id) || {}).name || id;
        const pts = s => (s.points || []).map(q => [mm(q.x), mm(q.y), q.z !== undefined && q.z !== null ? Math.round(q.z) : null]);
        const one = s => { const b = { type: s.type, layer: lay(s.layerId) };
            if (s.type === 'line') Object.assign(b, { g: [mm(s.x1), mm(s.y1), mm(s.x2), mm(s.y2)], z: [s.z1 ?? null, s.z2 ?? null].map(v => v === null ? null : Math.round(v)) });
            else if (s.type === 'poly') Object.assign(b, { g: pts(s), open: !!s.open, talus: s.talus ? JSON.stringify(platTalus(s).edges.map(e => e && [e.kR, e.kD, e.R, e.zf, !!e.off, e.name || '', e.pl || ''])) + '|R' + platTalus(s).R + '|cx' + !!platTalus(s).cx : null,
                cubRP: s.cubRP ? [!!s.cubRP.on, s.cubRP.z] : null, trench: s.trench ? s.trench.name + '|' + s.points.map(q => [q.reg ? 1 : 0, q.regD ?? '', q.tM ?? ''].join(':')).join(',') : null, water: s.water ? [s.water.z, s.water.name || ''] : null });
            else if (s.type === 'circle' || s.type === 'arc') Object.assign(b, { g: [mm(s.x), mm(s.y), mm(s.r)], a: s.type === 'arc' ? [s.startAngle, s.endAngle].map(a => +(((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).toFixed(3)) : null });
            else if (s.type === 'text') Object.assign(b, { g: [mm(s.x), mm(s.y)], c: s.content });
            else if (s.type === 'dim') { const g = dimGeom(s); Object.assign(b, { d: mm(g.dist), o: s.orient || '' }); }
            else if (s.type === 'dimr') Object.assign(b, { g: [s.x, s.y, s.ax, s.ay, s.lx, s.ly].map(mm), dia: !!s.dia });
            else if (s.type === 'dim-angle') Object.assign(b, { g: [s.vertex, s.p1, s.p2].map(q => [mm(q.x), mm(q.y)]) });
            else if (s.type === 'point') Object.assign(b, { g: [mm(s.x), mm(s.y), Math.round(s.z)], mat: s.mat || '', code: s.code || '' });
            else if (s.type === 'hatch') Object.assign(b, { n: s.loops.length });
            if (opts && opts.block && s.block) b.block = s.block;
            return JSON.stringify(b); };
        return shapes.filter(s => !isBg(s)).map(one).sort(); }; });
    const before = await ev(() => __sig({ block: true }));
    const layBefore = await ev(() => { const l = layers.find(x => x.name === 'EU'); return [l.dash, l.ltText, l.width, l.hatch, String(l.textH)]; });
    const diff = (a, b) => { const A = new Map(), B = new Map(); a.forEach(x => A.set(x, (A.get(x) || 0) + 1)); b.forEach(x => B.set(x, (B.get(x) || 0) + 1));
        const lost = [...A].filter(([k, n]) => (B.get(k) || 0) < n).map(([k]) => k), extra = [...B].filter(([k, n]) => (A.get(k) || 0) < n).map(([k]) => k); return { lost, extra }; };

    // --- .mmc ---
    const mmc = await ev(() => JSON.stringify(projectData()));
    await H.blank(14);
    await ev((txt) => { loadProjectText(txt, 'essai.mmc'); }, mmc); await H.wait(300);
    { const after = await ev(() => __sig({ block: true })), d = diff(before, after);
      t.ok('.mmc : ' + before.length + ' objets identiques après réouverture', !d.lost.length && !d.extra.length, 'perdus ' + d.lost.slice(0, 3).join(' ; ') + ' | en trop ' + d.extra.slice(0, 3).join(' ; ')); }
    t.eq('.mmc : style du calque EU conservé', await ev(() => { const l = layers.find(x => x.name === 'EU'); return l && [l.dash, l.ltText, l.width, l.hatch, String(l.textH)]; }), layBefore);
    t.eq('.mmc : style des cotes conservé', await ev(() => [dimStyle.term, dimStyle.line, dimStyle.txtPos, dimStyle.txtBg, dimStyle.extMode, dimStyle.extLen, dimTextAligned]), ['arrow', 'dashed', 'above', 'pill', 'fix', 9, true]);

    // --- DXF ---
    const dxf = await ev(() => exportDXF());
    t.ok('DXF exporté sans erreur', typeof dxf === 'string' && dxf.length > 1000 && /EOF\s*$/.test(dxf));
    await ev(() => { shapes = []; dimStyleSet({}); }); await H.blank(14);
    const ok = await ev(async (txt) => loadFileObject(new File([txt], 'essai.dxf'), 'essai.dxf'), dxf); await H.wait(300);
    t.ok('DXF rouvert comme un plan', ok === true);
    { // le DXF éclate les blocs en traits : on compare sans l'étiquette de bloc
      const b2 = await ev(() => __sig()), bNoBlock = before.map(x => { const o = JSON.parse(x); delete o.block; return JSON.stringify(o); }).sort(), d = diff(bNoBlock, b2);
      t.ok('DXF : ' + before.length + ' objets retrouvés à l\'identique (géométrie au mm, altitudes, réglages métier)', !d.lost.length && !d.extra.length,
          d.lost.length + ' perdus, ' + d.extra.length + ' en trop — perdus : ' + d.lost.join(' ; ') + ' | en trop : ' + d.extra.join(' ; ')); }
    t.eq('DXF : style du calque EU conservé', await ev(() => { const l = layers.find(x => x.name === 'EU'); return l && [l.dash, l.ltText, l.width, l.hatch, String(l.textH)]; }), layBefore);
} };
