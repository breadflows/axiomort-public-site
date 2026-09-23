// A passage is part of the saved world, not a separately selected game mode.
export const RIFT_TYPES=['maze','runner','zephyr'];
export const PASSAGES=['haven-echo'];
export const riftState=()=>({passages:{}});
export function validateRifts(raw){
  if(!raw||!raw.passages||typeof raw.passages!=='object'||Array.isArray(raw.passages))throw Error('Invalid rift progress.');
  const result=riftState();
  for(const [id,p] of Object.entries(raw.passages)){
    if(!PASSAGES.includes(id)||!p||!RIFT_TYPES.includes(p.trial)||typeof p.cleared!=='boolean')throw Error('Invalid rift passage.');
    result.passages[id]={trial:p.trial,cleared:p.cleared};
  }
  return result;
}
export function encounterRift(state,id,random=Math.random){
  if(!state.watch||!PASSAGES.includes(id))return null;
  const existing=state.rifts.passages[id];
  if(existing)return existing.cleared?null:existing.trial;
  const cleared=new Set(Object.values(state.rifts.passages).filter(p=>p.cleared).map(p=>p.trial));
  const pool=RIFT_TYPES.filter(type=>!cleared.has(type));
  if(!pool.length)return null;
  const trial=pool[Math.min(pool.length-1,Math.max(0,Math.floor(random()*pool.length)))];
  state.rifts.passages[id]={trial,cleared:false};return trial;
}
export function clearRift(state,id,trial){
  const passage=state.rifts.passages[id];
  if(!state.watch||!passage||passage.trial!==trial||passage.cleared)return false;
  passage.cleared=true;return true;
}
