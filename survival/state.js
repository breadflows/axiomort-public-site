import {missionState,validateMissions,missionObjective} from './missions.js?v=20260923-inside-axio';
import {riftState,validateRifts} from './rifts.js';
import {preparationState} from './preparation.js';
import {expeditionState,gatheringBonus} from './expedition.js?v=20260923-sky-route';
import {chapterState} from './chapter.js?v=20260923-inside-axio';
import {ISLAND_LAYOUT,ECHO_ISLAND,OLD_ECHO,migrateEchoPoint,shoreRadius} from './layout.js';
// New survival systems. Creative source: Desktop/AXIOMORT; see sources.json.
export const SAVE_KEY = 'axiomort_survival_v1';
export const BACKUP_KEY = SAVE_KEY + '_backup';
export const SAVE_VERSION = 9;
export const ITEMS = {wood:'Timber',stone:'Stone',fiber:'Fibre',scrap:'VPS salvage',crystal:'Rift crystal',berries:'Berries',shelterKit:'Storm shelter kit'};
export const RECIPES = {
  axe: {name:'Field axe',description:'Salvaged stone, a branch, a little ingenuity. Gather twice as much.',cost:{wood:3,stone:3,fiber:2},kind:'tool'},
  bed: {name:'Bed',description:'A place to rest. Upgrade it to a storm shelter once you have a workbench.',cost:{wood:4,fiber:3},radius:3.3},
  shelter: {name:'Storm shelter',description:'A bed upgraded with a workbench-made shelter kit. Restores warmth and becomes your return point.',cost:{wood:10,fiber:6},upgradeFrom:'bed',radius:3.3},
  shelterKit: {name:'Storm shelter kit',description:'Build this at a workbench, then take it to a placed bed to upgrade it.',cost:{wood:6,fiber:3},kind:'item',station:'bench'},
  fire: {name:'Campfire',description:'Restores warmth nearby. Use it to prepare a trail meal or warming broth before an expedition.',cost:{wood:4,stone:4},radius:1.2},
  bench: {name:'Workbench',description:'A place to turn wreckage into useful equipment.',cost:{wood:6,stone:4},radius:1.6},
  garden: {name:'Berry planter',description:'Grow berries for eating and campfire meals. Harvest every 45 seconds of play.',cost:{wood:6,fiber:4},radius:1.5},
  anchor: {name:'Stability anchor',description:'Hold one small piece of reality together. Enables VPS watch repair.',cost:{stone:6,scrap:4,crystal:2},requires:'bench',station:'bench',radius:1.4},
  foundation: {name:'Timber foundation',description:'A walkable four-metre floor. Snaps beside another foundation.',cost:{wood:6,stone:2},station:'bench',radius:2,modular:true},
  wall: {name:'Timber wall',description:'Clad one edge of a foundation. Q chooses the edge.',cost:{wood:4,fiber:1},radius:2,modular:true,attachment:true,requires:'bench',station:'bench'},
  doorway: {name:'Open doorway',description:'A wide entrance you can walk through. Snaps to a foundation edge.',cost:{wood:3,fiber:1},radius:2,modular:true,attachment:true,requires:'bench',station:'bench'},
  roof: {name:'Canopy roof',description:'Posts and a canvas roof. Gives warmth underneath and creates a home.',cost:{wood:4,fiber:4},station:'bench',radius:2,modular:true,attachment:true},
};
export const WATCH_COST = {scrap:4,crystal:2};
export const ISLANDS = ISLAND_LAYOUT;
export function terrain(x,z){
  let best=-6;
  for(const island of ISLANDS){const dx=x-island.x,dz=z-island.z;const r=Math.hypot(dx,dz)/shoreRadius(island,Math.atan2(dz,dx));
    if(r>=1)continue;
    const mound=6*Math.pow(Math.max(0,1-r*r),1.1)-2;
    const hills=(Math.sin(dx*.12)*Math.cos(dz*.1)*1.3+Math.sin(dx*.26+dz*.15)*.4)*Math.max(0,1-r);
    const rim=island.id==='haven'?(Math.sin(Math.atan2(dz,dx)*2+.3)*3.2+Math.sin(Math.atan2(dz,dx)*5-1)*1.4)*r*r:0;
    best=Math.max(best,(island.elevation||0)+mound+hills+rim);
  }return best;
}
function legacyHavenTerrain(x,z){
  const r=Math.hypot(x,z)/ISLANDS[0].radius;
  if(r>=1)return -6;
  const mound=6*Math.pow(Math.max(0,1-r*r),1.1)-2;
  const hills=(Math.sin(x*.12)*Math.cos(z*.1)*1.3+Math.sin(x*.26+z*.15)*.4)*Math.max(0,1-r);
  return mound+hills;
}
export function regionAt(x,z){return ISLANDS.reduce((a,b)=>Math.hypot(x-b.x,z-b.z)<Math.hypot(x-a.x,z-a.z)?b:a);}
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export const NODES = (()=>{const nodes=[],rand=random(4209);for(const island of ISLANDS){
  for(let n=0;n<72;n++){const angle=rand()*Math.PI*2,r=Math.sqrt(rand())*island.radius*.8,x=island.x+Math.cos(angle)*r,z=island.z+Math.sin(angle)*r;
    if(terrain(x,z)<.65||Math.hypot(x,z-18)<4||Math.hypot(x-7,z+16)<5||Math.hypot(x-ECHO_ISLAND.x,z-ECHO_ISLAND.z)<5)continue;
    const type=['wood','wood','stone','fiber','scrap','berries'][n%6];nodes.push({id:`${island.id}-${n}`,type,x,z,scale:.85+rand()*.5,rotation:rand()*6.28});
  }
  for(let n=0;n<5;n++)nodes.push({id:`${island.id}-crystal-${n}`,type:'crystal',x:island.x-20+n*1.5,z:island.z-8+n*2.2,scale:1,rotation:n});
}
  for(const [id,type,x,z] of [['start-timber','wood',-2,15],['start-stone','stone',3,14],['start-fibre','fiber',-3,9]])nodes.push({id,type,x,z,scale:.9,rotation:.3});
  return nodes;})();
