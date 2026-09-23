import {ECHO_ISLAND} from './layout.js';
// The opening takes place inside the Axio. Keep the observed save flag and
// mission ID stable even though the old miniature-prop introduction is gone.
export const ECHO_CRYSTAL={id:'echo-crystal',x:ECHO_ISLAND.x,z:ECHO_ISLAND.z-16,name:'Echo crystal'};
export const chapterState=()=>({observed:false,recovered:false,complete:false});
export function surveyRift(state){if(state.chapter.observed)return false;state.chapter.observed=true;return true;}
export function recoverCrystal(state){if(!state.visited.includes('echo')||state.chapter.recovered)return false;state.chapter.recovered=true;return true;}
export function returnCrystal(state,building){if(!state.chapter.recovered||state.chapter.complete||!['shelter','roof'].includes(building?.kind)||Math.hypot(building.x,building.z)>50)return false;state.chapter.complete=true;return true;}
export function neededResources(state,recipes,watchCost){
  if(!state.tools.includes('axe'))return recipes.axe.cost;
  if(!state.buildings.some(b=>['shelter','roof'].includes(b.kind))){
    if(!state.buildings.some(b=>b.kind==='bed'&&Math.hypot(b.x,b.z)<=50))return recipes.bed.cost;
    if(state.inventory.shelterKit>0)return {};
    if(!state.buildings.some(b=>b.kind==='bench'&&Math.hypot(b.x,b.z)<=50))return recipes.bench.cost;
    return recipes.shelterKit.cost;
  }
  if(!state.buildings.some(b=>b.kind==='bench'))return recipes.bench.cost;
  if(!state.buildings.some(b=>b.kind==='anchor'))return recipes.anchor.cost;
  if(!state.watch)return watchCost;
  return {};
}
