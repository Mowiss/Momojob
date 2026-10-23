#!/usr/bin/env node
// Batterie de non-régression MomoCAD.  node tests/run.js [filtre…] [-j 3] [-v]
// Chaque fichier de tests/suites exporte { name, tuto?, timeout?, run(H, t) }.
// Une suite est verte si tous ses contrôles passent ET si la page n'a levé aucune erreur JavaScript ni alerte imprévue.
const fs = require('fs'), path = require('path');
const { launch, openPage, helpers, OUT } = require('./lib/harness');
const args = process.argv.slice(2); let J = 3, VERB = false; const filt = [];
for (let i = 0; i < args.length; i++) { if (args[i] === '-j') J = +args[++i] || 1; else if (args[i] === '-v') VERB = true; else filt.push(args[i]); }
// les traces de mise au point des suites ne s'affichent qu'avec -v ; le rapport passe par say()
const say = console.log.bind(console); if (!VERB) console.log = () => {};
const files = fs.readdirSync(path.join(__dirname, 'suites')).filter(f => f.endsWith('.js')).sort()
    .filter(f => !filt.length || filt.some(x => f.includes(x)));

async function runSuite(browser, file) {
    const S = require(path.join(__dirname, 'suites', file)); const name = S.name || file.replace(/\.js$/, '');
    const res = { name, checks: [], ms: 0, fatal: null }, t0 = Date.now();
    const rec = { ok: (label, cond, detail) => { res.checks.push({ label, ok: !!cond, detail: detail === undefined ? '' : String(detail) }); return !!cond; },
                  eq: (label, got, want, tol) => { const ok = typeof want === 'number' ? Math.abs(got - want) <= (tol === undefined ? 1e-6 : tol) : JSON.stringify(got) === JSON.stringify(want); res.checks.push({ label, ok, detail: ok ? '' : 'obtenu ' + JSON.stringify(got) + ', attendu ' + JSON.stringify(want) }); return ok; } };
    let pg;
    try {
        pg = await openPage(browser, S.page || {});
        const H = helpers(pg, rec);
        if (S.tuto) { await H.ev(t => startTuto(t), S.tuto); await H.wait(1200); }
        await Promise.race([S.run(H, rec), new Promise((_, rj) => setTimeout(() => rj(new Error('délai dépassé (' + (S.timeout || 180) + ' s)')), (S.timeout || 180) * 1000))]);
        await H.shot(name);
    } catch (e) { res.fatal = e.message.split('\n')[0]; try { pg && await pg.p.screenshot({ path: path.join(OUT, name + '.png') }); } catch (e2) {} }
    if (pg) {
        rec.ok('aucune erreur JavaScript', !pg.errs.length, pg.errs.slice(0, 3).join(' | '));
        const unexpected = pg.alerts.filter(a => !(S.alertsOk || []).some(r => r.test(a)));
        rec.ok('aucune alerte imprévue', !unexpected.length, unexpected.slice(0, 3).join(' | '));
        if (pg.cons.length) rec.ok('console sans erreur', false, pg.cons.slice(0, 3).join(' | '));
        await pg.ctx.close().catch(() => {});
    }
    res.ms = Date.now() - t0; return res;
}

(async () => {
    const t0 = Date.now(), browser = await launch(), queue = files.slice(), results = [];
    const worker = async () => { while (queue.length) { const f = queue.shift(); const r = await runSuite(browser, f); results.push(r); print(r); } };
    const lines = [];
    const print = (r) => {
        const bad = r.checks.filter(c => !c.ok), ok = !bad.length && !r.fatal;
        const head = (ok ? '✔ ' : '✘ ') + r.name.padEnd(28) + String(r.checks.length - bad.length).padStart(3) + '/' + r.checks.length + '  ' + (r.ms / 1000).toFixed(1) + ' s';
        const out = [head]; if (r.fatal) out.push('    ⚠ arrêt : ' + r.fatal);
        bad.forEach(c => out.push('    ✘ ' + c.label + (c.detail ? ' — ' + c.detail : '')));
        say(out.join('\n')); lines.push(...out);
    };
    await Promise.all(Array.from({ length: Math.min(J, files.length) }, worker));
    await browser.close();
    const nOk = results.filter(r => !r.fatal && r.checks.every(c => c.ok)).length, nChk = results.reduce((a, r) => a + r.checks.length, 0), nBad = results.reduce((a, r) => a + r.checks.filter(c => !c.ok).length, 0);
    const sum = `\n${nOk === results.length ? 'TOUT EST VERT' : 'ÉCHECS'} : ${nOk}/${results.length} suites, ${nChk - nBad}/${nChk} contrôles, ${((Date.now() - t0) / 1000).toFixed(0)} s`;
    say(sum); lines.push(sum);
    fs.writeFileSync(path.join(OUT, 'rapport.txt'), new Date().toISOString() + '\n' + lines.join('\n') + '\n');
    process.exit(nOk === results.length ? 0 : 1);
})();
