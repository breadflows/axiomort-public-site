// Optional survival preparation; a proposed game mechanic, not a film-world rule.
export const MEALS={
  trail:{name:'Trail meal',description:'Restore 40 energy. Use half as much energy for four minutes of active play.',duration:240,cost:{berries:2,wood:1}},
  broth:{name:'Warming broth',description:'Restore 50 warmth. Halve exposure for two minutes of active play. Works with insulated lining.',duration:120,cost:{berries:2,wood:1}},
};
export const preparationState=()=>({meal:null,remaining:0});
export function prepareMeal(s,kind,fire){
  const recipe=MEALS[kind];
  if(!recipe||fire?.kind!=='fire'||Math.hypot(s.player.x-fire.x,s.player.z-fire.z)>5||Object.entries(recipe.cost).some(([k,n])=>s.inventory[k]<n))return false;
  for(const [k,n] of Object.entries(recipe.cost))s.inventory[k]-=n;
  s.preparation={meal:kind,remaining:recipe.duration};
  if(kind==='trail')s.food=Math.min(100,s.food+40);else s.warmth=Math.min(100,s.warmth+50);
  return true;
}
export function tickPreparation(s,dt){
  s.preparation.remaining=Math.max(0,s.preparation.remaining-dt);
  if(s.preparation.remaining===0)s.preparation.meal=null;
}
export const preparedEnergyRate=s=>s.preparation.meal==='trail'&&s.preparation.remaining>0?.5:1;
export const preparedExposureRate=s=>s.preparation.meal==='broth'&&s.preparation.remaining>0?.5:1;
