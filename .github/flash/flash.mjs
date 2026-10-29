// MomoJOB — agrège des flux RSS/Atom en un petit flash.json (titres + liens), sans dépendance.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
const [,, cfgPath = 'sources.json', outPath = 'flash.json'] = process.argv;
const cfg = JSON.parse(await readFile(cfgPath, 'utf8'));
const MAX = cfg.maxParSource ?? 12, AGE = (cfg.ageMaxHeures ?? 48) * 3600e3;
const ent = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;|&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, 'i')); return m ? ent(m[1]) : ''; };
function parse(xml) {
  const items = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map(m => m[0]);
  if (items.length) return items.map(x => ({ title: tag(x, 'title'), link: tag(x, 'link') || tag(x, 'guid'), date: tag(x, 'pubDate') || tag(x, 'dc:date') }));
  return [...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)].map(m => m[0]).map(x => ({
    title: tag(x, 'title'), link: (x.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || '', date: tag(x, 'updated') || tag(x, 'published') }));
}
const out = [], log = [];
for (const s of cfg.sources.filter(s => s.actif !== false && s.url)) {
  try {
    const r = await fetch(s.url, { headers: { 'user-agent': 'MomoJOB-flash/1.0 (+github actions)', accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const now = Date.now();
    const it = parse(await r.text()).filter(x => x.title && x.link).map(x => ({ ...x, t: Date.parse(x.date) || now }))
      .filter(x => now - x.t < AGE).sort((a, b) => b.t - a.t).slice(0, MAX);
    it.forEach(x => out.push({ cat: s.cat, src: s.src, title: x.title.slice(0, 220), link: x.link, date: new Date(x.t).toISOString() }));
    log.push(`OK   ${s.src} : ${it.length} titre(s)`);
  } catch (e) { log.push(`ÉCHEC ${s.src} (${s.url}) : ${e.message}`); }
}
await mkdir(dirname(outPath) || '.', { recursive: true });
await writeFile(outPath, JSON.stringify({ generated: new Date().toISOString(), items: out }, null, 1));
console.log(log.join('\n') + `\n→ ${out.length} titre(s) dans ${outPath}`);
