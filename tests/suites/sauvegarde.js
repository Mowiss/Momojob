// Enregistrement automatique : un plan modifié puis abandonné (page rechargée) est proposé au redémarrage et revient intact.
module.exports = { name: 'sauvegarde', page: { fresh: false }, run: async (H, t) => {
    const { p, ev } = H;
    await ev(() => { try { localStorage.clear(); } catch (e) {} }); await H.reload();
    t.ok('pas de proposition de récupération sur un navigateur neuf', !(await ev(() => !!document.getElementById('as-banner'))));
    await H.blank(14);
    await H.tool('btn-rect'); await H.click(await H.W(0, 0)); await H.click(await H.W(8, 5)); await H.press('Escape');
    await H.tool('btn-circle'); await H.click(await H.W(20, 10)); await H.key('3 '); await H.press('Escape');
    const n = await ev(() => shapes.length);
    t.ok('enregistrement automatique fait (plan modifié)', await ev(() => autosaveNow(false)));
    t.ok('rien à refaire tant que le plan ne change pas', !(await ev(() => autosaveNow(false))));
    // l'onglet est « fermé » sans enregistrer : on recharge
    await H.reload();
    t.ok('au redémarrage, la récupération est proposée', await ev(() => !!document.getElementById('as-banner')), await ev(() => (document.getElementById('as-banner') || {}).textContent));
    await ev(() => document.getElementById('as-yes').click()); await H.wait(500);
    t.eq('le plan récupéré a tous ses objets', await ev(() => shapes.length), n);
    t.ok('le plan récupéré reste à enregistrer', await ev(() => isDirty()));
    // une fois traité (récupéré ou ignoré), on ne repropose plus la même sauvegarde
    await H.reload();
    t.ok('pas de nouvelle proposition après récupération', !(await ev(() => !!document.getElementById('as-banner'))));
    // historique
    await ev(() => openAutosaves()); await H.wait(400);
    t.ok('Fichier › Sauvegardes automatiques liste la sauvegarde', await ev(() => /Rouvrir/.test(document.getElementById('tm-body').innerHTML)));
    await ev(() => asOpenAt(0)); await H.wait(500);
    t.eq('Rouvrir recharge la sauvegarde', await ev(() => shapes.length), n);
    // un plan enregistré proprement ne déclenche pas de proposition
    await ev(() => { markSaved(); }); await ev(() => autosaveNow(true)); await H.reload();
    t.ok('plan enregistré : rien à récupérer', !(await ev(() => !!document.getElementById('as-banner'))));
} };
