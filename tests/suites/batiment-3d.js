// Bâtiment en 3D (cabane du tuto Seigneur) : menuiseries, pas de traits de plan parasites, façades rendues, rendu naturel et ciel.
const fs = require('fs'), path = require('path');
module.exports = { name: 'batiment-3d', run: async (H, t) => {
    const { p, ev } = H;
    await ev(txt => { loadProjectText(txt, 'cabane.mmc'); }, fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'cabane.mmc'), 'utf8')); await H.wait(400);
    await ev(async () => { await open3D(); }); await H.wait(2000);
    const r = await ev(() => { let wood = 0, glass = 0, segs = 0; V3.root.traverse(o => { if (o.isMesh && o.geometry && o.geometry.type === 'BoxGeometry') { const m = o.material; if (m.map) wood++; else if (m.transparent && m.opacity < 0.5) glass++; } if (o.isLineSegments && o.material && o.material.vertexColors) segs += o.geometry.attributes.position.count / 2; });
        return { wood, glass, segs }; });
    t.ok('porte : un vantail bois', r.wood >= 1, JSON.stringify(r));
    t.ok('fenêtre : un vitrage', r.glass >= 1, JSON.stringify(r));
    t.ok('aucun tracé de plan dessiné par-dessus les volumes (toit, murs)', r.segs === 0, JSON.stringify(r));
    // rendu naturel et ciel
    await ev(() => { document.querySelector('[data-for="v3-nat"]').click(); document.querySelector('[data-for="v3-hz"]').click(); }); await H.wait(800);
    t.ok('ciel et paysage affichés avec le bouton Paysage', await ev(() => !!(V3.sky && V3.sky.visible)));
    const sun = await ev(() => { v3SetHour(9); const a = V3.sun.position.clone(); v3SetHour(18); const b = V3.sun.position.clone(); return [a.x, b.x]; });
    t.ok('le soleil suit l\'heure (matin à l\'est, soir à l\'ouest)', sun[0] > 0 && sun[1] < 0, JSON.stringify(sun));
    const hz1 = await ev(() => V3.hz && V3.hz.visible && V3.hz.userData.seed); await ev(() => v3NewHorizon()); await H.wait(200);
    t.ok('horizon affiché, et un nouveau à la demande', hz1 && await ev((a) => V3.hz.userData.seed !== a, hz1), hz1);
    const kinds = await ev(() => ['montagne', 'ville', 'plaine', 'village'].map(k => { v3HzType(k); return V3.hz.userData.key.split(':')[0] + (V3.hz.userData.lights ? '+nuit' : ''); }));
    t.eq('horizon : quatre paysages (la ville et le village s\'éclairent la nuit)', kinds, ['montagne', 'ville+nuit', 'plaine', 'village+nuit']);
    const pano = await ev(async () => { const c = document.createElement('canvas'); c.width = 512; c.height = 256; c.getContext('2d').fillRect(0, 0, 512, 256); const b = await new Promise(r => c.toBlob(r));
        const ok = await v3PanoFromBlob(b, false); v3HzType('photo'); const r = [ok, V3.pano.visible, V3.hz.visible, V3.gnd.visible]; v3HzType('montagne'); return r; });
    t.eq('photo 360° : remplace ciel et horizon', pano, [true, true, false, false]);
    const cyl = await ev(async () => { const c = document.createElement('canvas'); c.width = 1300; c.height = 200; c.getContext('2d').fillRect(0, 0, 1300, 200); const b = await new Promise(r => c.toBlob(r));
        await v3PanoFromBlob(b, false); v3HzType('photo'); const r = [V3.pano.visible, V3.panoC.visible]; v3HzType('montagne'); return r; });
    t.eq('panorama de téléphone (très allongé) : posé sur un cylindre, pas étiré sur une bulle', cyl, [false, true]);
    await ev(() => { document.querySelector('[data-for="v3-hz"]').click(); }); await H.wait(300);
    t.ok('ciel et horizon masqués', await ev(() => !V3.sky.visible && !V3.hz.visible));
    await ev(() => { document.querySelector('[data-for="v3-nat"]').click(); close3D(); });
    // façade : la vue de côté est rendue par le moteur 3D
    await ev(() => setView2D(0, 0)); await H.wait(1500); await p.waitForFunction(() => !view2dAnim, null, { timeout: 15000 }); await H.wait(300);
    const f = await ev(() => { const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; const x = c.getContext('2d'); const ok = ortho3D(x, 0, 0, mmToWorld(1) * camera.zoom);
        const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++; return { ok, n }; });
    t.ok('vue de façade dessinée (murs, toit, menuiseries)', f.ok && f.n > 600, JSON.stringify(f));
    await H.shot('batiment-facade');
    // en plan, les façades sont en couleurs unies : les textures sont réservées au rendu 3D
    const nt = await ev(() => { let n = 0; V3.root.traverse(o => [].concat(o.material || []).forEach(m => { if (m.map || (o.isMesh && m.colorWrite !== false)) n++; })); return n; });
    t.eq('façade en plan : filaire seul, ni couleur ni texture', nt, 0);
    const nt2 = await ev(async () => { open3D(); await new Promise(r => setTimeout(r, 800)); let n = 0; V3.root.traverse(o => [].concat(o.material || []).forEach(m => { if (m.map) n++; })); close3D(); return n; });
    t.ok('rendu 3D : les textures reviennent', nt2 > 0, nt2);
    await ev(() => setView2D(0, 90));

    // aller-retour DXF : murs (matériau, hauteurs, ouvertures, groupe), toiture et pignons reviennent comme des objets MomoCAD
    const sig = () => ev(() => shapes.map(s => s.type + (s.wallMat ? ':w' : '') + (s.solid ? ':' + s.solid.kind : '') + (s.wz ? ':wz' : '') + (s.openings ? ':o' + s.openings.length : '') + (s.groupId ? ':g' : '') + (s.roofDef ? ':rd' : '') + (s.type === 'mesh' && meshStore[s.meshId] ? ':m' + meshStore[s.meshId].length : '')).join(' '));
    const s0 = await sig(), dxf = await ev(() => exportDXF());
    await ev(async t => loadFileObject(new File([t], 'cabane.dxf'), 'cabane.dxf'), dxf); await H.wait(500);
    t.eq('DXF : bâtiment rouvert à l\'identique (murs, ouvertures, toiture, pignons)', await sig(), s0);
    const op = await ev(() => { const o = shapes.flatMap(s => s.openings || [])[0]; return o ? [Math.round(o.a.x), Math.round(o.a.y)] : null; });
    t.ok('DXF : ouverture à sa place', op && isFinite(op[0]), JSON.stringify(op));

    // volets : battants (2 vantaux contre la façade) ou bloc volet roulant (coulisses + tablier), choisis dans la fenêtre de l'ouverture
    const vol = await ev(async () => { const ops = shapes.flatMap(s => (s.openings || []).map(o => [s, o])), [h, o] = ops.find(x => x[1].kind !== 'porte'); openingDialog(h, o, false);
        document.querySelector('input[name=op-vt][value=battant]').click(); [...document.querySelectorAll('#tm-actions button')].find(b => b.textContent === 'Valider').click();
        const d = ops.find(x => x[1].kind === 'porte'); if (d) d[1].shut = { type: 'roulant', side: 1 };
        await open3D(); await new Promise(r => setTimeout(r, 900)); const n = {}; V3.root.traverse(m => { if (m.userData.shutter) n[m.userData.shutter] = (n[m.userData.shutter] || 0) + 1; }); close3D(); return { shut: o.shut, n }; });
    t.ok('volets : battants et volet roulant posés sur les ouvertures en 3D', vol.shut && vol.shut.type === 'battant' && vol.n.battant === 2 && vol.n.roulant === 4, JSON.stringify(vol));

    // complexe de paroi (béton + isolant + placo, dessinés séparément) : l'ouverture traverse tout le complexe, puis s'étire / se réduit couche par couche
    const opc = await ev(async () => { shapes = []; const m = mmToWorld(1000), R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m }));
        [['beton', 0, 0.2], ['isolant', 0.2, 0.32], ['placo', 0.32, 0.333]].forEach(([mat, a, b], k) => shapes.push({ type: 'hatch', layerId: wallLayerId({ layers: [{ mat, e: (b - a) * 1000 }] }), loops: [R(0, a, 4, b)], wallMat: mat, groupId: 'gc' + k, wz: { b: 0, t: 2500 } }));
        saveState(); setMode('opening'); openingClick({ x: 1 * m, y: -0.1 * m }); openingFinish({ x: 2 * m, y: -0.1 * m }); closeTopoModal();
        const h = shapes[0], o = h.openings[0], th = () => { const t = opStretchTT(o); return Math.round(Math.abs(t[1] - t[0]) / m * 1000); }, auto = th();
        await open3D(); await new Promise(r => setTimeout(r, 800)); const cut3 = [1, 2].map(k => wallOpeningsFor(shapes[k]).length);
        opStretchStart(h, o); opStretchClick({ x: 1.5 * m, y: -0.333 * m }); opStretchClick({ x: 1.5 * m, y: -0.201 * m }); setMode('select-box'); const manual = th(), cutIso = wallOpeningsFor(shapes[1]).length;
        // poignée latérale : mur sélectionné, on attrape la face de l'ouverture côté béton/isolant et on la tire jusqu'à la face extérieure du placo
        selectedShapes = [h]; const G = allGrips().filter(g => g.kind === 'op-face'), g = G.find(q => Math.abs(q.y + 0.2 * m) < 0.02 * m) || G[1];
        startGrip(g); gripApply(1.5 * m, -0.334 * m, false); endGrip(false); const grip = (() => { const t = opStretchTT(h.openings[0]); return Math.round(Math.abs(t[1] - t[0]) / m * 1000); })(), cutIso2 = wallOpeningsFor(shapes[1]).length; selectedShapes = [];
        close3D(); return { auto, cut3, manual, cutIso, nGrips: G.length, grip, cutIso2 }; });
    // sélection multiple béton + isolant, hauteur changée par Y : chacun garde son calque (donc sa hachure)
    const lay0 = await ev(() => shapes.slice(0, 2).map(x => x.layerId)); await ev(() => { selectedShapes = shapes.slice(0, 2); }); await H.Y({ 'sp-wzt': '3' });
    const lay1 = await ev(() => [shapes.slice(0, 2).map(x => x.layerId), shapes.slice(0, 2).map(x => x.wz.t)]);
    t.ok('sélection multiple (béton + isolant) : la hauteur change, chaque couche garde son calque', JSON.stringify(lay1[0]) === JSON.stringify(lay0) && lay1[1].every(v => v === 3000), JSON.stringify([lay0, lay1]));
    t.ok('ouverture : traverse tout le complexe de paroi (béton + isolant + placo)', Math.abs(opc.auto - 343) <= 2 && opc.cut3[0] === 1 && opc.cut3[1] === 1, JSON.stringify(opc));
    t.ok('ouverture étirée à la souris : ramenée au seul béton, l\'isolant n\'est plus percé', Math.abs(opc.manual - 205) <= 2 && opc.cutIso === 0, JSON.stringify(opc));
    t.ok('ouverture : poignées latérales sur le mur sélectionné, qui l\'étirent jusqu\'au placo', opc.nGrips === 2 && Math.abs(opc.grip - 344) <= 3 && opc.cutIso2 === 1, JSON.stringify(opc));

    // catalogue de textures : rangé par familles, chaque texture se dessine, les anciennes gardent leur nom de code
    const tx = await ev(() => { const bad = TEX_LIB.filter(t => { try { return !texCanvas(t.id) || !TEX_CATS.some(c => c[0] === t.cat); } catch (e) { return true; } }).map(t => t.id);
        return { n: TEX_LIB.length, bad, empty: TEX_CATS.filter(([k]) => !TEX_LIB.some(t => t.cat === k)).map(c => c[0]), old: ['beton', 'enduit', 'brique', 'parpaing', 'pierre', 'bois', 'enrobe', 'paves', 'terre', 'pelouse', 'gnt', 'gravier', 'tuile', 'ardoise', 'metal', 'carrelage', 'verre', 'eau'].filter(id => !TEX_LIB.some(t => t.id === id)) }; });
    t.ok('textures : plus de 60, rangées en catalogues, toutes dessinables, anciennes conservées', tx.n >= 60 && !tx.bad.length && !tx.empty.length && !tx.old.length, JSON.stringify(tx));

    // toit terrasse : dalle plane avec casquette, acrotère, forme de pente vers le côté d'évacuation (la dalle ne s'incline pas), flèche de pente cotée
    const tr = await ev(() => { shapes = []; const m = mmToWorld(1000), R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m, z: 0 }));
        const base = { type: 'poly', layerId: 'layer-0', points: R(0, 0, 10, 6) }; shapes.push(base); roofDialog(base, true); document.querySelector('input[name=rf-p][value="0"]').click();
        const set = (id, v) => { document.getElementById(id).value = v; }; set('rf-ht', '3,25'); set('rf-te', '0,25'); set('rf-tc', '0,5'); set('rf-ah', '0,6'); set('rf-at', '0,2'); set('rf-fp', '2'); set('rf-fe', '0,05'); document.getElementById('rf-tg').value = '0';
        [...document.querySelectorAll('#tm-actions button')].find(b => /Créer le toit/.test(b.textContent)).click();
        const slab = shapes.find(x => x.name === 'Dalle de toit'), acro = shapes.find(x => x.name === 'Acrotère'), fp = shapes.find(x => x.name === 'Forme de pente'), sl = shapes.find(x => x.type === 'slope');
        const xs = slab.points.map(q => q.x / m), flat = slab.points.every(q => q.z === slab.points[0].z);
        const v = meshStore[fp.meshId]; let zmin = 1e9, zmax = -1e9; for (let i = 2; i < v.length; i += 3) { zmin = Math.min(zmin, v[i]); zmax = Math.max(zmax, v[i]); }
        const ax = acro.points.map(q => q.x / m); return { aw: Math.round((Math.max(...ax) - Math.min(...ax)) * 100) / 100, w: Math.round((Math.max(...xs) - Math.min(...xs)) * 100) / 100, flat, zSlab: slab.points[0].z + slab.solid.H, acroH: acro.solid.H, holes: acro.solid.holes.length, fpBase: fp.z0, fpRise: Math.round(zmax - zmin), slope: sl ? Math.round(Math.abs(slopePct(sl)) * 100) / 100 : null }; });
    t.ok('toit terrasse : dalle plane avec casquette, acrotère dans l\'alignement des murs, forme de pente à 2 % vers l\'évacuation', tr.w === 11 && tr.aw === 10 && tr.flat && tr.zSlab === 3250 && tr.acroH === 600 && tr.holes === 1 && tr.fpBase === 3250 && tr.fpRise > 330 && tr.fpRise < 380 && tr.slope === 2, JSON.stringify(tr));

    // arête « paroi » d'une plateforme : un voile béton fin en 3D
    const par = await ev(() => { shapes = []; const m = mmToWorld(1000), TN = ensureLayer('Terrain naturel', '#bef264');
        for (let i = 0; i <= 12; i++) for (let j = 0; j <= 10; j++) shapes.push({ type: 'point', layerId: TN, x: i * 5 * m, y: -j * 5 * m, z: 100000, zk: 1 });
        shapes.push({ type: 'poly', layerId: 'layer-0', zk: 1, talus: { on: true, kD: '1/1', kR: '3/2', cx: true, edges: [null, null, { off: true }, null] }, points: [[20, 15], [40, 15], [40, 25], [20, 25]].map(([x, y]) => ({ x: x * m, y: -y * m, z: 99000 })) });
        invalidateCache(); tinCache = null; saveState(); if (!V3) init3D(); build3DScene(); let n = 0; V3.root.traverse(o => { if (o.userData.paroi) n++; }); return n; });
    t.ok('paroi : voile béton dessiné en 3D', par === 1, par);
    // paroi cochée en réglage UNIFORME (fenêtre Y) : le côté devient vertical, sans talus
    await ev(() => { const pl = shapes.find(x => x.talus); pl.talus = { on: true, kD: '1/1', kR: '3/2' }; selectedShapes = [pl]; saveState(); });
    await H.Y({ 'tj-uoff-1': true });
    const pu = await ev(() => { const pl = shapes.find(x => x.talus); tinCache = null; invalidateCache(); build3DScene(); let n = 0; V3.root.traverse(o => { if (o.userData.paroi) n++; }); return { cx: !!pl.talus.cx, off: (pl.talus.edges || []).map(e => !!(e && e.off)), n }; });
    t.ok('paroi en réglage uniforme : côté 2-3 en paroi, voile béton en 3D', !pu.cx && pu.off[1] === true && pu.n === 1, JSON.stringify(pu));

    // toiture à pans : fenêtre à chapitres, complexe couche par couche (épaisseur = somme), textures posées à la main et gardées à la modification
    const rc = await ev(() => { shapes = []; const m = mmToWorld(1000); const base = { type: 'poly', layerId: 'layer-0', points: [[0, 0], [10, 0], [10, 6], [0, 6]].map(([x, y]) => ({ x: x * m, y: -y * m, z: 0 })) }; shapes.push(base);
        roofDialog(base, true); document.querySelector('input[name=rf-p][value="2"]').click(); const tabs = document.querySelectorAll('#tm-strip button').length, noTex = !document.getElementById('rf-tex') && !document.getElementById('rf-texu');
        rfCx.p = [{ t: 'couverture', e: 3 }, { t: 'chevrons', e: 8, ent: 60 }, { t: 'isolation', e: 20 }, { t: 'parevapeur', e: 0.1 }]; rfCxDraw('p');
        [...document.querySelectorAll('#tm-actions button')].find(b => /Créer le toit/.test(b.textContent)).click();
        const pan = shapes.find(x => x.solid && x.solid.kind === 'roof'), e1 = pan.solid.e; shapes.filter(x => x.solid && x.solid.kind === 'roof').forEach(x => { x.tex = 'ardoise'; });
        roofEdit(pan.groupId); [...document.querySelectorAll('#tm-actions button')].find(b => /Mettre à jour/.test(b.textContent)).click();
        const pans2 = shapes.filter(x => x.solid && x.solid.kind === 'roof'); return { tabs, noTex, e1, tex: pans2.map(x => x.tex), cx: (pans2[0].roofDef.o.cxP || []).length }; });
    t.ok('toiture : chapitres, pas de texture dans la fenêtre, épaisseur = complexe (31,1 cm), textures gardées à la modification', rc.tabs >= 3 && rc.noTex && Math.abs(rc.e1 - 311) < 1 && rc.tex.every(x => x === 'ardoise') && rc.cx === 4, JSON.stringify(rc));

    // une paroi n'est pas du terrain : sa ligne cotée ne modifie ni le MNT ni les talus
    await ev(() => { shapes.forEach(s => { if (s.wallMat && s.type === 'line') { s.z1 = 99999; s.z2 = 99999; } }); tinCache = null; invalidateCache(); });
    t.ok('paroi exclue du terrain naturel', await ev(() => tinNodes().every(n => n.z !== 99999)));

    // une longue paroi en béton vue de loin se dessine vite (motif réduit à ce qui se voit)
    const ms = await ev(() => { const m = mmToWorld(1000), w = { type: 'hatch', layerId: wallLayerId({ layers: [{ mat: 'beton', e: 200 }] }), loops: [[{ x: 0, y: 0 }, { x: 500 * m, y: 0 }, { x: 500 * m, y: -0.2 * m }, { x: 0, y: -0.2 * m }]] };
        shapes.push(w); camera.zoom = 2 / m; const a = performance.now(); for (let i = 0; i < 3; i++) { invalidateCache(); draw(); } shapes.pop(); invalidateCache(); return (performance.now() - a) / 3; });
    t.ok('paroi de 500 m en béton : dessin rapide', ms < 400, Math.round(ms) + ' ms');
} };
