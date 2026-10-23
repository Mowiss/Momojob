// Cubatures et métré sur des cas simples, comparés à des volumes calculés à la main.
// Terrain plat à 100,00 m ; plateforme rectangulaire 20 × 10 m.
module.exports = { name: 'calculs', run: async (H, t) => {
    const { ev } = H;
    await H.blank(14);
    // pose un terrain plat (points tous les 5 m) et une plateforme ; renvoie { D, Rm, items } en m³
    const cub = (o) => ev((o) => {
        shapes = []; const m = mmToWorld(1000), TN = ensureLayer('Terrain naturel', '#bef264');
        for (let i = 0; i <= 12; i++) for (let j = 0; j <= 10; j++) shapes.push({ type: 'point', layerId: TN, x: i * 5 * m, y: -j * 5 * m, z: 100000, zk: 1 });
        const pl = { type: 'poly', layerId: 'layer-0', zk: 1, points: [[20, 15], [40, 15], [40, 25], [20, 25]].map(([x, y]) => ({ x: x * m, y: -y * m, z: o.z })) };
        if (o.talus) pl.talus = o.talus; if (o.rp) pl.cubRP = o.rp; if (o.struct) pl.struct = o.struct; shapes.push(pl); invalidateCache(); saveState();
        const C = withModel(() => cubCompute()); if (C.err) return { err: C.err };
        const it = C.items[0];
        return { D: +C.D.toFixed(3), Rm: +C.Rm.toFixed(3), RP: +(C.RP || 0).toFixed(3), plat: [+it.pr.deb.toFixed(3), +it.pr.rem.toFixed(3)], tal: it.tal ? [+it.tal.deb.toFixed(3), +it.tal.rem.toFixed(3)] : null,
            extra: it.extra.map(e => [e.lbl.split(' ')[0] + ' ' + (e.lbl.split(' ')[1] || ''), +e.deb.toFixed(3), +e.rem.toFixed(3), !!e.info]) };
    }, o);
    const pct = (got, want) => Math.abs(got - want) / want;

    // 1. déblai d'un mètre, sans talus : 20 × 10 × 1 = 200 m³
    let r = await cub({ z: 99000, talus: { on: false } });
    t.ok('déblai 1 m sans talus = 200 m³', !r.err && Math.abs(r.D - 200) < 0.5 && r.Rm < 0.01, JSON.stringify(r));
    // 2. remblai d'un mètre, sans talus : 200 m³
    r = await cub({ z: 101000, talus: { on: false } });
    t.ok('remblai 1 m sans talus = 200 m³', !r.err && Math.abs(r.Rm - 200) < 0.5 && r.D < 0.01, JSON.stringify(r));
    // 3. déblai d'un mètre, talus 1/1 : tronc de pyramide 20×10 → 22×12, V = h(ab + kh(a+b) + 4/3 k²h²) = 200 + 30 + 1,333 = 231,33 m³
    r = await cub({ z: 99000, talus: { on: true, kD: '1/1', kR: '3/2' } });
    t.ok('déblai 1 m, talus 1/1 = 231,33 m³ (à 1 % près)', !r.err && pct(r.D, 231.333) < 0.01, JSON.stringify(r));
    // 4. remblai d'un mètre, talus 3/2 (k = 1,5) : 200 + 1,5 × 30 + 4/3 × 2,25 = 248 m³
    r = await cub({ z: 101000, talus: { on: true, kD: '1/1', kR: '3/2' } });
    t.ok('remblai 1 m, talus 3/2 = 248 m³ (à 1 % près)', !r.err && pct(r.Rm, 248) < 0.01, JSON.stringify(r));
    // 5. recul R = 1 m en déblai : fond 22 × 12 puis talus 1/1 → 264 + 34 + 1,333 = 299,33 m³ au total, dont 64 m³ de recul
    r = await cub({ z: 99000, talus: { on: true, kD: '1/1', kR: '3/2', R: 1000 } });
    { const rec = (r.extra || []).find(e => e[0].startsWith('recul'));
      t.ok('recul 1 m : déblai total 299,33 m³ (à 1 % près)', !r.err && pct(r.D, 299.333) < 0.01, JSON.stringify(r));
      t.ok('recul 1 m : ligne « recul » de 64 m³', rec && Math.abs(rec[1] - 64) < 0.7, JSON.stringify(rec)); }
    // 6. remblai périphérique jusqu'à 99,50 (talus 1/1, sans recul) : bande autour de la plateforme sur 0,5 m de haut
    //    V = ∫₀^0,5 (périmètre·t + 4t²) dt = 60 × 0,125 + 4 × 0,125 / 3 = 7,667 m³
    r = await cub({ z: 99000, talus: { on: true, kD: '1/1', kR: '3/2' }, rp: { on: true, z: 99500 } });
    { const rp = (r.extra || []).filter(e => e[0].startsWith('remblai') && !e[3]).reduce((a, e) => a + e[2], 0);
      t.ok('remblai périphérique jusqu\'à 99,50 = 7,67 m³ (à 2 % près)', pct(rp, 7.667) < 0.02, rp.toFixed(3) + ' — ' + JSON.stringify(r.extra));
      t.ok('récapitulatif : remblai périphérique compté à part', Math.abs(r.RP - rp) < 0.01, JSON.stringify(r));
      const cards = await ev(async () => { openCubatureDialog(); cubGo(2); await new Promise(r => setTimeout(r, 600)); const L = [...document.querySelectorAll('#cb-res > div:first-child > div > div:first-child')].map(d => d.textContent); closeTopoModal && closeTopoModal(); return L; }).catch(e => ['err ' + e.message]);
      t.ok('récapitulatif : cases Remblai et Remblai périphérique', cards.includes('Remblai') && cards.includes('Remblai périphérique'), JSON.stringify(cards)); }
      // en 3D : le remblai périphérique se montre en volume, son dessus au niveau fini (99,50)
      const rp3 = await ev(async () => { await open3D(); await new Promise(r => setTimeout(r, 900)); document.querySelector('[data-for="v3-rp"]').click(); await new Promise(r => setTimeout(r, 400));
          let top = null, n = 0; V3.root.traverse(o => { if (o.userData.rp) { n++; const a = o.geometry.attributes.position.array; let mx = -1e9; for (let i = 2; i < a.length; i += 3) mx = Math.max(mx, a[i]); top = mx / V3.exag + V3.zmin; } });
          document.querySelector('[data-for="v3-rp"]').click();
          const cnt = () => { let k = 0; V3.root.traverse(o => { if (o.isPoints) k++; }); return k; }, on = cnt(); document.querySelector('[data-for="v3-lab"]').click(); await new Promise(r => setTimeout(r, 300)); const off = cnt(); document.querySelector('[data-for="v3-lab"]').click();
          const m = mmToWorld(1000), c = document.createElement('canvas'); c.width = c.height = 64; c.getContext('2d').fillRect(0, 0, 64, 64); basemapStore['t-drape'] = c.toDataURL(); bmImg('t-drape'); await new Promise(r => setTimeout(r, 200));
          shapes.unshift({ type: 'basemap', layerId: 'layer-0', x: 30 * m, y: -20 * m, r: 20 * m, mapId: 't-drape' }); build3DScene();
          const dr = () => { let k = 0, flat = 0; V3.root.traverse(o => { if (o.userData.drape) k++; else if (o.isMesh && o.geometry.type === 'CircleGeometry') flat++; }); return [k, flat]; }, d1 = dr();
          document.querySelector('[data-for="v3-bg"]').click(); const d0 = dr(); document.querySelector('[data-for="v3-bg"]').click(); shapes.shift();
          close3D(); return { n, top, pts: [on, off], drape: [d1, d0] }; });
      t.ok('3D : fond de carte drapé sur le terrain (pas d\'image à plat), masqué avec son bouton', rp3.drape[0][0] === 1 && rp3.drape[0][1] === 0 && rp3.drape[1][0] === 0 && rp3.drape[1][1] === 0, JSON.stringify(rp3.drape));
      // vue iso / façade du plan : le maillage du terrain reste dessiné autour des plateformes (hors plateforme et talus)
      const wire = await ev(() => { build3DScene(); let n = 0; const ox = V3.root.position.x, oy = V3.root.position.y;
          V3.root.traverse(o => { if (!o.isLineSegments) return; const a = o.geometry.attributes.position.array; for (let i = 0; i < a.length; i += 6) { const x = (a[i] + a[i + 3]) / 2, y = (a[i + 1] + a[i + 4]) / 2;
              if (x > 12 && x < 48 && y > 8 && y < 32 && !(x > 19 && x < 41 && y > 14 && y < 26)) n++; } }); build3DScene(); return n; });
      t.ok('vue iso du plan : maillage du terrain présent autour de la plateforme', wire > 20, wire);
      t.ok('3D : cotes de niveau masquées → points et fils masqués aussi', rp3.pts[0] > 0 && rp3.pts[1] === 0, JSON.stringify(rp3.pts));
      t.ok('3D : remblai périphérique affiché, dessus à 99,50', rp3.n === 1 && Math.abs(rp3.top - 99.5) < 0.01, JSON.stringify(rp3));

    // 7. remblai périphérique AU TERRAIN NATUREL : la fouille est rebouchée jusqu'au terrain = volume du talus de déblai (1 m, 1/1) = 60 × 0,5 + 4/3 = 31,33 m³
    r = await cub({ z: 99000, talus: { on: true, kD: '1/1', kR: '3/2' }, rp: { on: true, mode: 'tn' } });
    t.ok('remblai périphérique jusqu\'au terrain naturel = 31,33 m³ (à 2 % près)', pct(r.RP, 31.333) < 0.02, JSON.stringify(r));
    // 8. cote finie AU-DESSUS du terrain (100,50 pour un terrain à 100) : fouille remplie jusqu'à 100,50 puis talus 1/1 jusqu'au terrain
    //    fouille : 31,33 + 0,5 × (60 + π) = 62,90 ; talus : 0,125 × (60 + 2π) + 2π × 0,5³ / 6 = 8,42 ; total 71,3 m³
    r = await cub({ z: 99000, talus: { on: true, kD: '1/1', kR: '3/2' }, rp: { on: true, z: 100500 } });
    { const ext = (r.extra || []).find(e => /talus/.test(e[0] + '') && e[0].startsWith('remblai')); 
      t.ok('cote finie au-dessus du terrain : talus 1/1 du remblai jusqu\'au terrain, total ≈ 71,3 m³ (à 3 % près)', pct(r.RP, 71.32) < 0.03, JSON.stringify(r)); }

    // 9. structure de 40 cm et recul de 1 m : la structure s'étend sur le recul → recul terrassé au fond de forme : 64 m² × (1 + 0,4) = 89,6 m³
    r = await cub({ z: 99000, talus: { on: true, kD: '1/1', kR: '3/2', R: 1000 }, struct: { layers: [{ mat: 'GNT_0_80', e: 40 }], ff: true } });
    { const rec = (r.extra || []).find(e => e[0].startsWith('recul'));
      t.ok('structure étendue au recul : recul terrassé au fond de forme (89,6 m³)', rec && Math.abs(rec[1] - 89.6) < 1.2, JSON.stringify(rec)); }

    // métré : longueur d'une droite et d'une polyligne, surface d'un rectangle
    await ev(() => { shapes = []; const m = mmToWorld(1000);
        shapes.push({ type: 'line', layerId: 'layer-0', x1: 0, y1: 0, x2: 12.5 * m, y2: 0 });
        shapes.push({ type: 'poly', layerId: 'layer-0', open: true, points: [{ x: 0, y: -5 * m }, { x: 3 * m, y: -5 * m }, { x: 3 * m, y: -9 * m }] });
        shapes.push({ type: 'poly', layerId: 'layer-0', open: false, points: [[20, 0], [26, 0], [26, 4], [20, 4]].map(([x, y]) => ({ x: x * m, y: -y * m })) });
        invalidateCache(); saveState(); });
    const md = await ev(() => { const d = metreData(); return JSON.stringify(d, (k, v) => typeof v === 'number' ? +v.toFixed(3) : (v && v.type ? undefined : v)).slice(0, 1500); });
    t.ok('métré : 39,5 m de linéaire (12,5 + 7 + périmètre 20)', /"lin":39\.5\b/.test(md), md.slice(0, 400));
    t.ok('métré : surface fermée de 24 m²', /"ferm":24\b/.test(md), md.slice(0, 400));
} };
