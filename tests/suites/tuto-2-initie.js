// Tuto « adv » joué de bout en bout : chaque étape doit se valider.
module.exports = { name: 'tuto-2-initie', tuto: 'adv', timeout: 300, run: async (H, t) => {
 const {p,ev}=H; const D=require('../lib/harness').OUT, errs=H.errs; const S=H.S, click=H.click, key=H.key, next=H.next, tool=H.tool, state=H.state; const b={close:async()=>{}};
await ev(()=>startTuto('adv')); await p.waitForTimeout(1200);
await next(); await next();
// calque Parking
await ev(()=>openLayerModal()); await p.waitForTimeout(150); await p.fill('#new-layer-name','Parking'); await p.press('#new-layer-name','Enter'); await p.waitForTimeout(150); await ev(()=>closeLayerModal()); await state('calque');
await next();
let P=await S(); await tool('btn-rect'); await click(P[0]); await p.mouse.move(P[0].x+80,P[0].y-80); await key('20 12 '); await state('emprise');
await next();
await ev(()=>{ if(orthoMode) toggleOrtho(); t2Polar.on=true; t2Polar.step=15; refreshPolarBtn(); });
P=await S(); await tool('btn-line'); await click(P[0]); await p.mouse.move(P[0].x+60,P[0].y-58); await p.waitForTimeout(80); await key('4 '); await state('acces');
await next();
P=await S(); await tool('btn-rect'); await click(P[0]); await p.mouse.move(P[0].x+40,P[0].y-60); await key('2,5 5 '); await state('place');
await next();
await ev(()=>{ setMode('select-box'); const k=mmToWorld(1000); selectedShapes=[shapes.filter(s=>s.type==='poly'&&!s.open).pop()]; startArray(); document.getElementById('ar-nx').value='6'; document.getElementById('ar-ny').value='1'; document.getElementById('ar-dx').value='2,5'; t2ArrRead(); t2ArrayApply(); }); await state('reseau');
await next();
P=await S(); await tool('btn-line'); await click(P[0]); await click(P[1]); await state('haie');
await next();
await tool('btn-divide'); const mid=await ev(()=>{ const c=canvas.getBoundingClientRect(); const l=shapes.filter(s=>s.type==='line').pop(); const q=worldToScreen((l.x1+l.x2)/2+300,l.y1); return {x:q.x+c.left,y:q.y+c.top}; }); await click(mid);
await ev(()=>{ t2.div.mode='n'; t2.div.n=4; t2.div.ends=false; t2.div.what='block'; t2.div.blk='arbre'; t2DivPanel(); t2DivApply(); }); await state('arbres');
await next();
P=await S(); await tool('btn-dim-ortho'); const c0=P[0], c1=P[1]; await click(c0); await click(c1); await click({x:(c0.x+c1.x)/2,y:c0.y+40}); await state('cote');
await next();
P=await S(); await tool('btn-circle'); await click(P[0]); await key('0,5 '); await state('regard');
await next();
await tool('btn-dim-dia'); const rg=await ev(()=>{ const c=canvas.getBoundingClientRect(); const s=shapes.filter(s=>s.type==='circle').pop(); const q=worldToScreen(s.x+s.r,s.y); return {x:q.x+c.left,y:q.y+c.top}; }); await click(rg); await click({x:rg.x+60,y:rg.y-30}); await state('dimr');
await next();
await tool('btn-text'); await click({x:rg.x-60,y:rg.y+40}); await p.keyboard.type('PARKING'); await p.keyboard.press('Enter'); await p.waitForTimeout(200); await state('texte');
await next();
P=await S(); await tool('btn-detail'); await click(P[0]); await click(P[1]); await p.keyboard.type('Entrée'); await p.keyboard.press('Enter'); await p.waitForTimeout(200); await state('infobulle'); await p.screenshot({path:D+'/t161.png'});


} };
