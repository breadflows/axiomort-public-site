import {ECHO_ISLAND} from './layout.js';
// Survival equipment and wreck sites are proposed game adaptations, not film canon.
export const WRECKS = [
  {id:'harness',name:'Salvage cradle',x:ECHO_ISLAND.x+14,z:ECHO_ISLAND.z-6,title:'Salvage harness',direction:'East · broken cargo ribs',description:'Recover two extra timber, stone, fibre or salvage from each gathering spot. Build more with fewer gathering trips.'},
  {id:'lining',name:'Weather station',x:ECHO_ISLAND.x-13,z:ECHO_ISLAND.z-6,title:'Insulated lining',direction:'West · amber weather mast',description:'Lose 55% less warmth in the cold or at night. Stay out longer before returning to shelter.'},
];
export const expeditionState=()=>({recovered:[],equipped:null,tracked:'harness',returned:false});
export function recoverEquipment(s,id){
  if(!s.visited.includes('echo')||!WRECKS.some(w=>w.id===id)||s.expedition.recovered.includes(id))return false;
  s.expedition.recovered.push(id);s.expedition.equipped=id;return true;
}
export function equipAtBench(s,id,bench){
  if(bench?.kind!=='bench'||Math.hypot(s.player.x-bench.x,s.player.z-bench.z)>3.5||!s.expedition.recovered.includes(id))return false;
  s.expedition.equipped=id;return true;
}
export function returnEquipment(s,b){
  if(!s.expedition.recovered.length||s.expedition.returned||!['shelter','roof'].includes(b?.kind)||Math.hypot(b.x,b.z)>50)return false;
  s.expedition.returned=true;return true;
}
export const gatheringBonus=(s,type)=>s.expedition.equipped==='harness'&&['wood','stone','fiber','scrap'].includes(type)?2:0;
export const exposureRate=s=>s.expedition.equipped==='lining'?.38*.45:.38;
export function trackedWreck(s){return WRECKS.find(w=>w.id===s.expedition.tracked&&!s.expedition.recovered.includes(w.id))||WRECKS.find(w=>!s.expedition.recovered.includes(w.id));}
