// Sorties : impression rapide (PDF et image), planche de présentation en PDF, métré en PDF. Chaque fichier doit sortir, non vide.
module.exports = { name: 'sorties', timeout: 240, run: async (H, t) => {
    const { p, ev } = H;
    await H.blank(14);
    await ev(() => { const m = mmToWorld(1000);
        shapes.push({ type: 'poly', layerId: 'layer-0', open: false, points: [[0, 0], [30, 0], [30, 20], [0, 20]].map(([x, y]) => ({ x: x * m, y: -y * m })) });
        shapes.push({ type: 'circle', layerId: 'layer-0', x: 15 * m, y: -10 * m, r: 3 * m });
        shapes.push(makeDim({ x: 0, y: 0 }, { x: 30 * m, y: 0 }, { x: 15 * m, y: 3 * m }, 'h'));
        shapes.push({ type: 'text', layerId: 'layer-0', x: 2 * m, y: -18 * m, content: 'Essai de sortie', size: 20 });
        cartoucheData.planName = 'Plan d\'essai'; cartoucheData.indice = 'A'; saveState(); invalidateCache(); draw(); });
    // attend un téléchargement déclenché par fn ; renvoie { name, size } ou null
    const dl = async (label, fn, re) => {
        try { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), fn()]); const f = await d.path(); const size = require('fs').statSync(f).size;
            t.ok(label + ' (' + d.suggestedFilename() + ', ' + Math.round(size / 1024) + ' Ko)', re.test(d.suggestedFilename()) && size > 3000);
            if (/\.png$/.test(d.suggestedFilename())) require('fs').copyFileSync(f, require('../lib/harness').OUT + '/sortie-impression.png');
            return { name: d.suggestedFilename(), size }; }
        catch (e) { t.ok(label, false, e.message.split('\n')[0]); return null; } };

    // impression rapide en PDF (A3 paysage, cartouche)
    await ev(() => { printSettings.paper = 'A3'; printSettings.output = 'pdf'; printSettings.cartouche = true; printOrientation = printSettings.orientation = 'landscape'; setMode('print'); });
    await H.wait(400);
    const C = await ev(() => { const m = mmToWorld(1000), q = worldToScreen(15 * m, -10 * m); return { x: q.x, y: q.y }; });   // feuille centrée sur le dessin
    await dl('impression rapide en PDF', () => ev(c => performPrint(c.x, c.y), C), /\.pdf$/);
    // même chose en image
    await ev(() => { printSettings.output = 'png'; setMode('print'); }); await H.wait(300);
    await dl('impression rapide en image PNG', () => ev(c => performPrint(c.x, c.y), C), /\.png$/);
    await ev(() => setMode('select-box'));

    // présentation : une fenêtre sur la planche, puis le PDF de la feuille
    await ev(() => { if (!layoutOn) toggleLayout(true); }); await H.wait(600);
    const R = await ev(() => { const r = canvas.getBoundingClientRect(); return { a: { x: r.left + r.width * 0.25, y: r.top + r.height * 0.3 }, b: { x: r.left + r.width * 0.6, y: r.top + r.height * 0.7 } }; });
    await H.tool('btn-lpvp'); await H.click(R.a); await H.click(R.b); await H.press('Escape');
    t.ok('présentation : une fenêtre posée sur la planche', await ev(() => (layoutData.vps || []).length >= 1), await ev(() => JSON.stringify((layoutData.vps || []).map(v => [v.kind || 'plan', v.scale]))));
    await H.shot('sortie-planche');
    await dl('présentation : PDF de la feuille', () => ev(() => lpPrintPDF()), /\.pdf$/);
    await ev(() => { if (layoutOn) toggleLayout(false); });

    // métré en PDF
    await dl('métré en PDF', () => ev(() => metrePDF()), /\.pdf$/);
} };
