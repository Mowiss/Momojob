// Banc d'essai MomoCAD : ouvre index.html dans Chromium sans réseau (bibliothèques servies depuis tests/vendor),
// relève les erreurs JavaScript et les alertes, et fournit les gestes de base (clic sur le plan, clavier, outils, Y).
const fs = require('fs'), path = require('path');
const PW = ['/home/claude/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright', 'playwright'];
let chromium; for (const m of PW) { try { ({ chromium } = require(m)); break; } catch (e) {} }
const ROOT = path.resolve(__dirname, '..'), APP = process.env.MOMOCAD_APP || path.resolve(ROOT, '..', 'index.html');
const V = (f) => fs.readFileSync(path.join(ROOT, 'vendor', f));
const OUT = path.join(ROOT, 'out'); fs.mkdirSync(OUT, { recursive: true });
const EXE = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(f => fs.existsSync(f));

async function launch() {
    return chromium.launch(Object.assign({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }, EXE ? { executablePath: EXE } : {}));
}

// page prête : bibliothèques locales, tout autre accès réseau coupé (fonds de carte, IA…)
async function openPage(browser, opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errs = [], alerts = [], cons = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|ERR_FAILED|blocked/i.test(m.text())) cons.push(m.text()); });
    p.on('dialog', d => { if (d.type() === 'beforeunload') return d.accept().catch(() => {});   // quitter la page malgré des modifications : voulu par le test
        alerts.push(d.type() + ': ' + d.message()); (opts.confirm !== false && d.type() === 'confirm') ? d.accept() : d.dismiss().catch(() => {}); });
    // une seule règle réseau : bibliothèques servies en local, tout le reste coupé (Playwright donne la priorité à la dernière règle posée)
    const LOCAL = [[/cdn\.tailwindcss\.com/, 'tailwind.js'], [/three\.js\/r128\/three\.min\.js/, 'three.min.js'], [/jspdf\/2\.5\.1\/jspdf\.umd\.min\.js/, 'jspdf.umd.min.js'],
        [/polygon-clipping@0\.15\.7\//, 'polygon-clipping.umd.min.js'], [/leaflet@1\.9\.4\/dist\/leaflet\.js/, 'leaflet.js'], [/leaflet@1\.9\.4\/dist\/leaflet\.css/, 'leaflet.css']];
    await p.route(/^https?:\/\//, r => { const u = r.request().url(), m = LOCAL.find(([re]) => re.test(u));
        if (!m || opts.offline) return r.abort();   /* offline : aucun accès réseau, l'appli doit vivre avec son dossier lib/ */
        return r.fulfill({ body: V(m[1]), contentType: m[1].endsWith('.css') ? 'text/css' : 'application/javascript' }); });
    if (opts.fresh !== false) await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
    await p.goto('file://' + APP);
    // le logo d'accueil couvre l'écran ~4 s : on attend qu'il parte (ou on le retire)
    await p.waitForFunction(() => typeof shapes !== 'undefined' && typeof draw === 'function', null, { timeout: 15000 });
    await p.evaluate(() => { const s = document.getElementById('mc-splash'); if (s) s.remove(); });
    await p.waitForTimeout(400);
    return { p, ctx, errs, alerts, cons };
}

