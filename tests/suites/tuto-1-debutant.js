// Tuto « base » joué de bout en bout : chaque étape doit se valider.
module.exports = { name: 'tuto-1-debutant', tuto: 'base', timeout: 300, run: async (H, t) => {
 const {p,ev}=H; const D=require('../lib/harness').OUT, errs=H.errs; const S=H.S, click=H.click, key=H.key, next=H.next, tool=H.tool, state=H.state; const b={close:async()=>{}};
await next(); await next(); // intro, navigation
// 3 demi M
let P=await S(); await tool('btn-pline'); for (const q of P) await click(q); await p.keyboard.press('Space'); await state('demi-M');
await next();
// 4 miroir : sélectionner la demi-lettre
P=await S(); await p.keyboard.press('Escape');
const half=await ev(()=>{ const s=shapes.find(x=>x.type==='poly'&&x.open); const c=canvas.getBoundingClientRect(); const a=s.points[0], b=s.points[1]; const q=worldToScreen((a.x+b.x)/2,(a.y+b.y)/2); return {x:q.x+c.left,y:q.y+c.top}; });
await click(half); await tool('btn-mirror'); await click(P[0]); await click(P[1]); await p.keyboard.press('Space'); await state('miroir');
await next();
// 5 joindre : sélectionner les 2 moitiés
await ev(()=>{ selectedShapes=shapes.filter(x=>x.type==='poly'&&x.open); }); await tool('btn-join'); await state('joindre');
await next();
// 6 cercle
P=await S(); await tool('btn-circle'); await click(P[0]); await key('2 '); await state('O');
await next();
// 7 sélection fenêtre
P=await S(); await p.keyboard.press('Escape'); await click(P[0]); await p.mouse.move(P[1].x,P[1].y,{steps:4}); await click(P[1]); await state('fenetre');
await next();
// 8 copier
P=await S(); await tool('btn-copy'); await click(P[0]); await click(P[1]); await p.keyboard.press('Space'); await state('copier');
await next();
// 9 arc : centre, départ en bas (P[2]), 270
P=await S(); await tool('btn-arc'); await click(P[0]); await click(P[2]);
 { const c=P[0], R=Math.hypot(P[2].x-c.x,P[2].y-c.y), a0=Math.atan2(P[2].y-c.y,P[2].x-c.x); for(let d=0; d<=270; d+=10){ const a=a0+d*Math.PI/180; await p.mouse.move(c.x+R*Math.cos(a), c.y+R*Math.sin(a)); await p.waitForTimeout(20);} await click(P[1]); }
 await state('C');
await next();
// 10 A
P=await S(); await tool('btn-pline'); for (const q of P) await click(q); await p.keyboard.press('Space'); await state('A');
await next();
// 11 barre
P=await S(); await tool('btn-line'); await click(P[0]); await click(P[1]); await state('barre');
await next();
// 12 couper : cliquer les dépassements
const ov=await ev(()=>{ const c=canvas.getBoundingClientRect(); const l=shapes.filter(x=>x.type==='line').pop(); const L=Math.hypot(l.x2-l.x1,l.y2-l.y1); const f=(t)=>{const q=worldToScreen(l.x1+(l.x2-l.x1)*t,l.y1+(l.y2-l.y1)*t);return {x:q.x+c.left,y:q.y+c.top};}; return [f(0.04),f(0.96)]; });
await tool('btn-trim'); await click(ov[0]); await click(ov[1]); await state('couper');
await next();
// 13 rectangle D
P=await S(); await tool('btn-rect'); await click(P[0]); await p.mouse.move(P[0].x+80,P[0].y-80); await key('2,5 4 '); await state('rect');
await next();
// 14 éclater
await p.keyboard.press('Escape'); await ev(()=>{ selectedShapes=[shapes.filter(x=>x.type==='poly'&&!x.open).pop()]; draw(); }); await tool('btn-ungroup'); await state('eclater');
await next();
// 15/16 arrondir
const edge=async(x1,y1,x2,y2,t)=>ev(([x1,y1,x2,y2,t])=>{ const c=canvas.getBoundingClientRect(); const ls=shapes.filter(s=>s.type==='line'); const q0=ls.map(l=>l); return null;},[x1,y1,x2,y2,t]);
const pickLine=async(pred)=>ev((ps)=>{ const c=canvas.getBoundingClientRect(); const fn=new Function('l','return '+ps); const l=shapes.filter(s=>s.type==='line').filter(fn).pop(); const q=worldToScreen(l.x1+(l.x2-l.x1)*0.3,l.y1+(l.y2-l.y1)*0.3); return {x:q.x+c.left,y:q.y+c.top}; }, pred);
// top edge: horizontal line with smallest y ; right edge: vertical with max x
const topE = await pickLine("Math.abs(l.y1-l.y2)<1 && l.y1===Math.min(...shapes.filter(s=>s.type==='line'&&Math.abs(s.y1-s.y2)<1&&s.x1>0).map(s=>s.y1)) && Math.min(l.x1,l.x2)>shapes.filter(s=>s.type==='circle')[0].x");
await tool('btn-fillet');
console.log('LAST', await ev(()=>JSON.stringify(shapes.slice(-6).map(s=>[s.type, Math.round(s.x1||s.x||0), Math.round(s.y1||s.y||0), Math.round(s.x2||0), Math.round(s.y2||0)]))));
const geo=await ev(()=>{ const c=canvas.getBoundingClientRect(); const rect=shapes.filter(s=>s.type==='line'); return rect.slice(-4).map(l=>[l.x1,l.y1,l.x2,l.y2]); });
const sc=async(x,y)=>ev(([x,y])=>{const c=canvas.getBoundingClientRect();const q=worldToScreen(x,y);return {x:q.x+c.left,y:q.y+c.top};},[x,y]);
// lignes du rect : bas, droite, haut, gauche (ordre d'éclatement)
const [bot,right,top,left]=geo;
{ const P1={x:top[0]+(top[2]-top[0])*0.7,y:top[1]}, P2={x:right[0],y:right[1]+(right[3]-right[1])*0.3}; const s1=await sc(P1.x,P1.y), s2=await sc(P2.x,P2.y); console.log('HIT', JSON.stringify([s1,s2]), await ev(([a,b])=>[a,b].map(q=>{const e=document.elementFromPoint(q.x,q.y); return e.id||e.className;}),[s1,s2])); }
await click(await sc(top[0]+(top[2]-top[0])*0.7, top[1])); await click(await sc(right[0], right[1]+(right[3]-right[1])*0.3)); await key('1,25 '); console.log('DBG', await ev(()=>[document.getElementById('command-text').textContent, shapes.filter(s=>s.type==='arc').map(a=>[Math.round(worldToMm(a.r)),a.x,a.y]).join(';')])); await state('arrondi haut');
await next();
await click(await sc(bot[0]+(bot[2]-bot[0])*0.3, bot[1])); await click(await sc(right[0], right[1]+(right[3]-right[1])*0.12)); await p.keyboard.press('Space'); await state('arrondi bas');
await next();
// 17 soulignement
P=await S(); await tool('btn-line'); await click(P[0]); await p.keyboard.down('Shift'); await p.mouse.move(P[0].x+200,P[0].y+3); await p.waitForTimeout(80); await key('20 '); await p.keyboard.up('Shift'); await state('soulign');
await next();
// 18 longueur
await tool('btn-lengthen'); await key('28,5 ');
const endR=await ev(()=>{ const c=canvas.getBoundingClientRect(); const l=shapes.filter(s=>s.type==='line').pop(); const q=worldToScreen(Math.max(l.x1,l.x2)-200,l.y1); return {x:q.x+c.left,y:q.y+c.top}; });
await click(endR); await state('longueur');
await next();
// 19 décaler
await tool('btn-offset'); await key('0,5 ');
const ul=await ev(()=>{ const c=canvas.getBoundingClientRect(); const l=shapes.filter(s=>s.type==='line').sort((a,b)=>Math.hypot(b.x2-b.x1,b.y2-b.y1)-Math.hypot(a.x2-a.x1,a.y2-a.y1))[0]; const q=worldToScreen((l.x1+l.x2)/2,l.y1); return {x:q.x+c.left,y:q.y+c.top}; });
await click(ul); await click({x:ul.x,y:ul.y+30}); await state('decaler');
await next();
// 20 hachures
const cs=await ev(()=>{ const c=canvas.getBoundingClientRect(); return shapes.filter(s=>s.type==='circle').map(s=>{const q=worldToScreen(s.x,s.y);return {x:q.x+c.left,y:q.y+c.top};}); });
await tool('btn-hatch'); for (const q of cs) await click(q); await state('hachures');
await next(); await state('fin');
await p.screenshot({path:D+'/t160.png'});


} };
