export const TRIALS=['maze','runner','zephyr'];
export const TRIAL_KEY='axiomort_trials_v1';
export const trialRecord=()=>({version:1,bestCleared:0,circuits:0});
export function chooseTrial(random=Math.random){return TRIALS[Math.min(2,Math.max(0,Math.floor(random()*TRIALS.length)))];}
export function readRecord(storage){try{const s=JSON.parse(storage.getItem(TRIAL_KEY));if(s?.version===1&&Number.isInteger(s.bestCleared)&&s.bestCleared>=0&&s.bestCleared<=6&&Number.isInteger(s.circuits)&&s.circuits>=0&&s.circuits<1e8)return {version:1,bestCleared:s.bestCleared,circuits:s.circuits};}catch{}return trialRecord();}
export function saveRecord(storage,record){storage.setItem(TRIAL_KEY,JSON.stringify(record));}
export const MAZE_WALLS=[{x:-3,y:-1,w:.6,h:5},{x:2,y:1,w:.6,h:5},{x:6,y:-2.8,w:.6,h:2.4}];
export function mazeMove(p,dx,dy){
  const blocked=(x,y)=>Math.abs(x)>8.4||Math.abs(y)>4.4||MAZE_WALLS.some(b=>Math.abs(x-b.x)<b.w/2+.28&&Math.abs(y-b.y)<b.h/2+.28);
  if(!blocked(p.x+dx,p.y))p.x+=dx;if(!blocked(p.x,p.y+dy))p.y+=dy;
}
export const overlap=(p,o)=>Math.abs(p.x-o.x)<.28+o.w/2&&p.y-.28<o.y+o.h/2&&p.y+.28>o.y-o.h/2;
