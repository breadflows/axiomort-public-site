const built=(s,...kinds)=>s.buildings.some(b=>kinds.includes(b.kind));
export const startingWorkbench=s=>s.buildings.filter(b=>b.kind==='bench'&&Math.hypot(b.x,b.z)<=50).sort((a,b)=>Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z))[0]||null;
export const homeShelter=s=>s.buildings.filter(b=>['shelter','roof'].includes(b.kind)&&Math.hypot(b.x,b.z)<=50).sort((a,b)=>Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z))[0]||null;
export const homeBed=s=>s.buildings.filter(b=>b.kind==='bed'&&Math.hypot(b.x,b.z)<=50).sort((a,b)=>Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z))[0]||null;
export function shelterStage(s){if(homeShelter(s))return 'done';if(!homeBed(s))return 'bed';if(s.inventory.shelterKit>0)return 'upgrade';return startingWorkbench(s)?'kit':'bench';}
export const MISSIONS=[
 {id:'observe',title:'Investigate the rift',text:'Examine the dormant rift beyond the trees.',reward:{},done:s=>s.chapter.observed},
 {id:'axe',title:'Make an axe',text:'Gather materials and craft a field axe.',recipe:'axe',reward:{fiber:2},done:s=>s.tools.includes('axe')},
 {id:'shelter',title:'Build a shelter',text:'Place a bed, make a shelter kit at a workbench, then upgrade the bed. A foundation with a canopy also gives shelter.',recipe:'bed',reward:{stone:2},done:s=>!!homeShelter(s)},
 {id:'bench',title:'Set up a workbench',text:'Build a workbench.',recipe:'bench',reward:{scrap:1},done:s=>built(s,'bench')},
 {id:'anchor',title:'Stabilise the rift',text:'Use your workbench to build a stability anchor.',recipe:'anchor',reward:{berries:3},done:s=>built(s,'anchor')},
 {id:'watch',title:'Repair the watch',text:'Take the repair materials to the old rift.',reward:{berries:3},done:s=>s.watch},
 {id:'travel',title:'Cross the rift',text:'Enter the rift, clear its trial and reach the sky island.',reward:{wood:4},done:s=>s.visited.includes('echo')},
 {id:'recover',title:'Recover the crystal',text:'Find the Echo crystal at the ruined arch.',reward:{fiber:3},done:s=>s.chapter.recovered},
 {id:'return',title:'Return home',text:'Bring the Echo crystal back to your shelter.',reward:{scrap:2,berries:4},done:s=>s.chapter.complete},
 {id:'equipment',title:'Search the wrecks',text:'Recover equipment from either wreck on the sky island.',reward:{wood:4,stone:2},done:s=>s.expedition.recovered.length>0},
 {id:'equipment-return',title:'Bring the equipment home',text:'Use your shelter to finish the expedition.',reward:{crystal:1,berries:4},done:s=>s.expedition.returned}
];
export const missionState=()=>({completed:[]});
export function validateMissions(raw){
 if(raw===undefined)return missionState();
 if(!raw||!Array.isArray(raw.completed)||raw.completed.length>MISSIONS.length||raw.completed.some((id,i)=>id!==MISSIONS[i].id))throw Error('Invalid mission progress.');
 return {completed:[...raw.completed]};
}
export function currentMission(s){return MISSIONS[s.missions?.completed.length||0]||null;}
export function settleMissions(s){
 s.missions??=missionState();const completed=[];
 for(let m=currentMission(s);m&&m.done(s);m=currentMission(s)){
   // Ledger and reward are written in the same saved state.
   for(const [item,amount] of Object.entries(m.reward))s.inventory[item]=Math.min(100000,s.inventory[item]+amount);
   s.missions.completed.push(m.id);completed.push(m);
 }
 return completed;
}
export function missionObjective(s){
 const m=currentMission(s);
 if(!m)return {title:'Explore',text:'Build, explore and recover the remaining equipment.',target:'explore'};
 let text=m.text;
 if(m.id==='shelter')text={bed:'Craft and place a bed.',bench:'Build a workbench to make a storm shelter kit.',kit:'Make a storm shelter kit at your workbench.',upgrade:'Return to your bed and upgrade it with the kit.'}[shelterStage(s)]||text;
 else if(m.id==='watch'&&!startingWorkbench(s))text='Build a workbench to prepare the rift repair.';
 else if(m.id==='watch'&&!built(s,'anchor'))text='Use your workbench to build a stability anchor before repairing the watch.';
 else if(['return','equipment-return'].includes(m.id)&&!homeShelter(s))text='Upgrade a bed to shelter on the starting island, or build a canopy.';
 return {title:m.title,text,target:m.id};
}
export function missionCost(s,recipes,watchCost){
 const m=currentMission(s);if(!m)return {};
 if(m.id==='watch')return built(s,'anchor')?watchCost:startingWorkbench(s)?recipes.anchor.cost:recipes.bench.cost;
 if(m.id==='shelter'||['return','equipment-return'].includes(m.id)&&!homeShelter(s)){const stage=shelterStage(s);return stage==='bed'?recipes.bed.cost:stage==='bench'?recipes.bench.cost:stage==='kit'?recipes.shelterKit.cost:{};}
 if(m.recipe){const r=recipes[m.recipe];return r.station==='bench'&&!startingWorkbench(s)?recipes.bench.cost:r.requires&&!built(s,r.requires)?recipes[r.requires].cost:r.cost;}
 return {};
}
export function missionSteps(s,recipes,watchCost){
 const m=currentMission(s);if(!m)return [];
 const steps=Object.entries(missionCost(s,recipes,watchCost)).map(([item,required])=>({item,current:Math.min(required,s.inventory[item]),required,done:s.inventory[item]>=required}));
 if(m.id==='shelter'){steps.push({label:'Bed placed',done:!!homeBed(s)||!!homeShelter(s)});steps.push({label:'Shelter kit made at workbench',done:s.inventory.shelterKit>0||built(s,'shelter','roof')});}
 if(m.id==='anchor'||m.id==='watch'&&!built(s,'anchor'))steps.push({label:'Workbench on the starting island',done:!!startingWorkbench(s)});
 if(['return','equipment-return'].includes(m.id))steps.push({label:'Shelter on the starting island',done:!!homeShelter(s)});
 if(m.id==='travel')steps.push({label:'Clear the rift trial',done:!!s.rifts.passages['haven-echo']?.cleared});
 steps.push({label:m.text,done:!!m.done(s)});
 return steps;
}
