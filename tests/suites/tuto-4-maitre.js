// Tuto « cub » joué de bout en bout : chaque étape doit se valider.
module.exports = { name: 'tuto-4-maitre', tuto: 'cub', timeout: 300, run: async (H, t) => {
 const {p,ev}=H; let P;
 await ev(()=>document.querySelector('#mt-bubble button[data-a=act]').click()); await H.state('terrain'); await H.next();
 P=await H.S(); await H.tool('btn-topo'); await H.click(P[0]); await H.key('102,4 '); await H.state('point'); await H.next();
 await H.next(); // 3D
 await H.next(); // courbes
 P=await H.S(); await H.tool('btn-rect'); await H.click(P[0]); await p.mouse.move(P[0].x+60,P[0].y-60); await H.key('20 12 '); await H.state('emprise'); await H.next();
 await p.keyboard.press('Escape'); await ev(()=>{ selectedShapes=[shapes.filter(x=>x.type==='poly'&&!x.open).pop()]; draw(); }); await H.Y({'sp-zall':'102'}); await H.state('niveau'); await H.next();
 await H.Y({'tj-rh-u':'1','tj-rl-u':'2'}); await H.state('talus'); await H.next();
 await ev(()=>{ const r=selectedShapes[0]; r.struct={layers:[{mat:matCatalog[0].code,e:20},{mat:matCatalog[1].code,e:30}],ff:true}; saveState(); }); await H.state('structure'); await H.next();
 await H.next(); await H.next();
 P=await H.S(); await p.keyboard.press('Escape'); await H.tool('btn-profile'); await H.click(P[0]); await H.click(P[1]); await p.keyboard.press('Space'); await p.waitForTimeout(800); await H.state('profil');

} };
