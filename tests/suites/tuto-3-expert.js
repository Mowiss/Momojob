// Tuto « param » (Expert) joué de bout en bout : chaque réglage est fait comme à la main (clic, saisie, événements).
module.exports = { name: 'tuto-3-expert', tuto: 'param', timeout: 300, run: async (H, t) => {
    const { p, ev } = H;
    // saisie dans un champ + événements, comme au clavier
    const set = (sel, v) => ev(([sel, v]) => { const e = typeof sel === 'string' ? document.querySelector(sel) : null; if (!e) throw new Error('champ absent : ' + sel);
        if (e.type === 'checkbox') e.checked = v; else e.value = v; ['input', 'change'].forEach(k => e.dispatchEvent(new Event(k, { bubbles: true }))); }, [sel, v]);
    const clk = (sel) => ev(sel => { const e = document.querySelector(sel); if (!e) throw new Error('élément absent : ' + sel); e.click(); }, sel);
    const tab = (k) => clk(`#cartouche-modal .ps-tab[data-tab="${k}"]`);
    const seg = (id, v) => clk(`#cartouche-modal .ps-seg[data-for="${id}"] button[data-v="${v}"]`);
    const row = (q) => ev(q => { const l = layers.find(x => /^eu\b/i.test(x.name)); const n = [...document.querySelectorAll('#layers-list .lay-name')].find(x => x.textContent.trim() === l.name); const e = n.parentElement.querySelector(q); if (!e) throw new Error('absent ' + q); return true; }, q);
    const rowSet = (q, v) => ev(([q, v]) => { const l = layers.find(x => /^eu\b/i.test(x.name)); const n = [...document.querySelectorAll('#layers-list .lay-name')].find(x => x.textContent.trim() === l.name); const e = n.parentElement.querySelector(q);
        if (!e) throw new Error('absent ' + q); e.value = v; ['input', 'change'].forEach(k => e.dispatchEvent(new Event(k, { bubbles: true }))); }, [q, v]);
    const step = async (fn) => { await H.next(); if (fn) await fn(); await H.wait(350); await H.state(''); };

    await H.state('intro');
    await step(() => clk('#btn-print-settings'));
    await step(async () => { await tab('plan'); await H.wait(150); await clk('#cartouche-modal button[onclick="psDecimals(1)"]'); await H.wait(400);
        while (+(await ev(() => document.getElementById('ps-decimals').value)) > 2) { await clk('#cartouche-modal button[onclick="psDecimals(-1)"]'); await H.wait(300); } });
    await step(() => set('#ps-grid', '1'));
    await step(async () => { await tab('print'); await H.wait(150); await seg('ps-paper', 'A3'); await H.wait(150); await seg('ps-orient', 'landscape'); await H.wait(150); await seg('ps-output', 'pdf'); });
    await step(async () => { await tab('cart'); await H.wait(150); await set('#ps-cartouche', true); await H.wait(150); await seg('ps-carttype', 'a4'); });
    await step(async () => { await set('#cartouche-plan', 'Plan de masse – VRD'); await H.wait(200); await set('#cartouche-indice', 'A'); await H.wait(200); await set('#cartouche-client', 'Commune de Gap'); await H.wait(200); await set('#cartouche-draftsman', 'Momo'); });
    await step(() => clk('#cartouche-modal button[onclick="psRevAdd()"]'));
    await step(async () => { await tab('fond'); await H.wait(150); await seg('ps-bmbase', 'ortho'); await H.wait(150); await set('#ps-ov-courbes', true); });
    await step(async () => { await tab('pres'); await H.wait(150); await seg('ps-lppaper', 'A1'); await H.wait(150); await set('#ps-lpfold', true); await H.wait(150); await set('#ps-lpmargin', '10'); });
    await step(() => tab('ia'));
    await step(async () => { await tab('mat'); await H.wait(300);
        await ev(() => { const i = document.querySelectorAll('#ps-mat-box .mat-terr')[0].querySelectorAll('input')[2]; i.value = '12'; i.dispatchEvent(new Event('change', { bubbles: true })); }); await H.wait(250);
        await set('#ps-mat-q', '0/31'); await H.wait(300);
        await ev(() => { const r = [...document.querySelectorAll('#ps-mat-box .mat-grid:not(.mat-terr)')].find(x => /0\/31/.test((x.querySelector('input') || {}).value || '')); const i = r.querySelectorAll('input')[3]; i.value = '28'; i.dispatchEvent(new Event('change', { bubbles: true })); }); });
    await step(() => clk('#cartouche-modal button[onclick="applyCartouche()"]'));
    await t.eq('réglages appliqués : A3 paysage', await ev(() => [printSettings.paper, printOrientation]), ['A3', 'landscape']);
    await t.ok('prix du déblai enregistré (12 €/m³)', await ev(() => matCatalog.find(m => m.code === '__DEB').prix === 12));
    await step(() => clk('button[onclick="openLayerModal()"]'));
    await step(async () => { await set('#new-layer-name', 'EU'); await H.wait(200); await clk('#layer-modal button[onclick="addLayer()"]'); await H.wait(400); await rowSet('input.lay-color', '#b91c1c'); });
    await step(async () => { await rowSet('select[title="Type de ligne"]', 'text'); await H.wait(300); await rowSet('input[title^="Texte répété"]', 'EU Ø160'); await H.wait(300); await rowSet('input[title="Épaisseur"]', '2'); });
    await step(async () => { await rowSet('select[title="Hachure"]', 'cross'); await H.wait(300); await rowSet('input[title^="Échelle de hachure"]', '2'); });
    await step(async () => { await row('button[title^="Apparence des points topo"]');
        await ev(() => { const l = layers.find(x => /^eu\b/i.test(x.name)); const n = [...document.querySelectorAll('#layers-list .lay-name')].find(x => x.textContent.trim() === l.name); n.parentElement.querySelector('button[title^="Apparence des points topo"]').click(); });
        await H.wait(400);
        await ev(() => { const s0 = ptStyleOf(layers.find(x => /^eu\b/i.test(x.name)).id).sym; const b = [...document.querySelectorAll('#pt-style-pop [onclick*="sym"]')].find(x => !x.getAttribute('onclick').includes("'" + s0 + "'")); if (!b) throw new Error('aucun autre symbole'); b.click(); });
        await H.wait(400); await clk('#pt-style-pop button[onclick="closePtStyle()"]'); });
    await t.eq('calque EU : trait -T-, libellé, épaisseur 2, hachure croisée', await ev(() => { const l = layers.find(x => /^eu\b/i.test(x.name)); return [l.dash, l.ltText, l.width, l.hatch]; }), ['text', 'EU Ø160', 2, 'cross']);
    await step(async () => { await clk('#layer-modal button[onclick="closeLayerModal()"]'); await H.wait(300); await clk('#btn-dxf-menu'); await H.wait(300); await clk('#menu-dxf button[onclick*="saveGabarit"]'); await H.wait(800); });
    await H.next(); await H.state('fin');
} };