// gestes : H.ev, H.click(point écran), H.W(x,y en m → point écran), H.key, H.tool, H.Y, et pour les tutos H.S/H.next/H.state
function helpers(pg, rec) {
    const { p } = pg; const H = Object.assign({}, pg); H.seq = [];
    H.ev = (f, a) => p.evaluate(f, a);
    H.wait = (ms) => p.waitForTimeout(ms);
    H.shot = (name, clip) => p.screenshot(Object.assign({ path: path.join(OUT, name + '.png') }, clip ? { clip } : {}));
    H.jl = async () => { try { await p.waitForTimeout(250); const r = await H.ev(() => { const b = document.querySelector('#mt-bubble'); if (!b) return ''; return [...b.querySelectorAll('.mt-do ol > li')].map(li => li.classList.contains('ck') ? '✓' : '·').join(''); }); if (r && H.seq[H.seq.length - 1] !== r) H.seq.push(r); } catch (e) {} };
    H.S = () => H.ev(() => { const c = canvas.getBoundingClientRect(); return (tutoGhost && tutoGhost.pts || []).map(q => { const s = worldToScreen(q.x, q.y); return { x: s.x + c.left, y: s.y + c.top }; }); });
    H.scr = (w) => H.ev(w => { const c = canvas.getBoundingClientRect(); const s = worldToScreen(w.x, w.y); return { x: s.x + c.left, y: s.y + c.top }; }, w);
    // point du plan en mètres (Y vers le haut) → point écran
    H.W = (x, y) => H.ev(([x, y]) => { const c = canvas.getBoundingClientRect(); const s = worldToScreen(mmToWorld(x * 1000), -mmToWorld(y * 1000)); return { x: s.x + c.left, y: s.y + c.top }; }, [x, y]);
    H.click = async (q, opt) => { await p.mouse.move(q.x + 1, q.y + 1); await p.waitForTimeout(30); await p.mouse.move(q.x, q.y); await p.waitForTimeout(50); await p.mouse.click(q.x, q.y, opt); await p.waitForTimeout(100); await H.jl(); };
    H.key = async (t) => { for (const ch of t) { if (ch === ' ') await p.keyboard.press('Space'); else if (ch === '\n') await p.keyboard.press('Enter'); else await p.keyboard.type(ch); } await p.waitForTimeout(120); await H.jl(); };
    H.press = async (k) => { await p.keyboard.press(k); await p.waitForTimeout(100); };
    H.tool = async (id) => { await H.ev(id => { const b = document.getElementById(id); if (!b) throw new Error('bouton absent : ' + id); b.click(); }, id); await p.waitForTimeout(150); await H.jl(); };
    H.Y = async (vals) => { await p.waitForTimeout(150); await H.ev(v => { if (document.getElementById('selparam-modal').classList.contains('hidden')) openSelectionParamModal(); for (const k in v) { const e = document.getElementById(k); if (!e) throw new Error('champ absent : ' + k); if (e.type === 'checkbox') e.checked = v[k]; else e.value = v[k]; } applySelectionLayer(); }, vals); await p.waitForTimeout(200); };
    H.next = async () => { await H.ev(() => document.querySelector('#mt-acts button[data-a=next]').click()); await p.waitForTimeout(300); H.seq = []; await H.jl(); };
    H.state = async (label) => { await p.waitForTimeout(500); const r = await H.ev(() => [document.querySelector('#mt-bubble .mt-t').textContent, document.querySelector('#mt-bubble').classList.contains('done'), document.querySelectorAll('#mt-bubble .mt-do ol > li').length]); await H.jl();
        if (r[2]) rec.ok('étape « ' + r[0] + ' »', r[1], H.seq.join(' → '));   // une étape sans geste à faire (intro, bravo) n'est pas un contrôle
        H.seq = []; return r[1]; };
    // plan vierge, en mètres, vue centrée sur 0,0 ; renvoie le calque actif
    H.blank = (pxPerM) => H.ev((k) => { if (typeof layoutOn !== 'undefined' && layoutOn) toggleLayout(false); setMode('select-box'); shapes = []; selectedShapes = []; geoOrigin = { x: 0, y: 0 }; invalidateCache(); camera.zoom = k / mmToWorld(1000); const r = canvas.getBoundingClientRect(); camera.x = 150; camera.y = r.height - 150; saveState(); draw(); return activeLayerId; }, pxPerM || 25);
    // recharge la page (stockage du navigateur conservé) et attend qu'elle soit prête
    H.reload = async () => { await p.reload(); await p.waitForFunction(() => typeof shapes !== 'undefined' && typeof draw === 'function', null, { timeout: 15000 });
        await p.evaluate(() => { const s = document.getElementById('mc-splash'); if (s) s.remove(); }); await p.waitForTimeout(800); };
    return H;
}

module.exports = { launch, openPage, helpers, OUT, APP };