const NODE_IDS = new Set(NODES.map(node=>node.id));
export const DEFAULT_BINDINGS=Object.freeze({forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',use:'KeyE',jump:'Space',sprint:'ShiftLeft',inventory:'KeyI',craft:'KeyB',missions:'KeyJ',rotate:'KeyQ',dismantle:'KeyR',tool1:'Digit1',tool2:'Digit2',tool3:'Digit3'});
export function freshState(){return {version:SAVE_VERSION,inventory:Object.fromEntries(Object.keys(ITEMS).map(k=>[k,0])),tools:[],equippedTool:'hands',buildings:[],harvested:{},gardenTimes:{},player:{x:0,z:18,yaw:0,pitch:0},time:0,warmth:100,food:100,watch:false,rifts:riftState(),chapter:chapterState(),expedition:expeditionState(),preparation:preparationState(),visited:['haven'],milestones:[],missions:missionState(),nextId:1,settings:{quality:'balanced',sensitivity:1,sound:.35,music:1,effects:1,motion:true,fov:65,frameLimit:0,invertY:false,renderScale:1,sprintMode:'hold',bindings:{...DEFAULT_BINDINGS}},savedAt:null};}
export function hasBuilding(s,kind){return s.buildings.some(b=>b.kind===kind);}
export function affordable(s,cost){return Object.entries(cost).every(([k,n])=>s.inventory[k]>=n);}
export function spend(s,cost){if(!affordable(s,cost))return false;for(const[k,n]of Object.entries(cost))s.inventory[k]-=n;return true;}
export function canPlaceBuilding(s,kind,stationId=null){
 const r=Object.hasOwn(RECIPES,kind)?RECIPES[kind]:null;
 return !!r&&!['tool','item'].includes(r.kind)&&!r.upgradeFrom&&(!r.requires||hasBuilding(s,r.requires))&&affordable(s,r.cost)
   &&(!r.station||s.buildings.some(b=>b.id===stationId&&b.kind===r.station));
}
export function canCraft(s,kind,station=null){
 const r=Object.hasOwn(RECIPES,kind)?RECIPES[kind]:null;
 if(!r)return false;
 if(r.kind==='tool')return !s.tools.includes(kind)&&affordable(s,r.cost);
 if(r.kind==='item')return s.inventory[kind]<100000&&affordable(s,r.cost)&&(!r.station||!!station&&s.buildings.some(b=>b.id===station.id&&b.kind===r.station)&&Math.hypot(s.player.x-station.x,s.player.z-station.z)<=3.5);
 return canPlaceBuilding(s,kind,station?.id)
   &&(!r.station||Math.hypot(s.player.x-station.x,s.player.z-station.z)<=3.5);
}
export function craftTool(s,kind){if(RECIPES[kind]?.kind!=='tool'||!canCraft(s,kind))return false;spend(s,RECIPES[kind].cost);s.tools.push(kind);s.equippedTool=kind;return true;}
export function craftItem(s,kind,station=null){if(RECIPES[kind]?.kind!=='item'||!canCraft(s,kind,station))return false;spend(s,RECIPES[kind].cost);s.inventory[kind]++;return true;}
export function upgradeBed(s,id){const bed=s.buildings.find(b=>b.id===id&&b.kind==='bed');if(!bed||s.inventory.shelterKit<1||Math.hypot(s.player.x-bed.x,s.player.z-bed.z)>3.5)return null;s.inventory.shelterKit--;bed.kind='shelter';return bed;}
export function placeBuilding(s,kind,x,z,rotation,pose={}){if(!canPlaceBuilding(s,kind,pose.stationId))return null;spend(s,RECIPES[kind].cost);const b={id:s.nextId++,kind,x,z,rotation};if(RECIPES[kind].modular){b.y=pose.y??terrain(x,z);b.supportId=pose.supportId??null;}s.buildings.push(b);return b;}
export function dismantle(s,id){const b=s.buildings.find(b=>b.id===id);if(!b||s.buildings.some(piece=>piece.supportId===id))return false;for(const[k,n]of Object.entries(RECIPES[b.kind].cost))s.inventory[k]+=n;s.buildings=s.buildings.filter(b=>b.id!==id);delete s.gardenTimes[id];return true;}
export function available(s,node){return !s.buildings.some(b=>Math.hypot(node.x-b.x,node.z-b.z)<RECIPES[b.kind].radius+.6)&&(s.harvested[node.id]===undefined||s.time-s.harvested[node.id]>=60);}
export function harvest(s,node){if(!available(s,node))return null;s.harvested[node.id]=s.time;const amount=(node.type==='crystal'?1:node.type==='berries'?3:(s.equippedTool==='axe'||(s.equippedTool===undefined&&s.tools.includes('axe')))?6:3)+gatheringBonus(s,node.type);s.inventory[node.type]+=amount;return {type:node.type,amount};}
export function repairWatch(s){if(s.watch||!hasBuilding(s,'anchor')||!spend(s,WATCH_COST))return false;s.watch=true;return true;}
export function eat(s){if(!s.inventory.berries||s.food>=100)return false;s.inventory.berries--;s.food=Math.min(100,s.food+30);return true;}
export function harvestGarden(s,b){if(b.kind!=='garden'||s.time-(s.gardenTimes[b.id]??-45)<45)return false;s.gardenTimes[b.id]=s.time;s.inventory.berries+=4;return true;}
export function objective(s){return missionObjective(s);}
export function validateSettings(value={}){
 const o=value&&typeof value==='object'?value:{};
 const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 const bindings={...DEFAULT_BINDINGS},candidate=o.bindings&&typeof o.bindings==='object'?o.bindings:{};
 for(const action of Object.keys(DEFAULT_BINDINGS)){const code=candidate[action];if(typeof code==='string'&&/^(Key[A-Z]|Digit[0-9]|Space|ShiftLeft|ShiftRight|Backquote|Minus|Equal|BracketLeft|BracketRight|Semicolon|Quote|Comma|Period|Slash)$/.test(code))bindings[action]=code;}
 if(new Set(Object.values(bindings)).size!==Object.keys(bindings).length)Object.assign(bindings,DEFAULT_BINDINGS);
 return {quality:['performance','balanced','high'].includes(o.quality)?o.quality:'balanced',sensitivity:finite(o.sensitivity,.25,2)?o.sensitivity:1,sound:finite(o.sound,0,1)?o.sound:.35,music:finite(o.music,0,1)?o.music:1,effects:finite(o.effects,0,1)?o.effects:1,motion:o.motion!==false,fov:finite(o.fov,55,110)?o.fov:65,frameLimit:[0,30,60,120,144,240].includes(o.frameLimit)?o.frameLimit:0,invertY:o.invertY===true,renderScale:finite(o.renderScale,.5,1.5)?o.renderScale:1,sprintMode:['hold','toggle'].includes(o.sprintMode)?o.sprintMode:'hold',bindings};
}
export function validateState(raw){
  if(!raw||![1,2,3,4,5,6,7,8,SAVE_VERSION].includes(raw.version)||!raw.inventory||!Array.isArray(raw.buildings)||raw.buildings.length>250)throw new Error('This is not a supported Island save.');
  const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
  for(const k of Object.keys(ITEMS)){if(k==='shelterKit'&&raw.version<7&&raw.inventory[k]===undefined)continue;if(!Number.isInteger(raw.inventory[k])||!finite(raw.inventory[k],0,100000))throw new Error('Invalid inventory.');}
  const s=freshState();for(const k of Object.keys(ITEMS))if(raw.inventory[k]!==undefined)s.inventory[k]=raw.inventory[k];
  if(!raw.player||!finite(raw.player.x,-100,210)||!finite(raw.player.z,-380,100))throw new Error('Invalid saved location.');
  const playerPoint=migrateEchoPoint(raw.player.x,raw.player.z,raw.version);
  if(terrain(playerPoint.x,playerPoint.z)<-.3)throw new Error('Invalid saved location.');
  if(!finite(raw.player.yaw,-1e8,1e8)||!finite(raw.player.pitch,-1.5,1.5))throw new Error('Invalid camera.');
  s.player={x:playerPoint.x,z:playerPoint.z,yaw:raw.player.yaw,pitch:raw.player.pitch};s.buildings=raw.buildings.map(b=>{if(!b||!Object.hasOwn(RECIPES,b.kind)||['tool','item'].includes(RECIPES[b.kind].kind)||!Number.isInteger(b.id)||!finite(b.id,1,100000)||!finite(b.x,-100,210)||!finite(b.z,-380,100)||!finite(b.rotation,-1e8,1e8))throw new Error('Invalid construction.');const point=migrateEchoPoint(b.x,b.z,raw.version);if(terrain(point.x,point.z)<.3)throw new Error('Invalid construction.');const result={id:b.id,kind:b.kind,x:point.x,z:point.z,rotation:b.rotation};if(RECIPES[b.kind].modular){if(raw.version===1||!finite(b.y,0,250)||!(b.supportId===null||Number.isInteger(b.supportId)))throw new Error("Invalid modular construction.");const skyIsland=regionAt(point.x,point.z),legacySkyBuild=skyIsland.id==='echo'&&terrain(point.x,point.z)>20&&b.y<12;const legacyHavenBuild=raw.version<9&&skyIsland.id==='haven';result.y=legacyHavenBuild?b.y+terrain(point.x,point.z)-legacyHavenTerrain(point.x,point.z):legacySkyBuild?b.y+skyIsland.elevation:point.migrated?b.y+ECHO_ISLAND.elevation-OLD_ECHO.elevation:b.y;result.supportId=b.supportId;}return result;});
  for(const b of s.buildings.filter(b=>RECIPES[b.kind].modular)){if(b.kind==='foundation'){if(b.supportId!==null||Math.abs(b.y-terrain(b.x,b.z))>1)throw new Error('Invalid foundation.');}else{const base=s.buildings.find(p=>p.id===b.supportId&&p.kind==='foundation');if(!base||Math.hypot(b.x-base.x,b.z-base.z)>.01||Math.abs(b.y-base.y-.2)>.01)throw new Error('Missing foundation support.');}}
  if(new Set(s.buildings.map(b=>b.id)).size!==s.buildings.length)throw new Error('Duplicate construction.');
  if(!finite(raw.time,0,1e9)||!finite(raw.warmth,0,100)||!finite(raw.food,0,100)||typeof raw.watch!=='boolean')throw new Error('Invalid survival state.');
  if(raw.chapter!==undefined){if(!raw.chapter||['observed','recovered','complete'].some(k=>typeof raw.chapter[k]!=='boolean')||(raw.chapter.complete&&!raw.chapter.recovered))throw Error('Invalid chapter progress');s.chapter={observed:raw.chapter.observed,recovered:raw.chapter.recovered,complete:raw.chapter.complete};}
  if(raw.expedition!==undefined){
    const e=raw.expedition,ids=['harness','lining'];
    if(!e||!Array.isArray(e.recovered)||e.recovered.length>2||new Set(e.recovered).size!==e.recovered.length||e.recovered.some(id=>!ids.includes(id))||!(e.equipped===null||e.recovered.includes(e.equipped))||!ids.includes(e.tracked)||typeof e.returned!=='boolean'||(e.returned&&!e.recovered.length))throw Error('Invalid expedition equipment.');
    s.expedition={recovered:[...e.recovered],equipped:e.equipped,tracked:e.tracked,returned:e.returned};
  }
  if(raw.preparation!==undefined){const p=raw.preparation;if(!p||![null,'trail','broth'].includes(p.meal)||!finite(p.remaining,0,p.meal==='trail'?240:p.meal==='broth'?120:0)||(p.remaining===0&&p.meal!==null))throw Error('Invalid expedition preparation.');s.preparation={meal:p.meal,remaining:p.remaining};}
  if(raw.rifts!==undefined)s.rifts=validateRifts(raw.rifts);
  s.time=raw.time;s.food=raw.food;s.warmth=raw.warmth;s.watch=raw.watch;
  if(!Array.isArray(raw.tools)||raw.tools.length>16||raw.tools.some(t=>t!=='axe')||!Array.isArray(raw.visited)||raw.visited.length>16||raw.visited.some(t=>!['haven','echo'].includes(t)))throw new Error('Invalid progress.');
  s.tools=[...new Set(raw.tools)];if(raw.equippedTool!==undefined&&!['hands','axe','berries'].includes(raw.equippedTool))throw new Error('Invalid equipped tool.');s.equippedTool=raw.equippedTool===undefined?(s.tools.includes('axe')?'axe':'hands'):(raw.equippedTool==='berries'?'berries':raw.equippedTool==='axe'&&s.tools.includes('axe')?'axe':'hands');s.visited=[...new Set(raw.visited)];s.nextId=Math.max(0,...s.buildings.map(b=>b.id))+1;
  // Layout revisions can retire a resource node; its old harvest timestamp no longer affects play.
  if(raw.harvested&&(typeof raw.harvested!=='object'||Array.isArray(raw.harvested)||Object.keys(raw.harvested).length>Math.max(4096,NODE_IDS.size+64)))throw new Error('Invalid resource state.');
  for(const[id,t]of Object.entries(raw.harvested||{})){if(!finite(t,0,s.time))throw new Error('Invalid resource state.');if(NODE_IDS.has(id))s.harvested[id]=t;}
  if(raw.gardenTimes&&(typeof raw.gardenTimes!=='object'||Array.isArray(raw.gardenTimes)||Object.keys(raw.gardenTimes).length>s.buildings.length))throw new Error('Invalid garden state.');
  for(const[id,t]of Object.entries(raw.gardenTimes||{})){if(!s.buildings.some(b=>String(b.id)===id&&b.kind==='garden')||!finite(t,0,s.time))throw new Error('Invalid garden state.');s.gardenTimes[id]=t;}
  s.missions=validateMissions(raw.missions);
  s.settings=validateSettings(raw.settings);s.savedAt=typeof raw.savedAt==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(raw.savedAt)?raw.savedAt:null;return s;
}
// Keep the original key so existing journeys migrate on their next successful save.
export function loadSave(storage){
  const value=storage.getItem(SAVE_KEY),backup=storage.getItem(BACKUP_KEY);
  if(value){try{return {state:validateState(JSON.parse(value)),recovered:false};}catch{/* Try the last good checkpoint. */}}
  if(backup){try{return {state:validateState(JSON.parse(backup)),recovered:true};}catch{/* Preserve both originals for export. */}}
  if(value||backup)throw new Error('No readable Island checkpoint.');
  return {state:freshState(),recovered:false};
}
export function loadState(storage){return loadSave(storage).state;}
export function saveState(s,storage){
  const next=validateState(s);next.savedAt=new Date().toISOString();
  const previous=storage.getItem(SAVE_KEY);
  if(previous){let valid=false;try{validateState(JSON.parse(previous));valid=true;}catch{/* Never overwrite a good backup with corrupt data. */}
    if(valid)storage.setItem(BACKUP_KEY,previous);
  }
  // localStorage replaces one key atomically. A failed write leaves the primary intact.
  storage.setItem(SAVE_KEY,JSON.stringify(next));s.savedAt=next.savedAt;
}

// One shared solar cycle for lighting, exposure and the HUD.
export const DAY_SECONDS=1200;
export const solarElevation=t=>Math.sin(t/DAY_SECONDS*Math.PI*2+.32);
export function dayPeriod(t){const p=t%DAY_SECONDS;return p<240?'MORNING':p<480?'AFTERNOON':p<620?'DUSK':p<1140?'NIGHT':'DAWN';}
