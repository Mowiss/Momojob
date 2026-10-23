// Unité du dessin en cm : les longueurs des menus (volume, ouverture, tranchée, recul) s'affichent et se saisissent en cm ; les altitudes restent en m.
module.exports = { name: 'unites', run: async (H, t) => {
    const { ev } = H;
    await H.blank(14);
    await ev(() => { printSettings.unit = 'cm'; applyUnitSettings(); const m = mmToWorld(1000);
        const s = { type: 'poly', layerId: activeLayerId, zk: 1, points: [[0, 0], [2, 0], [2, 1], [0, 1]].map(([x, y]) => ({ x: x * m, y: -y * m, z: 100000 })), solid: { kind: 'box', H: 2500 } };
        shapes.push(s); selectedShapes = [s]; saveState(); openSelectionParamModal(); });
    await H.wait(300);
    const f = await ev(() => { const e = document.getElementById('sp-h'); return { v: e && e.value, u: e && e.closest('.mf-row') ? e.closest('.mf-row').textContent.trim().slice(-3) : '' }; });
    t.ok('hauteur du volume affichée en cm (250 cm)', f.v && f.v.replace(',', '.') == 250 && /cm/.test(f.u), JSON.stringify(f));
    await ev(() => { const e = document.getElementById('sp-h'); e.value = '300'; applySelectionLayer(); });
    t.eq('saisie 300 cm → 3 000 mm', await ev(() => shapes.at(-1).solid.H), 3000);
    await ev(() => { closeSelectionParamModal(); });
    // tranchée : largeur dans l'unité
    t.eq('largeur de tranchée 600 mm affichée « 60,0 » en cm', await ev(() => trM(600)), '60,0');
    await ev(() => { trEdit = { W: 600, H: 1200, hp: 100, gap: 50, layers: [], tubes: [] }; trSet('W', '80'); });
    t.eq('saisie de largeur 80 cm → 800 mm', await ev(() => trEdit.W), 800);
    await ev(() => { printSettings.unit = 'm'; applyUnitSettings(); });
    t.eq('retour en m : 600 mm affichés « 0,60 »', await ev(() => trM(600)), '0,60');
} };
