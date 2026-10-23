// Sans aucun réseau : la mise en forme, le PDF, la 3D, la découpe, le lecteur PDF et la carte viennent du dossier lib/ à côté de index.html.
module.exports = { name: 'hors-ligne', page: { offline: true }, run: async (H, t) => {
    const { ev } = H;
    const lay = await ev(() => { const r = canvas.getBoundingClientRect(), tb = document.getElementById('btn-line').getBoundingClientRect(); return { w: r.width, h: r.height, tool: tb.width, flex: getComputedStyle(document.body).display }; });
    t.ok('mise en forme en place sans réseau (barre d\'outils, zone de dessin)', lay.flex === 'flex' && lay.w > 900 && lay.h > 600 && lay.tool > 20 && lay.tool < 60, JSON.stringify(lay));
    t.ok('PDF disponible', await ev(() => !!(window.jspdf && window.jspdf.jsPDF)));
    t.ok('moteur 3D chargé depuis lib/', await ev(async () => { try { await loadThree(); return !!window.THREE; } catch (e) { return false; } }));
    t.ok('outil de découpe chargé depuis lib/', await ev(async () => { try { await loadPolyClip(); return !!window.polygonClipping; } catch (e) { return false; } }));
    t.ok('lecteur PDF chargé depuis lib/', await ev(async () => { try { const L = await loadPdfJs(); return !!L && /lib\//.test(L.GlobalWorkerOptions.workerSrc); } catch (e) { return false; } }));
    t.ok('carte chargée depuis lib/', await ev(async () => { try { await loadLeaflet(); return !!(window.L && L.map); } catch (e) { return false; } }));
    // la vue 3D s'ouvre
    await ev(async () => { await open3D(); }); await H.wait(2500);
    t.ok('vue 3D ouverte hors ligne', await ev(() => typeof is3DOpen === 'function' && is3DOpen()));
    await ev(() => close3D());
    // un dessin et son impression PDF
    await H.blank(14); await H.tool('btn-rect'); await H.click(await H.W(0, 0)); await H.click(await H.W(10, 6)); await H.press('Escape');
    await ev(() => { printSettings.output = 'pdf'; setMode('print'); }); await H.wait(300);
    const C = await ev(() => { const m = mmToWorld(1000), q = worldToScreen(5 * m, -3 * m); return { x: q.x, y: q.y }; });
    try { const [d] = await Promise.all([H.p.waitForEvent('download', { timeout: 20000 }), ev(c => performPrint(c.x, c.y), C)]); t.ok('impression PDF hors ligne', /\.pdf$/.test(d.suggestedFilename())); }
    catch (e) { t.ok('impression PDF hors ligne', false, e.message.split('\n')[0]); }
    await ev(() => setMode('select-box'));
    // poste hors ligne : les fonctions qui ont besoin d'Internet le disent clairement
    await H.ctx.setOffline(true); await H.wait(200);
    await ev(() => { startBmPlace(); }); await H.wait(500);
    t.ok('fond de carte hors ligne : message « besoin d\'Internet »', /Internet/.test(await ev(() => document.getElementById('command-text').textContent)), await ev(() => document.getElementById('command-text').textContent));
    await ev(() => { try { closeBasemapModal && closeBasemapModal(); } catch (e) {} setMode('select-box'); });
    const ia = await ev(() => { iaCfg.key = 'cle-de-test'; momoGoIA(); const q = document.getElementById('mc-q'); if (!q) return 'pas de champ'; q.value = 'Bonjour'; mcSend(); return (mcMsgs.at(-1) || {}).text || ''; });
    t.ok('Momo IA hors ligne : message « besoin d\'Internet »', /Internet/.test(ia), ia);
    await H.ctx.setOffline(false);
} };
