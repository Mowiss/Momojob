// Tuto « build » joué de bout en bout : chaque étape doit se valider.
module.exports = { name: 'tuto-6-dieu', tuto: 'build', timeout: 300, run: async (H, t) => {
const D_=require('../lib/harness').OUT;  const {p,ev}=H; let P;
 const W=(x,y)=>ev(([x,y])=>{ const m=mmToWorld(1000); const c=canvas.getBoundingClientRect(); const o=(typeof tutoOrigin!=='undefined'&&tutoOrigin)||{x:0,y:0}; return null; },[x,y]);
 await H.state('intro'); await H.next();
 P=await H.S(); await H.tool('btn-dalle'); await H.click(P[0]); await p.mouse.move(P[0].x+60,P[0].y-60); await H.key('4 3 '); await H.state('dalle'); await H.next();
 // traits de construction
 const sc=await ev(()=>{ const d=shapes.find(s=>s.name==='Dalle'); const c=canvas.getBoundingClientRect(); const a=d.points[0], b=d.points[1], q=d.points[3]; const S=(x,y)=>{const s=worldToScreen(x,y);return {x:s.x+c.left,y:s.y+c.top};}; return {bas:S((a.x+b.x)/2,(a.y+b.y)/2), gauche:S((a.x+q.x)/2,(a.y+q.y)/2), mid:S((a.x+b.x+q.x*2)/4+ (b.x-a.x)/4,(a.y+q.y)/2)}; });
 console.log(JSON.stringify(sc));
 const out=await ev(()=>{ const d=shapes.find(s=>s.name==='Dalle'); const c=canvas.getBoundingClientRect(); const a=d.points[0], b=d.points[1], q=d.points[3]; const S=(x,y)=>{const s=worldToScreen(x,y);return {x:s.x+c.left,y:s.y+c.top};}; const ux=(b.x-a.x), uy=(q.y-a.y); return {bas2:S(a.x-ux*0.15,a.y), gauche2:S(a.x,a.y-uy*0.15)}; });
 await p.keyboard.press('Escape'); await H.tool('btn-cline2'); await H.click(sc.bas); await H.click(sc.gauche); await p.keyboard.press('Escape');
 await H.tool('btn-offset'); await H.key('0,2 '); await H.click(out.bas2); await p.mouse.move(sc.mid.x,sc.mid.y); await H.click(sc.mid);
 await H.click(out.gauche2); await p.mouse.move(sc.mid.x,sc.mid.y); await H.click(sc.mid);
 await H.key('2,8 '); await H.click(out.bas2); await p.mouse.move(sc.mid.x,sc.mid.y); await H.click(sc.mid);
 await H.key('3,8 '); await H.click(out.gauche2); await p.mouse.move(sc.mid.x,sc.mid.y); await H.click(sc.mid);
 await H.state('traits');
 console.log(await ev(()=>D3C.lines.map(L=>[L.p.x.toFixed(2),L.p.y.toFixed(2),L.d.x.toFixed(2),L.d.y.toFixed(2)].join(','))));
 await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await H.next();
 P=await H.S(); await H.tool('btn-poteau'); for(const q of P) await H.click(q); await p.keyboard.press('Escape'); await H.state('poteaux'); await H.next();
 P=await H.S(); console.log('beamP',JSON.stringify(P)); await H.tool('btn-solid-beam'); await H.click(P[0]); await H.click(P[1]); await p.waitForTimeout(300); await ev(()=>{ const b=document.querySelector('#selparam-modal button.bg-blue-600')||[...document.querySelectorAll('#selparam-modal button')].find(x=>x.textContent.trim()==='Appliquer'); b&&b.click(); }); await p.waitForTimeout(200);
 await H.tool('btn-solid-beam'); await H.click(P[2]); await H.click(P[3]); await p.waitForTimeout(300); await ev(()=>{ const b=[...document.querySelectorAll('#selparam-modal button')].find(x=>x.textContent.trim()==='Appliquer'); b&&b.click(); }); await H.state('poutres'); await H.next();
 P=await H.S(); await p.keyboard.press('Escape'); await H.tool('btn-cut'); await H.click(P[0]); await H.click(P[1]); await H.click({x:P[0].x+80,y:(P[0].y+P[1].y)/2}); await H.state('coupe'); await p.screenshot({path:D_+'/t241_coupe.png'}); await H.next();
 await ev(()=>document.querySelector('#rose-svg .rose-eye').dispatchEvent(new MouseEvent('click',{bubbles:true}))); await p.waitForTimeout(1500); await H.state('3d'); await H.next();
 await H.tool('v3-mes-btn'); await ev(()=>{ window.d3Measured=(window.d3Measured||0)+1; }); await H.state('mesure'); await H.next();
 await H.tool('v3-col-btn'); await p.waitForTimeout(2500); console.log('col', await ev(()=>d3Col.length)); await ev(()=>{ const r=document.querySelector('#t2-panel [onclick*="d3ColPick"]'); r&&r.click(); }); await H.state('collisions'); await p.screenshot({path:D_+'/t241_col.png'}); await H.next(); await H.state('fin');

} };
