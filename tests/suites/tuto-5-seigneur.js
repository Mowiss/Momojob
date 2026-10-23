// Tuto « model » joué de bout en bout : chaque étape doit se valider.
module.exports = { name: 'tuto-5-seigneur', tuto: 'model', timeout: 300, run: async (H, t) => {
const D_=require('../lib/harness').OUT;  const {p,ev}=H; let P;
 await H.state('intro'); await H.next();
 P=await H.S(); await H.tool('btn-dalle'); await H.click(P[0]); await p.mouse.move(P[0].x+60,P[0].y-60); await H.key('5 4 '); await H.state('dalle');
 console.log(await ev(()=>shapes.filter(s=>s.solid).map(s=>s.name+':'+s.solid.H))); await H.next();
 P=await H.S(); await p.keyboard.press('Escape'); await H.tool('btn-paroi'); await p.waitForTimeout(300); await ev(()=>document.querySelector('#menu-blocks [onclick^=startWall]').click()); await p.waitForTimeout(300); console.log('P',JSON.stringify(P)); for(const q of P) await H.click(q); await H.click(P[0]); console.log(await ev(()=>[mode, shapes.length, shapes.map(s=>s.type).join()])); await p.screenshot({path:D_+'/t240_w.png'}); await p.keyboard.press('Escape'); await H.state('murs'); await H.next();
 await ev(()=>{ const g=shapes.find(x=>x.wallMat).groupId; selectedShapes=shapes.filter(x=>x.groupId===g); }); await H.Y({'sp-wzb':'0','sp-wzt':'2,5'}); await H.state('niveaux'); await H.next();
 P=await H.S(); await p.keyboard.press('Escape'); await H.tool('btn-opening'); await H.click(P[0]); await p.mouse.move(P[0].x+40,P[0].y); await H.key('1,2 '); await p.waitForTimeout(200);
 await ev(()=>{ document.querySelector('input[name=op-k][value=fen]').click(); const b=[...document.querySelectorAll('#topo-modal button')].find(x=>x.textContent.trim()==='Valider'); b.click(); }); await H.state('fenetre'); await H.next();
 P=await H.S(); await H.tool('btn-opening'); await H.click(P[0]); await p.mouse.move(P[0].x,P[0].y-40); await H.key('0,9 '); await p.waitForTimeout(200);
 await ev(()=>{ document.querySelector('input[name=op-k][value=porte]').click(); const b=[...document.querySelectorAll('#topo-modal button')].find(x=>x.textContent.trim()==='Valider'); b.click(); }); await H.state('porte'); await H.next();
 P=await H.S(); await H.tool('btn-solid-beam'); await H.click(P[0]); await H.click(P[1]); await p.waitForTimeout(200); await H.Y({'sp-z1':'4,7','sp-z2':'4,7'}); await H.state('poutre'); await H.next();
 P=await H.S(); await p.keyboard.press('Escape'); await H.tool('btn-solid-roof'); await H.click(P[0]); await p.mouse.move(P[0].x+60,P[0].y-60); await H.key('5 4 '); await p.waitForTimeout(300);
 await ev(()=>{ document.querySelector('input[name=rf-p][value="2"]').click(); document.getElementById('rf-dir').value='long'; document.getElementById('rf-he').value='2,5'; document.getElementById('rf-hf').value='5'; document.getElementById('rf-fill').checked=true; document.getElementById('rf-db').value='0,3'; const b=[...document.querySelectorAll('#topo-modal button')].find(x=>/Créer le toit/.test(x.textContent)); b.click(); }); await H.state('toit'); await H.next();
 await ev(()=>{ shapes.filter(x=>x.solid&&x.solid.kind==='roof').forEach(r=>r.tex='tuile'); draw(); }); await H.state('tuiles'); await H.next();
 await ev(()=>toggle3D&&toggle3D()); await p.waitForTimeout(4000); await p.screenshot({path:D_+'/t240_3d.png'});
 await ev(()=>{ V3.theta=Math.PI*0.15; V3.phi=1.35; }); await ev(()=>{ try{ animate3D(Math.PI*1.1,0.25);}catch(e){} }); await p.waitForTimeout(1200); await p.screenshot({path:D_+'/t240_3db.png'});
 await ev(()=>close3D()); await p.waitForTimeout(400); await H.state('admirez');
 // déplacer toute la cabane de +3 m en x : les ouvertures suivent
 const before=await ev(()=>shapes.flatMap(s=>(s.openings||[]).map(o=>o.pts[0].x))); console.log('a0', await ev(()=>shapes.flatMap(s=>(s.openings||[]).map(o=>(o.a.x/mmToWorld(1000)).toFixed(2)+'/'+(o.b.x/mmToWorld(1000)).toFixed(2)))));
 await ev(()=>{ const m=mmToWorld(1000); shapes.forEach(s=>{ if(s.wallMat||s.groupId) translateShape(s,3*m,0); }); saveState(); draw(); });
 const after=await ev(()=>shapes.flatMap(s=>(s.openings||[]).map(o=>o.pts[0].x)));
 console.log('openings dx (m)', await ev(([a,b])=>b.map((x,i)=>((x-a[i])/mmToWorld(1000)).toFixed(2)),[before,after]));
 // clic simple sur la fenêtre
 const c=await ev(()=>{ const o=shapes.flatMap(s=>s.openings||[])[0]; const r=canvas.getBoundingClientRect(); const x=(o.pts[0].x+o.pts[2].x)/2, y=(o.pts[0].y+o.pts[2].y)/2; const q=worldToScreen(x,y); return {x:q.x+r.left,y:q.y+r.top}; });
 await p.mouse.click(c.x,c.y); await p.waitForTimeout(300); console.log('dialog', await ev(()=>document.getElementById('tm-title').textContent));
 await ev(()=>{ document.getElementById('op-shift').value='0,5'; [...document.querySelectorAll('#tm-actions button')].find(b=>b.textContent==='Valider').click(); });
 console.log('shifted', await ev(()=>{ const o=shapes.flatMap(s=>s.openings||[])[0]; return (o.a.x/mmToWorld(1000)).toFixed(2); }));
 // modifier la toiture via Y
 await ev(()=>{ const r=shapes.find(s=>s.roofDef); selectedShapes=shapes.filter(s=>s.groupId===r.groupId); openSelectionParamModal(); }); await p.waitForTimeout(300);
 await ev(()=>{ [...document.querySelectorAll('#selparam-modal .sp-act')].find(b=>/Modifier la toiture/.test(b.textContent)).click(); }); await p.waitForTimeout(300);
 await ev(()=>{ document.getElementById('rf-db').value='0,6'; [...document.querySelectorAll('#tm-actions button')].find(b=>/Mettre à jour/.test(b.textContent)).click(); }); await p.waitForTimeout(300);
 console.log('roof', await ev(()=>{ const R=shapes.filter(s=>s.solid&&s.solid.kind==='roof'); return R.length+' pans db '+R[0].roofDef.o.db+' texU '+R[0].texU; }));
 await H.next(); await H.state('fin');

} };
