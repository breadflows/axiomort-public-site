import {MISSIONS,currentMission,missionObjective,settleMissions,missionSteps,missionCost,homeShelter,homeBed,shelterStage,startingWorkbench} from './missions.js?v=20260923-inside-axio';
import {TOOL_SLOTS,equippedTool,selectTool,cycleTool} from './hotbar.js?v=20260923-hud-input';
import {PAD_BUTTON,createInputRouter,hintMarkup,touchStickVector} from './input.js?v=20260923-touch-stick';
import {createStamina,resetStamina,spendJump,canSprint,advanceStamina} from './stamina.js?v=20260923-stamina';
import {createGathering} from './gathering.js?v=20260922-inventory';
import {createFeedback} from './feedback.js?v=20260923-discord-thanks';
import {encounterRift,clearRift} from './rifts.js';
import {MEALS,prepareMeal,tickPreparation,preparedEnergyRate,preparedExposureRate} from './preparation.js';
import {WRECKS,recoverEquipment,equipAtBench,returnEquipment,exposureRate,trackedWreck} from './expedition.js?v=20260923-sky-route';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {ECHO_CRYSTAL,surveyRift,recoverCrystal,returnCrystal,neededResources} from './chapter.js?v=20260923-inside-axio';
import {createSound} from './sound.js?v=20260923-interaction-audio';
import * as THREE from 'three/webgpu';
import {DAY_SECONDS,dayPeriod,solarElevation,SAVE_KEY,ITEMS,RECIPES,WATCH_COST,NODES,ISLANDS,freshState,terrain,regionAt,affordable,canCraft,canPlaceBuilding,craftTool,craftItem,upgradeBed,placeBuilding,dismantle,available,harvest,repairWatch,eat,harvestGarden,hasBuilding,objective,loadSave,saveState,validateState,validateSettings} from './state.js?v=20260923-save-bounds';
import {createWorld,makeBuilding,makeAxe,playerCollides,placementCheck} from './world.js?v=20260923-real-axe';

import {constructionPose,floorHeight,underRoof,ceilingHeight} from './construction.js';
import {createMotion,resetMotion,movePlayer} from './controller.js?v=20260923-air-control';
const sound=createSound();let transitioning=false,riftSession=null;
let orbitTime=0,arrivalTime=null,arrivalPosition=null,arrivalRotation=null;
const reducedMotion=()=>!state.settings.motion||matchMedia('(prefers-reduced-motion: reduce)').matches;
const motion=createMotion(),raycaster=new THREE.Raycaster(),reachRaycaster=new THREE.Raycaster();
const $=id=>document.getElementById(id),canvas=$('world'),panel=$('panel'),start=$('start');
const touch=matchMedia('(pointer:coarse)').matches;document.body.dataset.touch=String(touch);$('touch-controls').hidden=!touch;
let state,saveProblem='',saveBlocked=false;
try{const loaded=loadSave(localStorage);state=loaded.state;if(loaded.recovered)saveProblem='Recovered your last good checkpoint. Your most recent changes may be missing.';}catch(e){state=freshState();saveProblem='Your previous save could not be read. Download it from Pause before starting a new save.';saveBlocked=true;}
const SETTINGS_KEY='axiomort.settings.v1';
try{const saved=localStorage.getItem(SETTINGS_KEY);if(saved)state.settings=validateSettings(JSON.parse(saved));}catch{/* Use the settings in the journey if device preferences are unreadable. */}
sound.setVolume(state.settings.sound);sound.setMusicVolume(state.settings.music);sound.setEffectsVolume(state.settings.effects);
const bind=action=>state.settings.bindings[action];
let inputDirty=false,pointerActive=false;
const input=createInputRouter({coarse:touch,onChange:()=>{document.body.dataset.input=input.device;document.body.dataset.pad=input.family;inputDirty=true;}});
document.body.dataset.input=input.device;document.body.dataset.pad=input.family;
const keyLabel=code=>code.startsWith('Key')?code.slice(3):code.startsWith('Digit')?code.slice(5):({Space:'Space',ShiftLeft:'Left Shift',ShiftRight:'Right Shift',Backquote:'`',Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/'}[code]||code);
const bindable=code=>/^(Key[A-Z]|Digit[0-9]|Space|ShiftLeft|ShiftRight|Backquote|Minus|Equal|BracketLeft|BracketRight|Semicolon|Quote|Comma|Period|Slash)$/.test(code);
const actionBindings={interact:'use',inventory:'inventory',missions:'missions',craft:'craft',rotate:'rotate',dismantle:'dismantle',slot1:'tool1',slot2:'tool2',slot3:'tool3'};
function actionHint(action){const key=actionBindings[action]?keyLabel(bind(actionBindings[action])):'';return hintMarkup(action,{device:input.device,family:input.family,key});}
function updateShortcutLabels(){$('inventory-button').innerHTML=actionHint('inventory');$('journal-button').innerHTML=actionHint('missions');}
function updateBuildHint(){if(buildKind)$('build-hint').querySelector('small').innerHTML=actionHint(input.device==='touch'?'place':'gather')+' place · '+actionHint('rotate')+' rotate · '+actionHint('back')+' cancel';}
function refreshInputPresentation(){if(!inputDirty||pointerActive)return;inputDirty=false;document.body.dataset.input=input.device;document.body.dataset.pad=input.family;updateShortcutLabels();hotbarSignature='';renderHotbar();updateBuildHint();if(world&&camera)findTarget();const footer=$('pause-control-hint');if(footer)footer.innerHTML=actionHint('back')+' RESUME';const craft=$('inventory-craft');if(craft)craft.innerHTML='Craft & build '+actionHint('craft');if(activePanel==='controls'&&panel.open&&!bindingCapture)renderControls();if(input.device==='gamepad'&&(start.open||panel.open))focusMenuDefault();}
const menuMusic=$('menu-music');
const menuTracks=['survival/assets/menu-loop.webm','survival/assets/menu-loop-alt.webm'];
menuMusic.src=menuTracks[Math.floor(Math.random()*menuTracks.length)];
menuMusic.load();
menuMusic.volume=Math.min(1,state.settings.sound*state.settings.music*.55);
function requestMenuMusic(){
  if(!start.open||started||document.hidden||(!state.settings.sound||!state.settings.music))return;
  menuMusic.volume=Math.min(1,state.settings.sound*state.settings.music*.55);
  if(menuMusic.paused)menuMusic.play().catch(()=>{/* Playback can begin after a user gesture. */});
}
function syncMenuMusic(){
  menuMusic.volume=Math.min(1,state.settings.sound*state.settings.music*.55);
  if(!state.settings.sound||!state.settings.music)menuMusic.pause();
  else requestMenuMusic();
}
function stopMenuMusic(){
  if(menuMusic.paused)return;
  const volume=menuMusic.volume,begin=performance.now();
  function fade(now){
    const t=Math.min(1,(now-begin)/450);
    menuMusic.volume=volume*(1-t);
    if(t<1)requestAnimationFrame(fade);
    else{menuMusic.pause();menuMusic.currentTime=0;menuMusic.volume=Math.min(1,state.settings.sound*state.settings.music*.55);}
  }
  requestAnimationFrame(fade);
}
start.addEventListener('pointerdown',requestMenuMusic,{capture:true});
start.addEventListener('keydown',requestMenuMusic,{capture:true});
document.addEventListener('pointerdown',()=>{void sound.unlock();},true);
document.addEventListener('keydown',()=>{void sound.unlock();},true);
const audibleControl=e=>e.target.closest?.('button:not(:disabled),a[href],summary,select,input[type="checkbox"],input[type="range"]');
document.addEventListener('pointerover',e=>{
  const control=audibleControl(e);
  if(control&&!control.contains(e.relatedTarget)&&!control.closest('#touch-controls'))sound.cue('hover');
},true);
document.addEventListener('focusin',e=>{
  if(!pointerActive&&audibleControl(e))sound.cue('hover');
},true);
document.addEventListener('click',e=>{
  const control=audibleControl(e);
  if(control&&!control.closest('#touch-controls')&&!['title-sound','rotate-build'].includes(control.id)&&!control.matches('input,select'))void sound.unlock().then(()=>sound.cue(['close-panel','resume','cancel-build'].includes(control.id)?'back':'select'));
},true);
document.addEventListener('input',e=>{if(e.target.matches?.('input[type="range"]'))sound.cue('adjust');},true);
document.addEventListener('change',e=>{if(e.target.matches?.('select,input[type="checkbox"]'))sound.cue('adjust');},true);
document.addEventListener('pointerdown',e=>{pointerActive=true;input.pointer(e.pointerType);},true);
document.addEventListener('pointerup',()=>{pointerActive=false;setTimeout(refreshInputPresentation,0);},true);
document.addEventListener('pointercancel',()=>{pointerActive=false;setTimeout(refreshInputPresentation,0);},true);
document.addEventListener('keydown',()=>input.keyboard(),true);
document.addEventListener('wheel',()=>input.keyboard(),{capture:true,passive:true});
let world,renderer,camera,axe,started=false,paused=true,activePanel='',target=null,ghost=null,buildKind=null,buildStationId=null,buildRotation=0,buildPosition=null,placementError=null;
const stamina=createStamina();let touchJumpHeld=false,touchSprintHeld=false,jumpArmed=false,activeStickPointer=null,touchStick={x:0,y:0},gatherPointerId=null;
let y=0,vy=0,onGround=true,stepDistance=0,last=0,lastFrame=0,frameBudget=0,uiClock=0,saveClock=0,toastTimer,drag=null,lastUse=-10,lastGather=-10,swing=0,sprintToggled=false;
let hotbarSignature='',bindingCapture=null,activeBedId=null;
function cancelBindingCapture(){if(bindingCapture){document.removeEventListener('keydown',bindingCapture,true);bindingCapture=null;}}
const gathering=createGathering();let gatherHeld=false,lastPausedRender=-Infinity;
const keys=new Set(),direction=new THREE.Vector3(),colors={wood:'#bfa079',stone:'#a2b2b0',fiber:'#a6c487',scrap:'#c7a37d',crystal:'#94e0bc',berries:'#d68f7c'};
const feedback=createFeedback({onOpen:()=>setPaused(true),onClose:origin=>{if(origin==='completion'){quitToMainMenu();return;}if(started&&!panel.open){setPaused(false);captureMouse();}}});
start.addEventListener('cancel',e=>e.preventDefault());if(start.open)start.close();start.showModal();requestMenuMusic();document.body.dataset.paused='true';document.body.dataset.intro='true';
const showToast=(message)=>{if(panel.open)$('panel-status').textContent=message;$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3400);};
function tone(kind='select'){sound.cue(kind);}
let missionNoticeTimer;
function applyMissionRewards(){const finished=settleMissions(state);if(!finished.length)return;tone('objective');const m=finished[finished.length-1];$('mission-notice').textContent=m.title+' complete · '+rewardText(m.reward);$('mission-notice').hidden=false;clearTimeout(missionNoticeTimer);missionNoticeTimer=setTimeout(()=>$('mission-notice').hidden=true,5500);if(finished.some(m=>m.id==='equipment-return'))setTimeout(endDemo,0);}
function endDemo(){if(!started||!state.missions.completed.includes('equipment-return'))return;cancelBindingCapture();cancelBuild();if(panel.open)panel.close();activePanel='';setPaused(true);feedback.open('completion');}
function rewardText(reward){return Object.entries(reward).map(([id,n])=>'+'+n+' '+ITEMS[id]).join(' · ');}
function save(){applyMissionRewards();if(saveBlocked){$('save-label').textContent='Save recovery needed';return false;}try{saveState(state,localStorage);$('save-label').textContent='Saved on this device';return true;}catch{$('save-label').textContent='Storage unavailable. Export your save.';return false;}}
function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(state.settings));}catch{/* Settings remain active for this visit. */}if(started)save();}
function captureMouse(){if(touch||input.device==='gamepad'||paused||panel.open||document.pointerLockElement)return;try{const p=canvas.requestPointerLock?.();p?.catch(()=>showToast('Drag across the world to look around.'));}catch{showToast('Drag across the world to look around.');}}
function setPaused(value){paused=value;if(value){sprintToggled=false;stepDistance=0;}sound.setPaused(value);keys.clear();gatherHeld=false;gatherPointerId=null;touchJumpHeld=false;touchSprintHeld=false;activeStickPointer=null;touchStick={x:0,y:0};$('movement-thumb').style.setProperty('--stick-x','0px');$('movement-thumb').style.setProperty('--stick-y','0px');jumpArmed=false;resetMotion(motion);drag=null;document.body.dataset.paused=String(value);if(value&&document.pointerLockElement)document.exitPointerLock();}

function itemIcon(id){return `<svg class="item-icon" aria-hidden="true"><use href="survival/ui/items.svg?v=20260923-bed-upgrade#${id}"></use></svg>`;}
function equipTool(id){
  if(!selectTool(state,id))return;tone('equip');
  gatherHeld=false;save();refreshUI();
  if(activePanel==='inventory')renderInventory();
}
function renderHotbar(){
  const selected=equippedTool(state),signature=[selected,state.tools.join(','),state.inventory.berries,input.device,input.family,...['tool1','tool2','tool3'].map(a=>bind(a))].join(':');
  if(signature===hotbarSignature)return;hotbarSignature=signature;
  $('hotbar').innerHTML=TOOL_SLOTS.map((t,i)=>`<button type="button" class="tool-slot" data-tool="${t.id}" aria-label="${t.name}${t.id==='berries'?' ('+state.inventory.berries+' available)':''}" aria-pressed="${selected===t.id}" ${t.id==='axe'&&!state.tools.includes('axe')?'disabled':''}>${input.device==='gamepad'?(selected===t.id?'<span class="pad-slot-cycle">'+actionHint('previous')+actionHint('next')+'</span>':''):actionHint('slot'+(i+1))}${itemIcon(t.icon)}<span>${t.name}</span>${t.id==='berries'?'<strong class="slot-count">'+state.inventory.berries+'</strong>':''}${t.id==='berries'&&selected==='berries'&&input.device==='gamepad'?'<span class="berry-use-hint">'+actionHint('useItem')+'</span>':''}</button>`).join('');
  $('hotbar').querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{if(b.dataset.tool==='berries'&&equippedTool(state)==='berries')eatBerry();else equipTool(b.dataset.tool);});
}
function renderInventory(){
  $('panel-title').textContent='Inventory';$('panel-kicker').textContent='AXIOMORT';
  $('panel-body').innerHTML=`<section class="inventory-section"><h3>Materials</h3><div class="inventory-grid">${Object.entries(ITEMS).map(([id,name])=>`<div class="inventory-slot ${state.inventory[id]?'':'empty'}">${itemIcon(id)}<strong>${state.inventory[id]}</strong><span>${name}</span></div>`).join('')}</div></section>${state.chapter.recovered&&!state.chapter.complete?`<section class="inventory-section"><h3>Quest item</h3><div class="inventory-grid"><div class="inventory-slot">${itemIcon('crystal')}<strong>1</strong><span>Echo crystal</span></div></div></section>`:''}<section class="inventory-section"><h3>Hotbar</h3><div class="inventory-tools">${TOOL_SLOTS.filter(t=>t.id==='hands'||t.id==='berries'||state.tools.includes(t.id)).map(t=>`<button data-equip-tool="${t.id}" aria-pressed="${equippedTool(state)===t.id}">${itemIcon(t.icon)}<span>${t.name}</span><small>${equippedTool(state)===t.id?'Equipped':'Equip'}</small></button>`).join('')}</div></section><button id="inventory-craft">Craft & build ${actionHint('craft')}</button>`;
  $('panel-body').querySelectorAll('[data-equip-tool]').forEach(b=>b.onclick=()=>equipTool(b.dataset.equipTool));
  $('inventory-craft').onclick=()=>openPanel('craft');
  renderEquipment();
}

function costMarkup(cost){return Object.entries(cost).map(([k,n])=>`<span class="${state.inventory[k]<n?'missing':''}">${state.inventory[k]} / ${n} ${ITEMS[k]}</span>`).join('');}
function renderCraft(){
  const atWorkbench=activePanel==='workbench';
  const bench=atWorkbench?state.buildings.find(b=>b.kind==='bench'&&Math.hypot(b.x-state.player.x,b.z-state.player.z)<=3.5):null;
  $('panel-title').textContent=atWorkbench?'Workbench':'Crafting';
  $('panel-kicker').textContent=atWorkbench?'WORKBENCH':'FIELD CRAFTING';
  if(atWorkbench&&!bench){$('panel-body').textContent='Move closer to a workbench.';return;}
  const recipes=Object.entries(RECIPES).filter(([,recipe])=>!recipe.upgradeFrom&&Boolean(recipe.station)===atWorkbench);
  $('panel-body').innerHTML=`<div class="recipe-grid">${recipes.map(([kind,r])=>`<article class="recipe"><h3>${r.name}</h3><p>${r.description}</p><div class="cost">${costMarkup(r.cost)}</div><button data-recipe="${kind}" ${canCraft(state,kind,bench)?'':'disabled'}>${r.kind==='tool'?(state.tools.includes(kind)?'Crafted':'Craft tool'):r.kind==='item'?'Craft kit':'Choose placement'}</button></article>`).join('')}</div>`;
  if(atWorkbench)renderEquipment();
  $('panel-body').querySelectorAll('[data-recipe]').forEach(b=>b.onclick=()=>{
    const kind=b.dataset.recipe;
    if(RECIPES[kind].kind==='tool'){if(craftTool(state,kind,bench)){tone('build');showToast('Field axe equipped.');save();renderCraft();refreshUI();}}
    else if(RECIPES[kind].kind==='item'){if(craftItem(state,kind,bench)){tone('build');showToast('Storm shelter kit crafted. Return to your bed to upgrade it.');save();renderCraft();refreshUI();}}
    else startBuild(kind,bench);
  });
}
function renderBed(){
  const bed=state.buildings.find(b=>b.id===activeBedId&&b.kind==='bed');
  if(!bed){closePanel();return;}
  $('panel-title').textContent='Bed';$('panel-kicker').textContent='SHELTER';
  $('panel-body').innerHTML=`<div class="journal"><p>Upgrade this bed into a storm shelter with a kit made at a workbench.</p><div class="cost"><span class="${state.inventory.shelterKit?'':'missing'}">${state.inventory.shelterKit} / 1 Storm shelter kit</span></div><button id="upgrade-bed" class="primary" ${state.inventory.shelterKit?'':'disabled'}>Upgrade to storm shelter</button>${state.inventory.shelterKit?'':'<p>Make a storm shelter kit at a workbench, then return here.</p>'}</div>`;
  $('upgrade-bed').onclick=()=>{const upgraded=upgradeBed(state,bed.id);if(!upgraded){renderBed();return;}world.removeBuilding(bed.id);world.addBuilding(upgraded);if(playerCollides(world,state,state.player.x,terrain(state.player.x,state.player.z),state.player.z))returnHome(false);activeBedId=null;tone('build');save();closePanel();showToast('Bed upgraded to storm shelter.');refreshUI();};
}
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function renderPause(){
 $('panel-title').textContent='AXIOMORT';$('panel-kicker').textContent='PAUSED';
 $('panel-body').innerHTML=`<div class='title-art pause-art' aria-hidden='true'></div><div class='title-shade' aria-hidden='true'></div><nav class='pause-menu' aria-label='Pause menu'><button id='resume' class='menu-choice' type='button'><span>RESUME</span>${menuArrow}</button><button id='pause-inventory' class='menu-choice' type='button'><span>INVENTORY</span>${menuArrow}</button><button id='pause-missions' class='menu-choice' type='button'><span>MISSIONS</span>${menuArrow}</button><button id='pause-craft' class='menu-choice' type='button'><span>CRAFT & BUILD</span>${menuArrow}</button><button id='pause-settings' class='menu-choice' type='button'><span>SETTINGS</span>${menuArrow}</button><button id='quit-to-menu' class='menu-choice' type='button'><span>QUIT TO MAIN MENU</span>${menuArrow}</button></nav><div class='pause-footer'><span>© 2026 BreadFlows</span><span id='pause-control-hint'>${actionHint('back')} RESUME</span></div>`;
 $('resume').onclick=closePanel;
 $('pause-inventory').onclick=()=>openPanel('inventory');
 $('pause-missions').onclick=()=>openPanel('missions');
 $('pause-craft').onclick=()=>openPanel('craft');
 $('pause-settings').onclick=()=>openPanel('settings');
 $('quit-to-menu').onclick=quitToMainMenu;
}
function renderSettings(){
 const d=state.settings;
 $('panel-title').textContent='Settings';$('panel-kicker').textContent='AXIOMORT';
 $('panel-body').innerHTML=`
 <div class='settings settings-menu'>
  <section class='settings-group' aria-labelledby='settings-video'>
   <h3 id='settings-video'>VIDEO</h3>
   <label class='settings-row'><span>Visual quality</span><select id='quality'><option value='performance'>Performance</option><option value='balanced'>Balanced</option><option value='high'>High</option></select></label>
   <p class='settings-note'>Shadow detail updates when you reopen the game.</p>
   <div class='settings-row'><span>Display</span><button id='fullscreen-toggle' type='button'>${document.fullscreenElement?'Exit fullscreen':'Enter fullscreen'}</button></div>
   <label class='settings-row'><span>Render scale <output id='render-scale-value'>${Math.round(d.renderScale*100)}%</output></span><input id='render-scale' type='range' min='.5' max='1.5' step='.05' value='${d.renderScale}'></label>
   <label class='settings-row'><span>Field of view <output id='fov-value'>${d.fov}°</output></span><input id='fov' type='range' min='55' max='110' step='1' value='${d.fov}'></label>
   <label class='settings-row'><span>Frame limit</span><select id='frame-limit'><option value='0'>Unlimited</option><option value='30'>30 FPS</option><option value='60'>60 FPS</option><option value='120'>120 FPS</option><option value='144'>144 FPS</option><option value='240'>240 FPS</option></select></label>
   <label class='settings-row'><span>Camera movement</span><input id='motion' type='checkbox' ${d.motion?'checked':''}></label>
  </section>
  <section class='settings-group' aria-labelledby='settings-audio'>
   <h3 id='settings-audio'>AUDIO</h3>
   <label class='settings-row'><span>Master <output id='master-value'>${Math.round(d.sound*100)}%</output></span><input id='master-volume' type='range' min='0' max='1' step='.01' value='${d.sound}'></label>
   <label class='settings-row'><span>Music <output id='music-value'>${Math.round(d.music*100)}%</output></span><input id='music-volume' type='range' min='0' max='1' step='.01' value='${d.music}'></label>
   <label class='settings-row'><span>Effects <output id='effects-value'>${Math.round(d.effects*100)}%</output></span><input id='effects-volume' type='range' min='0' max='1' step='.01' value='${d.effects}'></label>
  </section>
  <section class='settings-group' aria-labelledby='settings-controls'>
   <h3 id='settings-controls'>CONTROLS</h3>
   <label class='settings-row'><span>Look sensitivity <output id='sensitivity-value'>${d.sensitivity.toFixed(2)}</output></span><input id='sensitivity' type='range' min='.25' max='2' step='.05' value='${d.sensitivity}'></label>
   <label class='settings-row'><span>Invert vertical look</span><input id='invert-y' type='checkbox' ${d.invertY?'checked':''}></label>
   <label class='settings-row'><span>Sprint</span><select id='sprint-mode'><option value='hold'>Hold</option><option value='toggle'>Toggle</option></select></label>
   <button id='settings-controls-guide' type='button'>Controls & bindings</button>
  </section>
  <details class='settings-data'><summary>SAVE & FEEDBACK</summary>
   <div class='settings-actions'><button id='return-home'>Return to camp</button><button id='export'>Export save</button><button id='import'>Import save</button><a href='index.html'>AXIOMORT menu</a></div>
   <input type='file' id='save-file' accept='.json,application/json' hidden>
   ${saveBlocked?'<p>Your previous save could not be read. Export the original before replacing it.</p><button id="export-raw">Download original save</button><button id="replace-save">Replace unreadable save</button>':''}
  </details>
  <div class='settings-bottom'><button id='settings-reset' type='button'>Reset settings</button><button class='primary' id='resume' type='button'>Back</button></div>
 </div>`;
 const feedbackButton=document.createElement('button');feedbackButton.textContent='Give feedback';feedbackButton.onclick=()=>feedback.open('pause');$('panel-body').querySelector('.settings-actions').prepend(feedbackButton);
 $('quality').value=d.quality;$('frame-limit').value=String(d.frameLimit);$('sprint-mode').value=d.sprintMode;
 $('fullscreen-toggle').disabled=!document.fullscreenEnabled;
 $('fullscreen-toggle').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{showToast('Fullscreen is unavailable in this browser.');}};
 $('resume').onclick=()=>started?openPanel('pause'):closePanel();
 $('settings-reset').onclick=()=>{state.settings={...freshState().settings};applyQuality();sound.setVolume(state.settings.sound);sound.setMusicVolume(state.settings.music);sound.setEffectsVolume(state.settings.effects);syncMenuMusic();updateTitle();hotbarSignature='';updateShortcutLabels();renderHotbar();saveSettings();renderSettings();};
 $('settings-controls-guide').onclick=()=>openPanel('controls');
 $('quality').onchange=e=>{d.quality=e.target.value;applyQuality();saveSettings();};
 $('render-scale').oninput=e=>{d.renderScale=Number(e.target.value);$('render-scale-value').textContent=Math.round(d.renderScale*100)+'%';setResolution();saveSettings();};
 $('fov').oninput=e=>{d.fov=Number(e.target.value);$('fov-value').textContent=d.fov+'°';setResolution();saveSettings();};
 $('frame-limit').onchange=e=>{d.frameLimit=Number(e.target.value);frameBudget=0;saveSettings();};
 $('motion').onchange=e=>{d.motion=e.target.checked;saveSettings();};
 $('master-volume').oninput=e=>{d.sound=Number(e.target.value);$('master-value').textContent=Math.round(d.sound*100)+'%';sound.setVolume(d.sound);syncMenuMusic();updateTitle();saveSettings();};
 $('music-volume').oninput=e=>{d.music=Number(e.target.value);$('music-value').textContent=Math.round(d.music*100)+'%';sound.setMusicVolume(d.music);syncMenuMusic();saveSettings();};
 $('effects-volume').oninput=e=>{d.effects=Number(e.target.value);$('effects-value').textContent=Math.round(d.effects*100)+'%';sound.setEffectsVolume(d.effects);saveSettings();};
 $('sensitivity').oninput=e=>{d.sensitivity=Number(e.target.value);$('sensitivity-value').textContent=d.sensitivity.toFixed(2);saveSettings();};
 $('invert-y').onchange=e=>{d.invertY=e.target.checked;saveSettings();};
 $('sprint-mode').onchange=e=>{d.sprintMode=e.target.value;sprintToggled=false;saveSettings();};
 $('return-home').onclick=()=>{returnHome();closePanel();showToast('Returned to camp. Your pack is safe.');save();};
 $('export').onclick=()=>download(JSON.stringify(state,null,2),'axiomort-island-save.json');$('import').onclick=()=>$('save-file').click();
 $('save-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>500000)throw new Error('Choose an Island save smaller than 500 KB.');const next=validateState(JSON.parse(await file.text()));
  if(!confirm('Replace this save with the selected file? Export your current save first if you want to keep it.'))return;
  saveState(next,localStorage);state=next;saveBlocked=false;location.reload();
 }catch(error){showToast(error.message);}};
 if(saveBlocked){$('export-raw').onclick=()=>{try{download(localStorage.getItem(SAVE_KEY)||'', 'axiomort-original-save.json');}catch{showToast('Browser storage is unavailable.');}};$('replace-save').onclick=()=>{if(confirm('Replace the unreadable save with the current game?')){saveBlocked=false;save();renderSettings();}};}
}

function missionMarkup(){
 const m=currentMission(state),steps=missionSteps(state,RECIPES,WATCH_COST);
 return m?`<section class="mission-card"><h3>${m.title}</h3><ul>${steps.map(step=>`<li class="${step.done?'done':''}"><span>${step.done?'✓':'○'}</span> ${step.item?ITEMS[step.item]+' <b>'+step.current+' / '+step.required+'</b>':step.label}</li>`).join('')}</ul>${Object.keys(m.reward).length?`<p class="mission-reward">Reward · ${rewardText(m.reward)}</p>`:''}</section>`:'<p>All demo missions completed.</p>';
}
function renderMissions(){
 $('panel-title').textContent='Missions';$('panel-kicker').textContent='AXIOMORT';
 $('panel-body').innerHTML=missionMarkup()+`<details class="completed-missions"><summary>Completed · ${state.missions.completed.length} / ${MISSIONS.length}</summary>${MISSIONS.filter(m=>state.missions.completed.includes(m.id)).map(m=>`<p>✓ ${m.title}<small>${rewardText(m.reward)}</small></p>`).join('')}</details><button id="mission-notes">Field notes</button>`;
 $('mission-notes').onclick=()=>openPanel('journal');
}

function renderJournal(){
  $('panel-title').textContent='Field notes';$('panel-kicker').textContent='GUIDE';
  $('panel-body').innerHTML=`<div class="journal"><h3>Getting started</h3><p>Find timber, stone and fibre around the coast. An axe makes gathering faster. Craft a bed in the field. Make a storm shelter kit at a workbench, then upgrade the bed. With salvage and rift crystals, the workbench can also make a stability anchor.</p><h3>Building</h3><p>Use a workbench to make timber foundations and canopies. Foundations make walkable floors and snap beside one another. Aim towards a foundation to attach a wall, open doorway or canopy roof. Rotate chooses the wall edge. A canopy restores warmth underneath. Remove attached pieces before dismantling their foundation; every piece refunds its materials.</p><h3>Rift</h3><p>Once an anchor is built, take four pieces of salvage and two rift crystals to the old rift. Interact to repair the watch, then interact again to enter. Clear the trial once to keep the passage open in both directions. Retreating or failing does not take your belongings.</p><h3>Survival</h3><p>Select berries in slot 3 and use the selected item to eat. Shelter and fire restore warmth. A planter produces four berries every 45 seconds of active play. Use your campfire to turn two berries and one timber into a trail meal (four minutes of reduced energy use) or warming broth (two minutes of reduced exposure). A new meal replaces the previous preparation; recovered equipment still works alongside it. Scavenging spots replenish after a minute. If exposure overwhelms you, you return safely with your belongings.</p></div>`;
  if(state.chapter.complete)renderRoutes();
  if(state.chapter.recovered&&!state.chapter.complete){const note=document.createElement('p');note.textContent='Echo crystal recovered. Return it to your shelter.';$('panel-body').append(note);}
}
function showCampfire(fire){
  openPanel('journal');$('panel-title').textContent='Campfire';$('panel-kicker').textContent='COOKING';
  const current=MEALS[state.preparation.meal];
  $('panel-body').innerHTML=`<div class="journal"><p>Cook with resources from your planter and campfire.</p>${current?`<p class="preparation-current">${current.name} · ${Math.ceil(state.preparation.remaining/60)} min remaining. A new meal replaces this effect.</p>`:''}<div class="recipe-grid">${Object.entries(MEALS).map(([kind,m])=>`<article class="recipe"><h3>${m.name}</h3><p>${m.description}</p><div class="cost">${costMarkup(m.cost)}</div><button data-meal="${kind}" ${affordable(state,m.cost)?'':'disabled'}>Cook and eat</button></article>`).join('')}</div><p class="muted">Preparation lasts during active play. Menus and time away do not use it up. You can always explore without a meal.</p><button class="primary" id="leave-fire">Close</button></div>`;
  document.querySelectorAll('[data-meal]').forEach(b=>b.onclick=()=>{if(prepareMeal(state,b.dataset.meal,fire)){save();refreshUI();closePanel();tone('build');showToast(MEALS[b.dataset.meal].name+' prepared. You are ready to head out.');}});$('leave-fire').onclick=closePanel;
}
function renderRoutes(){
  const section=document.createElement('section');section.className='expedition-routes';
  section.innerHTML=`<p class="eyebrow">EQUIPMENT</p><h3>Wrecks on the sky island</h3><p>Both wrecks stay available. Recovered equipment works immediately; change your loadout at a workbench.</p><div class="recipe-grid">${WRECKS.map(w=>`<article class="recipe"><p class="eyebrow">${w.direction}</p><h3>${w.title}</h3><p>${w.description}</p><button data-route="${w.id}" ${state.expedition.recovered.includes(w.id)?'disabled':''}>${state.expedition.recovered.includes(w.id)?'Recovered':state.expedition.tracked===w.id?'Following this route':'Follow this route'}</button></article>`).join('')}</div>`;
  $('panel-body').append(section);section.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>{state.expedition.tracked=b.dataset.route;save();refreshUI();closePanel();showToast('Route marked. Both wrecks remain available.');});
}
function renderEquipment(){
  if(!state.expedition.recovered.length)return;
  const bench=state.buildings.find(b=>b.kind==='bench'&&Math.hypot(b.x-state.player.x,b.z-state.player.z)<=3.5);
  const section=document.createElement('section');section.className='expedition-routes';
  section.innerHTML=`<p class="eyebrow">RECOVERED EQUIPMENT</p><p>${bench?'One loadout at a time. Refit freely; you keep every recovered item.':'Visit a workbench to change your loadout.'}</p><div class="recipe-grid">${WRECKS.filter(w=>state.expedition.recovered.includes(w.id)).map(w=>`<article class="recipe"><h3>${w.title}</h3><p>${w.description}</p><button data-equip="${w.id}" ${!bench||state.expedition.equipped===w.id?'disabled':''}>${state.expedition.equipped===w.id?'Equipped':'Equip'}</button></article>`).join('')}</div>`;
  $('panel-body').prepend(section);section.querySelectorAll('[data-equip]').forEach(b=>b.onclick=()=>{if(equipAtBench(state,b.dataset.equip,bench)){tone('equip');save();if(activePanel==='inventory')renderInventory();else renderCraft();showToast('Equipment changed. Your other loadout is kept.');}});
}
function showEquipment(id){
  openPanel('journal');const w=WRECKS.find(w=>w.id===id);$('panel-title').textContent=w.title;$('panel-kicker').textContent='RECOVERED AND EQUIPPED';
  $('panel-body').innerHTML=`<div class="journal chapter-note"><p>${w.description}</p><p>This is yours now. Bring it back to your shelter, or explore the other wreck. You can refit either recovered item at your workbench for free.</p><button class="primary" id="equipment-continue">Put it to use</button></div>`;$('equipment-continue').onclick=closePanel;
}
function openPanel(name){if(riftSession||arrivalTime!==null)return;cancelBindingCapture();cancelBuild();activePanel=name;panel.dataset.screen=name;$('panel-status').textContent='';setPaused(true);if(name==='craft'||name==='workbench')renderCraft();else if(name==='missions')renderMissions();else if(name==='inventory')renderInventory();else if(name==='journal')renderJournal();else if(name==='bed')renderBed();else if(name==='controls')renderControls();else if(name==='settings')renderSettings();else renderPause();if(!panel.open)panel.showModal();if(input.device==='gamepad')focusMenuDefault();if(!started){const craft=$('inventory-craft');if(craft)craft.hidden=true;const home=$('return-home');if(home)home.hidden=true;const resume=$('resume');if(resume)resume.textContent='Back';}}
function closePanel(){cancelBindingCapture();if(panel.open)panel.close();activePanel='';if(started){setPaused(false);captureMouse();}else updateTitle();}
function quitToMainMenu(){
 if(!started)return;
 const saved=save();
 cancelBindingCapture();cancelBuild();setPaused(true);started=false;arrivalTime=null;
 $('skip-arrival').hidden=true;if(panel.open)panel.close();activePanel='';
 document.body.dataset.intro='true';document.body.dataset.worldVisible='false';orbitTime=0;start.scrollTop=0;
 $('start-button').innerHTML='<span>'+(state.missions.completed.includes('equipment-return')?'VIEW ENDING':'CONTINUE')+'</span>'+menuArrow;
 updateTitle();start.showModal();requestMenuMusic();
 if(!saved&&!saveProblem){$('start-note').textContent='Progress could not be saved on this device.';$('start-note').hidden=false;}
}

panel.addEventListener('cancel',e=>{e.preventDefault();tone('back');closePanel();});
panel.addEventListener('click',e=>{const bounds=panel.getBoundingClientRect();if(e.target===panel&&(e.clientX<bounds.left||e.clientX>bounds.right||e.clientY<bounds.top||e.clientY>bounds.bottom)){tone('back');closePanel();}});
$('close-panel').onclick=closePanel;
$('inventory-button').onclick=()=>openPanel('inventory');
$('pause-button').onclick=()=>openPanel('pause');$('journal-button').onclick=()=>openPanel('missions');
function startBuild(kind,station=null){if(!canCraft(state,kind,station))return;cancelBuild();buildStationId=station?.id??null;buildKind=kind;ghost=makeBuilding(kind,{ghost:true});world.scene.add(ghost);$('build-hint').hidden=false;$('build-name').textContent=RECIPES[kind].name;closePanel();updateBuildHint();$('touch-gather').setAttribute('aria-label','Place building');$('touch-gather').title='Place';$('touch-gather-icon').setAttribute('href','survival/ui/touch-actions.svg#place');}
function cancelBuild(){if(ghost){world.scene.remove(ghost);ghost.traverse(o=>{o.geometry?.dispose();if(o.isMesh)o.material.dispose();});}ghost=null;buildKind=null;buildStationId=null;buildPosition=null;$('build-hint').hidden=true;$('touch-gather').setAttribute('aria-label','Hold to gather');$('touch-gather').title='Gather';$('touch-gather-icon').setAttribute('href','survival/ui/touch-actions.svg#gather');}
function updateGhost(){
  if(!ghost)return;const distance=RECIPES[buildKind].attachment?4:RECIPES[buildKind].radius+3,x=state.player.x-Math.sin(state.player.yaw)*distance,z=state.player.z-Math.cos(state.player.yaw)*distance;
  buildPosition=constructionPose(state,buildKind,x,z,buildRotation);placementError=placementCheck(world,state,buildKind,buildPosition.x,buildPosition.z,state.player,buildPosition);
  if(!canPlaceBuilding(state,buildKind,buildStationId))placementError=RECIPES[buildKind].station&&!state.buildings.some(b=>b.id===buildStationId)?'Workbench unavailable':'You need more materials';ghost.position.set(buildPosition.x,buildPosition.y,buildPosition.z);ghost.rotation.y=buildPosition.rotation;
  ghost.traverse(o=>{if(o.isMesh)o.material.color.set(placementError?0xe99b7a:0xb6edb0);});$('build-status').textContent=placementError||'Clear ground. Ready to build.';
}
function refreshTarget(){
  camera.rotation.set(state.player.pitch,state.player.yaw,0,'YXZ');
  camera.updateMatrixWorld();
  findTarget();
}
function primaryAction(){
  if(paused||!started||transitioning)return;
  if(buildKind){
    if(state.time-lastUse<.28)return;lastUse=state.time;
    updateGhost();
    if(placementError){showToast(placementError);tone('error');return;}
    const b=placeBuilding(state,buildKind,buildPosition.x,buildPosition.z,buildPosition.rotation,{...buildPosition,stationId:buildStationId});
    if(b){world.addBuilding(b);showToast(`${RECIPES[b.kind].name} built.`);tone('build');cancelBuild();save();refreshUI();}
    return;
  }
  if(state.time-lastGather<.28)return;
  refreshTarget();
  if(target?.type!=='node')return;
  lastGather=state.time;
  const hit=gathering.hit(state,target.data);
  if(hit){swing=.25;tone(target.data.type);if(hit.result){const result=hit.result;tone('collect');world.nodes.get(target.data.id).visible=false;showToast(`+${result.amount} ${ITEMS[result.type]}`);save();}findTarget();}
}
function interact(){
  if(paused||!started||transitioning||buildKind)return;
  refreshTarget();
  if(!target||target.type==='node'||state.time-lastUse<.28)return;
  lastUse=state.time;
  if(target.type==='portal'){
    if(target.data.id==='haven'&&surveyRift(state)){tone('travel');save();refreshUI();showChapter('rift');return;}
    if(!state.watch){if(!hasBuilding(state,'anchor')){showToast('Build a stability anchor before repairing the VPS watch.');tone('error');}else if(!affordable(state,WATCH_COST)){showToast('Repair needs 4 VPS salvage and 2 rift crystals.');tone('error');}else if(repairWatch(state)){showToast('VPS watch repaired. Use the rift again to cross.');tone('travel');save();}}
    else enterRift(target.data.destination);
  }
  if(target.type==='wreck'){if(recoverEquipment(state,target.data.id)){save();tone('scrap');tone('collect');showEquipment(target.data.id);}}
  if(target.type==='crystal'){if(recoverCrystal(state)){save();sound.effect('portal',.25);showChapter('crystal');}}
  if(target.type==='building'){
    const b=target.data;if(b.kind==='garden'){if(harvestGarden(state,b)){showToast('+4 Berries from your planter');tone('berries');tone('collect');save();}else{showToast('Growing. Come back in a little while.');tone('error');}}
    else if(b.kind==='fire'){tone('select');showCampfire(b);}else if(b.kind==='bench'){tone('select');openPanel('workbench');}else if(b.kind==='bed'){tone('select');activeBedId=b.id;openPanel('bed');}else if(b.kind==='shelter'||b.kind==='roof'){state.warmth=100;if(returnCrystal(state,b)){tone('objective');save();showChapter('complete');}else if(returnEquipment(state,b)){tone('objective');save();showToast('Equipment brought home. Expedition complete.');}else{tone('select');showToast('A moment of shelter. Warmth restored.');save();}}
    else{tone('select');showToast(b.kind==='anchor'?'This anchor keeps a little piece of reality steady.':RECIPES[b.kind].modular?'Aim at a piece to dismantle it. Remove walls and roofs before their foundation.':'Stay close to restore warmth.');}
  }refreshUI();
}

function showChapter(kind){
  openPanel('journal');
  const complete=kind==='complete',crystal=kind==='crystal';
  $('panel-title').textContent=complete?'Crystal secured':crystal?'Echo crystal recovered':'A broken passage';
  $('panel-kicker').textContent=complete?'CRYSTAL RETURNED':crystal?'ECHO CRYSTAL':'THE RIFT';
  $('panel-body').innerHTML=`<div class="journal chapter-note"><p>${complete?'The Echo crystal is secured at your shelter.':crystal?'You recovered the Echo crystal from the ruined arch.':'Inside the Axio, this island is only the beginning. The rift is dormant; another island hangs beyond it.'}</p><p>${complete?'Search the outer-island wrecks for equipment. Your rift passage remains open.':crystal?'Bring it back through the rift to your storm shelter or canopy.':'For now, make a field axe and find shelter before trying to cross.'}</p><button class="primary" id="chapter-continue">Continue</button></div>`;
  if(complete)renderRoutes();
  $('chapter-continue').onclick=closePanel;
}
function enterRift(destination){
  if(riftSession||transitioning||!state.watch)return;
  tone('travel');
  const passage='haven-echo',trial=encounterRift(state,passage);
  save();if(!trial){travelTo(destination);return;}
  cancelBuild();setPaused(true);
  const token=crypto.randomUUID(),frame=document.createElement('iframe');
  const url=new URL('trials.html',location.href);url.searchParams.set('rift',trial);url.searchParams.set('token',token);
  
  frame.title='Rift passage';frame.allow='autoplay';frame.src=url.href;
  riftSession={frame,token,trial,passage,destination};$('rift-frame').replaceChildren(frame);$('rift-challenge').showModal();
  frame.onload=()=>frame.contentWindow?.focus();
}
function leaveRift(){
  if(!riftSession)return;const frame=riftSession.frame;riftSession=null;frame.remove();$('rift-challenge').close();canvas.focus();
  setPaused(false);lastUse=state.time-.3;showToast('Back on the island. The same passage waits when you are ready.');
}
$('leave-rift').onclick=leaveRift;$('rift-challenge').addEventListener('cancel',e=>{e.preventDefault();leaveRift();});
window.addEventListener('message',e=>{
  const r=riftSession;
  if(!r||e.origin!==location.origin||e.source!==r.frame.contentWindow||e.data?.token!==r.token||e.data?.trial!==r.trial)return;
  if(e.data.type==='rift-retreat'){leaveRift();return;}
  if(e.data.type!=='rift-cleared'||!clearRift(state,r.passage,r.trial))return;
  save();riftSession=null;r.frame.remove();$('rift-challenge').close();canvas.focus();
  setPaused(false);travelTo(r.destination);
});
async function travelTo(id){
  if(transitioning)return;transitioning=true;keys.clear();save();
  const overlay=$('rift-transition');overlay.hidden=false;overlay.dataset.active='true';$('transition-label').textContent=id==='echo'?'SKY ISLAND':'STARTING ISLAND';sound.effect('portal',.45);
  await new Promise(r=>setTimeout(r,450));
  const dest=world.portals.find(p=>p.id===id);state.player.x=dest.x;state.player.z=dest.z+(id==='echo'?-6:6);state.player.yaw=0;state.player.pitch=0;y=floorHeight(state,state.player.x,state.player.z);vy=0;resetMotion(motion);
  if(!state.visited.includes(id))state.visited.push(id);save();refreshUI();
  await new Promise(r=>setTimeout(r,350));overlay.dataset.active='false';transitioning=false;
  showToast(id==='echo'?(state.chapter.recovered?'East: cargo wreck. West: weather station. Choose a wreck to search.':'The Echo crystal is beyond the ruined arch on the sky island.'):'Returned to the starting island.');
  setTimeout(()=>{overlay.hidden=true;},350);
}
function updateGuide(goal){
  const island=regionAt(state.player.x,state.player.z).id;
  const portal=id=>world?.portals.find(p=>p.id===id);
  const bench=startingWorkbench(state);
  const towardHome=()=>({point:portal('echo'),label:'Return rift'});
  const towardSky=()=>({point:portal('haven'),label:'Rift to sky island'});
  const materials=()=>{
    const cost=missionCost(state,RECIPES,WATCH_COST);
    const needed=Object.keys(cost).filter(type=>state.inventory[type]<cost[type]);
    if(!needed.length)return null;
    const local=NODES.filter(n=>needed.includes(n.type)&&regionAt(n.x,n.z).id===island&&!state.buildings.some(b=>Math.hypot(n.x-b.x,n.z-b.z)<RECIPES[b.kind].radius+.6));
    const ready=local.filter(n=>available(state,n)).sort((a,b)=>Math.hypot(a.x-state.player.x,a.z-state.player.z)-Math.hypot(b.x-state.player.x,b.z-state.player.z));
    if(ready.length)return {point:ready[0],label:ITEMS[ready[0].type]};
    const replenishing=local.filter(n=>state.harvested[n.id]!==undefined).sort((a,b)=>(state.harvested[a.id]-state.time)-(state.harvested[b.id]-state.time));
    if(replenishing.length){const n=replenishing[0];return {point:n,label:`${ITEMS[n.type]} in ${Math.max(1,Math.ceil(60-(state.time-state.harvested[n.id])))}s`};}
    return {hint:`Find ${needed.map(type=>ITEMS[type]).join(' / ')}`};
  };
  let guide=null;
  if(goal.target==='explore')guide={hint:'Expedition complete'};
  else if(island==='echo'&&['observe','axe','shelter','bench','anchor','watch','return','equipment-return'].includes(goal.target))guide=towardHome();
  else if(goal.target==='observe')guide={point:portal('haven'),label:'Dormant rift'};
  else if(goal.target==='recover')guide=island==='echo'?{point:ECHO_CRYSTAL,label:'Echo crystal'}:towardSky();
  else if(goal.target==='travel')guide=island==='echo'?{hint:'Rift crossed'}:towardSky();
  else if(goal.target==='equipment')guide=island==='echo'?{point:trackedWreck(state),label:trackedWreck(state)?.name}:towardSky();
  else if(['return','equipment-return'].includes(goal.target)&&island==='echo')guide=towardHome();
  else if(['return','equipment-return'].includes(goal.target)&&homeShelter(state))guide={point:homeShelter(state),label:'Your shelter'};
  else {
    guide=materials();
    if(!guide){
      const craft=keyLabel(bind('craft'));
      const needsShelter=goal.target==='shelter'||['return','equipment-return'].includes(goal.target)&&!homeShelter(state);
      const stage=needsShelter?shelterStage(state):null;
      if(stage==='upgrade'&&homeBed(state))guide={point:homeBed(state),label:'Upgrade bed'};
      else if(stage==='kit'&&bench)guide={point:bench,label:'Craft shelter kit'};
      else if((goal.target==='anchor'||goal.target==='watch'&&!hasBuilding(state,'anchor'))&&bench)guide={point:bench,label:'Workbench'};
      else{
        const action=goal.target==='axe'?'Craft field axe'
          :needsShelter&&stage==='bed'?'Place bed'
          :needsShelter&&stage==='bench'?'Place workbench'
          :goal.target==='bench'?'Place workbench'
          :goal.target==='anchor'&&!bench?'Place workbench'
          :goal.target==='anchor'?'Use workbench'
          :goal.target==='watch'&&!bench?'Place workbench'
          :goal.target==='watch'&&!hasBuilding(state,'anchor')?'Use workbench':null;
        guide=action?{hint:`${craft} · ${action}`}:{point:portal('haven'),label:'Old rift'};
      }
    }
  }
  if(!guide?.point){$('trail-guide').textContent=guide?.hint||'Continue the mission';return;}
  const {point,label}=guide,dx=point.x-state.player.x,dz=point.z-state.player.z;
  const angle=Math.atan2(-dx,-dz)-state.player.yaw,arrow=['↑','↖','←','↙','↓','↘','→','↗'][((Math.round(angle/(Math.PI/4))%8)+8)%8];
  $('trail-guide').textContent=`${arrow} ${label} · ${Math.round(Math.hypot(dx,dz))} m`;
}

function eatBerry(){if(eat(state)){showToast('A small meal. +30 energy.');tone('eat');save();refreshUI();}else{tone('error');showToast(state.inventory.berries?'You are already well fed.':'Find a berry bush or build a planter.');}}
$('touch-gather').onpointerdown=e=>{if(paused)return;e.preventDefault();gatherPointerId=e.pointerId;gatherHeld=!buildKind;e.currentTarget.setPointerCapture(e.pointerId);primaryAction();};
$('touch-gather').onpointerup=$('touch-gather').onpointercancel=$('touch-gather').onlostpointercapture=e=>{if(e.pointerId===gatherPointerId){gatherHeld=false;gatherPointerId=null;}};
$('touch-gather').onclick=e=>{if(e.detail===0)primaryAction();};
$('touch-use').onclick=interact;
$('touch-sprint').onpointerdown=e=>{if(paused)return;e.preventDefault();touchSprintHeld=true;e.currentTarget.setPointerCapture(e.pointerId);};
$('touch-sprint').onpointerup=$('touch-sprint').onpointercancel=$('touch-sprint').onlostpointercapture=()=>{touchSprintHeld=false;};
$('touch-jump').onpointerdown=e=>{if(paused)return;e.preventDefault();touchJumpHeld=true;e.currentTarget.setPointerCapture(e.pointerId);};
$('touch-jump').onpointerup=$('touch-jump').onpointercancel=$('touch-jump').onlostpointercapture=()=>{touchJumpHeld=false;};
$('touch-jump').onclick=e=>{if(e.detail===0&&!paused&&onGround&&spendJump(stamina)){vy=6.8;onGround=false;tone('jump');renderStamina();}};
$('rotate-build').onclick=()=>{buildRotation+=Math.PI/2;tone('adjust');};$('cancel-build').onclick=cancelBuild;
function findTarget(){
  let best=null,score=Infinity;camera.getWorldDirection(direction);
  const consider=(type,data,x,z,height=1,range=3.5)=>{const dx=x-state.player.x,dz=z-state.player.z,dist=Math.hypot(dx,dz);if(dist>range)return;const facing=dist>.2?(dx*direction.x+dz*direction.z)/dist:1;if(facing<.4&&dist>1.2)return;const rank=dist+(1-facing)*2;if(rank<score){score=rank;best={type,data};}};
  NODES.forEach(n=>{if(!available(state,n)||Math.hypot(n.x-state.player.x,n.z-state.player.z)>3.5)return;const point=new THREE.Vector3(n.x,terrain(n.x,n.z)+.6,n.z),reach=point.clone().sub(camera.position);reachRaycaster.set(camera.position,reach.clone().normalize());const obstacle=reachRaycaster.intersectObjects([...world.buildings.values()],true)[0];if(!obstacle||obstacle.distance>=reach.length()-.2)consider('node',n,n.x,n.z);});world.portals.forEach(p=>consider('portal',p,p.x,p.z,2.5,5));for(const b of state.buildings)if(!RECIPES[b.kind].modular)consider('building',b,b.x,b.z,1,3.5);WRECKS.forEach(w=>{if(!state.expedition.recovered.includes(w.id))consider('wreck',w,w.x,w.z,1,3.5);});if(!state.chapter.recovered)consider('crystal',ECHO_CRYSTAL,ECHO_CRYSTAL.x,ECHO_CRYSTAL.z,1,3.5);raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const hit=raycaster.intersectObjects([...world.buildings.values()],true)[0];if(hit&&hit.distance<6){let root=hit.object;while(root.parent&&root.parent!==world.scene)root=root.parent;const b=state.buildings.find(b=>world.buildings.get(b.id)===root);if(b&&(b.kind!=='bed'||Math.hypot(b.x-state.player.x,b.z-state.player.z)<=3.5))best={type:'building',data:b};}target=best;
  let name='',action='';
  if(best&&!buildKind){
    if(best.type==='crystal'){name=ECHO_CRYSTAL.name;action=actionHint('interact')+' Recover crystal';}
    else if(best.type==='wreck'){name=best.data.name;action=actionHint('interact')+' Recover '+best.data.title.toLowerCase();}
    else if(best.type==='node'){name=ITEMS[best.data.type];action=actionHint('gather')+' '+gathering.remaining(best.data)+' hits';}
    else if(best.type==='portal'){name='VPS rift';action=actionHint('interact')+(best.data.id==='haven'&&!state.chapter.observed?' Examine':state.watch?' Cross to '+(best.data.destination==='echo'?'sky island':'starting island'):' Repair watch');}
    else{
      name=RECIPES[best.data.kind].name;
      action=actionHint('interact')+(best.data.kind==='garden'?' Harvest berries':best.data.kind==='bench'?' Craft':best.data.kind==='fire'?' Prepare a meal':best.data.kind==='bed'?(state.inventory.shelterKit?' Upgrade bed':' Inspect bed'):' Use');
      action+=' · '+actionHint('dismantle')+' Dismantle & refund';
    }
  }
  $('target-label').textContent=name;$('target-action').innerHTML=action;
}
function returnHome(recoverVitals=true){const b=homeShelter(state)||homeBed(state);state.player.x=b?b.x:0;state.player.z=b?b.z+4.5:18;
  // Choose a safe point near the shelter instead of spawning inside a post or sea.
  if(b){for(let n=0;n<12;n++){const a=n/12*Math.PI*2,x=b.x+Math.sin(a)*4.7,z=b.z+Math.cos(a)*4.7,h=terrain(x,z);if(h>.5&&!playerCollides(world,state,x,h,z)){state.player.x=x;state.player.z=z;break;}}}
  y=floorHeight(state,state.player.x,state.player.z);vy=0;jumpArmed=false;resetStamina(stamina);renderStamina();if(recoverVitals){state.warmth=Math.max(60,state.warmth);state.food=Math.max(45,state.food);}
}
function renderStamina(){
  const amount=Math.ceil(stamina.value),meter=$('stamina'),number=$('stamina-number');
  meter.value=stamina.value;if(number.textContent!==String(amount))number.textContent=String(amount);
  document.body.dataset.stamina=stamina.exhausted?'exhausted':'ready';
}
function refreshUI(){
  renderStamina();
  const goal=objective(state),mission=currentMission(state);$('objective-title').textContent=goal.title;$('objective-text').textContent=goal.text;updateGuide(goal);
  const details=missionSteps(state,RECIPES,WATCH_COST),signature=JSON.stringify(details)+mission?.id;if($('mission-progress').dataset.signature!==signature){$('mission-progress').dataset.signature=signature;$('mission-progress').textContent=details.filter(s=>s.item).map(s=>ITEMS[s.item]+' '+s.current+'/'+s.required).join(' · ');$('mission-reward').textContent=mission?'Reward · '+rewardText(mission.reward):'';}
  renderHotbar();
  $('warmth').value=state.warmth;$('food').value=state.food;$('warmth-number').textContent=Math.round(state.warmth);$('food-number').textContent=Math.round(state.food);
  const loadout=WRECKS.find(w=>w.id===state.expedition.equipped);const meal=MEALS[state.preparation.meal],seconds=Math.ceil(state.preparation.remaining);$('equipment-label').textContent=[loadout?.title,meal?`${meal.name} · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:null].filter(Boolean).join(' · ');
  $('region').textContent=regionAt(state.player.x,state.player.z).name.toUpperCase();const period=dayPeriod(state.time);$('day').textContent=`DAY ${String(Math.floor(state.time/DAY_SECONDS)+1).padStart(2,'0')} · ${period}`;
}
function setResolution(){if(!renderer||!camera)return;const dpr=devicePixelRatio,q=state.settings.quality,base=q==='performance'?Math.min(1,dpr*.75):q==='high'?Math.min(2,dpr*1.25):Math.min(1.5,dpr);renderer.setPixelRatio(Math.min(2.25,base*state.settings.renderScale));renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.fov=state.settings.fov;camera.updateProjectionMatrix();}
function applyQuality(){setResolution();}
function look(dx,dy){state.player.yaw-=dx*.002*state.settings.sensitivity;state.player.pitch=THREE.MathUtils.clamp(state.player.pitch-dy*.002*state.settings.sensitivity*(state.settings.invertY?-1:1),-1.3,1.3);}
canvas.addEventListener('wheel',e=>{if(!started||paused||transitioning||riftSession||buildKind||!e.deltaY)return;e.preventDefault();cycleTool(state,e.deltaY);equipTool(equippedTool(state));},{passive:false});
document.addEventListener('mousemove',e=>{if(!paused&&document.pointerLockElement===canvas)look(e.movementX,e.movementY);});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{if(paused)return;if(document.pointerLockElement===canvas){if(e.button===0){if(!buildKind){gatherHeld=true;gatherPointerId=e.pointerId;}primaryAction();}else if(e.button===2&&equippedTool(state)==='berries')eatBerry();return;}if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,moved:0,id:e.pointerId};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag||paused||document.pointerLockElement===canvas)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved+=Math.abs(dx)+Math.abs(dy);look(dx,dy);drag.x=e.clientX;drag.y=e.clientY;});
canvas.addEventListener('pointerup',e=>{if(drag?.id===e.pointerId&&drag.moved<5&&!touch)captureMouse();if(drag?.id===e.pointerId)drag=null;});canvas.addEventListener('pointercancel',e=>{if(drag?.id===e.pointerId)drag=null;if(gatherPointerId===e.pointerId){gatherHeld=false;gatherPointerId=null;}});
document.addEventListener('pointerup',e=>{if(e.pointerId===gatherPointerId){gatherHeld=false;gatherPointerId=null;}});
document.addEventListener('pointerlockchange',()=>{
  // A pending browser lock request can finish after a menu has opened.
  if(document.pointerLockElement&&paused){document.exitPointerLock();return;}
  if(!document.pointerLockElement&&started&&!paused&&!buildKind)openPanel('pause');
});
document.addEventListener('keydown',e=>{
  if(feedback.isOpen)return;
  if(e.code==='Escape'&&panel.open){e.preventDefault();if(!e.repeat){tone('back');closePanel();}return;}
  if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  if(!started||riftSession)return;
  if(['Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight',...Object.values(state.settings.bindings)].includes(e.code))e.preventDefault();
  if(e.code==='Escape'){e.preventDefault();if(buildKind){tone('back');cancelBuild();return;}if(!e.repeat){tone('select');openPanel('pause');}return;}
  if(!e.repeat&&(e.code===bind('inventory')||e.code==='Tab')){const closing=activePanel==='inventory'&&panel.open;tone(closing?'back':'select');closing?closePanel():openPanel('inventory');return;}
  if(!e.repeat&&e.code===bind('craft')){const closing=activePanel==='craft'&&panel.open;tone(closing?'back':'select');closing?closePanel():openPanel('craft');return;}
  if(!e.repeat&&e.code===bind('missions')){const closing=activePanel==='missions'&&panel.open;tone(closing?'back':'select');closing?closePanel():openPanel('missions');return;}
  if(paused)return;
  if(!e.repeat&&e.code===bind('tool1')){equipTool(TOOL_SLOTS[0].id);return;}
  if(!e.repeat&&e.code===bind('tool2')){equipTool(TOOL_SLOTS[1].id);return;}
  if(!e.repeat&&e.code===bind('tool3')){equipTool(TOOL_SLOTS[2].id);return;}
  keys.add(e.code);if(e.repeat)return;
  if(state.settings.sprintMode==='toggle'&&e.code===bind('sprint'))sprintToggled=!sprintToggled;
  if(e.code===bind('use'))interact();if(e.code===bind('rotate')&&buildKind){buildRotation+=Math.PI/2;tone('adjust');}
  if(e.code===bind('dismantle'))dismantleTarget();
  // Held jump is resolved on landing in updatePlayer; stamina limits repeated jumps.
});document.addEventListener('keyup',e=>keys.delete(e.code));
function dismantleTarget(){
 if(buildKind||target?.type!=='building')return;
 const b=target.data;
 if(dismantle(state,b.id)){world.removeBuilding(b.id);tone('wood');tone('collect');showToast('Dismantled. All materials returned.');save();refreshUI();}
 else{tone('error');showToast('Remove the walls and roof from this foundation first. Their materials are fully refunded.');}
}
function menuFocusables(){
 const root=document.querySelector('#playtest-survey[open]')||(panel.open?panel:start.open?start:null);
 return root?[...root.querySelectorAll('button:not([disabled]):not([hidden]),select:not([disabled]),input:not([disabled]),a[href]')].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'):[];
}
function focusMenuDefault(){const items=menuFocusables();if(!items.length||items.includes(document.activeElement))return;const preferred=items.find(el=>el.classList.contains('menu-choice')||el.id==='start-button'||el.id==='resume-trials'||el.classList.contains('primary'))||items.find(el=>el.closest('#panel-body'));(preferred||items[0]).focus({preventScroll:true});}
function moveMenuFocus(direction){
 const items=menuFocusables();if(!items.length)return;
 const index=items.indexOf(document.activeElement);
 items[(index+direction+items.length)%items.length].focus({preventScroll:true});
}
function adjustMenuValue(direction){
 const el=document.activeElement;
 if(el?.tagName==='SELECT'){el.selectedIndex=(el.selectedIndex+direction+el.options.length)%el.options.length;el.dispatchEvent(new Event('change',{bubbles:true}));}
 else if(el?.type==='range'){direction>0?el.stepUp():el.stepDown();el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
}
function activateMenuFocus(){focusMenuDefault();const el=document.activeElement;if(el?.tagName==='SELECT'||el?.type==='range')adjustMenuValue(1);else el?.click();}
let nextMenuStick=0;
function handleGamepad(pad){
 if(!pad)return;
 if(pad.pressed.size)void sound.unlock();
 const hit=action=>pad.pressed.has(PAD_BUTTON[action]);
 if(feedback.isOpen){if(hit('confirm'))activateMenuFocus();else if(hit('down'))moveMenuFocus(1);else if(hit('missions'))moveMenuFocus(-1);return;}
 if(start.open||panel.open){
   const now=performance.now();
   if(hit('down')||(pad.moveY>.55&&now>=nextMenuStick)){moveMenuFocus(1);nextMenuStick=now+220;}
   if(hit('missions')||(pad.moveY<-.55&&now>=nextMenuStick)){moveMenuFocus(-1);nextMenuStick=now+220;}
   if(hit('left'))adjustMenuValue(-1);
   if(hit('craft'))adjustMenuValue(1);
   if(hit('confirm'))activateMenuFocus();
   if(hit('back')||hit('pause')){if(panel.open){tone('back');closePanel();}}
   return;
 }
 if(!started||riftSession||transitioning)return;
 if(hit('pause')){tone('select');openPanel('pause');return;}
 if(paused)return;
 if(hit('sprint')&&state.settings.sprintMode==='toggle')sprintToggled=!sprintToggled;
 if(hit('inventory')){tone('select');openPanel('inventory');return;}
 if(hit('missions')){tone('select');openPanel('missions');return;}
 if(hit('craft')){if(buildKind){buildRotation+=Math.PI/2;tone('adjust');}else{tone('select');openPanel('craft');}return;}
 if(hit('down'))dismantleTarget();
 if(hit('previous')||hit('next')){cycleTool(state,hit('next')?1:-1);equipTool(equippedTool(state));}
 if(hit('useItem')&&equippedTool(state)==='berries')eatBerry();
 if(hit('interact'))interact();
 if(hit('back')&&buildKind)cancelBuild();
 if(pad.held.has(PAD_BUTTON.gather))primaryAction();
}
const movementPad=$('movement-pad'),movementThumb=$('movement-thumb');
function updateTouchStick(e){
  const bounds=movementPad.getBoundingClientRect(),radius=Math.min(bounds.width,bounds.height)*.34;
  const dx=e.clientX-(bounds.left+bounds.width/2),dy=e.clientY-(bounds.top+bounds.height/2),length=Math.hypot(dx,dy),scale=length>radius?radius/length:1;
  movementThumb.style.setProperty('--stick-x',`${dx*scale}px`);movementThumb.style.setProperty('--stick-y',`${dy*scale}px`);
  touchStick=touchStickVector(dx,dy,radius);
}
function releaseTouchStick(e){if(e.pointerId!==activeStickPointer)return;activeStickPointer=null;touchStick={x:0,y:0};movementThumb.style.setProperty('--stick-x','0px');movementThumb.style.setProperty('--stick-y','0px');}
movementPad.onpointerdown=e=>{if(paused||activeStickPointer!==null)return;e.preventDefault();activeStickPointer=e.pointerId;movementPad.setPointerCapture(e.pointerId);updateTouchStick(e);};
movementPad.onpointermove=e=>{if(e.pointerId===activeStickPointer)updateTouchStick(e);};
movementPad.onpointerup=movementPad.onpointercancel=movementPad.onlostpointercapture=releaseTouchStick;
window.addEventListener('blur',()=>{cancelBindingCapture();keys.clear();if(started&&!paused)openPanel('pause');});document.addEventListener('visibilitychange',()=>{if(document.hidden){menuMusic.pause();if(started){save();if(!paused)openPanel('pause');}}else requestMenuMusic();});window.addEventListener('pagehide',()=>{if(started)save();});
window.addEventListener('resize',()=>{if(renderer)setResolution();});
document.addEventListener('fullscreenchange',()=>{const button=$('fullscreen-toggle');if(button)button.textContent=document.fullscreenElement?'Exit fullscreen':'Enter fullscreen';});

function updatePlayer(dt,pad){
  const forward=(Number(keys.has(bind('forward'))||keys.has('ArrowUp'))-Number(keys.has(bind('back'))||keys.has('ArrowDown')))-(pad?.moveY||0)-touchStick.y,side=(Number(keys.has(bind('right'))||keys.has('ArrowRight'))-Number(keys.has(bind('left'))||keys.has('ArrowLeft')))+(pad?.moveX||0)+touchStick.x;
  const wantsSprint=touchSprintHeld||(state.settings.sprintMode==='toggle'?sprintToggled:keys.has(bind('sprint'))||pad?.held.has(PAD_BUTTON.sprint));
  const sprintSpeed=!!(forward||side)&&wantsSprint&&canSprint(stamina);
  const speed=(sprintSpeed?7:4.4)*(state.food<15?.8:1);
  const jumpHeld=keys.has(bind('jump'))||touchJumpHeld||!!pad?.held.has(PAD_BUTTON.confirm);
  if(!jumpHeld)jumpArmed=true;
  else if(jumpArmed&&onGround&&spendJump(stamina)){vy=6.8;onGround=false;tone('jump');}
  if(pad&&(pad.lookX||pad.lookY))look(pad.lookX*680*dt,pad.lookY*680*dt);
  const nx=state.player.x-Math.sin(state.player.yaw)*.4,nz=state.player.z-Math.cos(state.player.yaw)*.4;
  const skyborne=regionAt(state.player.x,state.player.z).id==='echo'&&y>0;
  const canMove=(x,z)=>{const h=floorHeight(state,x,z,y);return (h>-.35||skyborne)&&h-y<.55&&!playerCollides(world,state,x,Math.max(y,h),z);};
  const fromX=state.player.x,fromZ=state.player.z;
  const {dx,dz}=movePlayer(state.player,motion,{forward,side,speed,grounded:onGround},dt,canMove);
  const moved=Math.hypot(state.player.x-fromX,state.player.z-fromZ);
  const sprinting=advanceStamina(stamina,dt,{moving:!!(dx||dz),sprintRequested:wantsSprint});
  const wasOnGround=onGround,ground=floorHeight(state,state.player.x,state.player.z,y),ceiling=ceilingHeight(state,state.player.x,state.player.z,y);vy-=18*dt;y+=vy*dt;
  if(y+1.7>ceiling&&vy>0){y=ceiling-1.7;vy=0;}
  if(y<=ground){y=ground;vy=0;onGround=true;if(!wasOnGround){tone('land');stepDistance=0;}}else onGround=false;
  if(onGround&&moved>.01){stepDistance+=moved;if(stepDistance>=2.1){stepDistance%=2.1;tone('step');}}
  renderStamina();
  if(y<0&&regionAt(state.player.x,state.player.z).id==='echo'){returnHome();showToast('You fell from the sky island and returned to shelter.');save();return;}
  state.time+=dt;const night=solarElevation(state.time)<0;
  const sheltered=underRoof(state,state.player.x,state.player.z)||state.buildings.some(b=>['shelter','fire'].includes(b.kind)&&Math.hypot(state.player.x-b.x,state.player.z-b.z)<(b.kind==='shelter'?4:5));
  const cold=regionAt(state.player.x,state.player.z).id==='echo';state.warmth=THREE.MathUtils.clamp(state.warmth+(sheltered?8:night||cold?-exposureRate(state)*preparedExposureRate(state):.3)*dt,0,100);state.food=Math.max(0,state.food-dt*(sprinting?.09:.045)*preparedEnergyRate(state));
  tickPreparation(state,dt);
  if(state.warmth<=0){returnHome();showToast('Exposure brought you back to shelter. Your belongings are safe.');save();}
  const moving=forward||side,bob=state.settings.motion&&moving&&onGround?Math.sin(state.time*10)*.035:0;camera.position.set(state.player.x,y+1.7+bob,state.player.z);camera.rotation.set(state.player.pitch,state.player.yaw,0,'YXZ');
  axe.visible=equippedTool(state)==='axe'&&!buildKind;axe.position.set(.37,-.34+bob,-.65);axe.rotation.set(-.25-swing*3,0,-.3);
  if((dx||dz)&&regionAt(state.player.x,state.player.z).id==='haven'&&terrain(nx,nz)<=-.35&&state.time-lastUse>4){lastUse=state.time;showToast('The water is too deep. Use the rift to reach the sky island.');}
}
function finishArrival(){
  if(started)return;arrivalTime=null;started=true;start.close();$('skip-arrival').hidden=true;document.body.dataset.intro='false';
  document.body.dataset.worldVisible='true';
  camera.position.set(state.player.x,y+1.7,state.player.z);camera.rotation.set(state.player.pitch,state.player.yaw,0,'YXZ');
  setPaused(false);canvas.focus();
  if(state.missions.completed.includes('equipment-return')){endDemo();return;}
  if(saveProblem)showToast(saveProblem);
}
$('skip-arrival').onclick=finishArrival;
function titleCamera(dt){
  if(arrivalTime!==null){
    arrivalTime+=dt;const t=Math.min(1,arrivalTime/2.4),ease=t*t*(3-2*t);
    const end=new THREE.Vector3(state.player.x,y+1.7,state.player.z);
    const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(state.player.pitch,state.player.yaw,0,'YXZ'));
    camera.position.copy(arrivalPosition).lerp(end,ease);camera.quaternion.copy(arrivalRotation).slerp(rotation,ease);
    if(t===1)finishArrival();return;
  }
  if(!reducedMotion())orbitTime+=dt;
  const island=ISLANDS.find(i=>i.id===regionAt(state.player.x,state.player.z).id)||ISLANDS[0];
  const angle=.7+orbitTime*.07,radius=island.radius*1.45;
  camera.position.set(island.x+Math.sin(angle)*radius,32+(island.elevation||0),island.z+Math.cos(angle)*radius);
  camera.lookAt(island.x,2+(island.elevation||0),island.z);
}
function animate(now){
  const elapsed=Math.max(0,now-last);last=now;
  if(document.hidden||riftSession)return;
  const pad=input.poll();refreshInputPresentation();handleGamepad(pad);
  if(start.open&&!launchingFromMenu)return;
  const limit=state.settings.frameLimit;
  if(limit){const interval=1000/limit;frameBudget=Math.min(frameBudget+elapsed,interval*2);if(frameBudget<interval)return;frameBudget%=interval;}else frameBudget=0;
  const dt=Math.min((now-lastFrame)/1000||0,.05);lastFrame=now;
  if(!started)titleCamera(dt);
  if(started&&paused){if(now-lastPausedRender<1000/15)return;lastPausedRender=now;}
  if(started&&!paused&&!transitioning){updatePlayer(dt,pad);updateGhost();if(gatherHeld)primaryAction();uiClock+=dt;saveClock+=dt;swing=Math.max(0,swing-dt);if(uiClock>.15){uiClock=0;refreshUI();findTarget();for(const n of NODES)world.nodes.get(n.id).visible=available(state,n);}if(saveClock>8){saveClock=0;save();}}
  world.update(state.time,state.player,state);renderer.render(world.scene,camera);
}
async function boot(){
  renderer=new THREE.WebGPURenderer({canvas,antialias:true,powerPreference:'high-performance'});await renderer.init();renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=state.settings.quality!=='performance';renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.onDeviceLost=()=>{setPaused(true);$('fatal-message').textContent='The graphics device was interrupted. Your latest save is safe; try reloading.';$('fatal').hidden=false;};
  world=createWorld({quality:state.settings.quality});await world.ready;const environment=new RoomEnvironment();const pmrem=new THREE.PMREMGenerator(renderer);world.scene.environment=pmrem.fromScene(environment,.04).texture;world.scene.environmentIntensity=.4;environment.dispose();pmrem.dispose();state.buildings.forEach(world.addBuilding);for(const n of NODES)world.nodes.get(n.id).visible=available(state,n);
  camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,4000);axe=await makeAxe();axe.visible=false;camera.add(axe);world.scene.add(camera);y=floorHeight(state,state.player.x,state.player.z);camera.position.set(state.player.x,y+1.7,state.player.z);camera.rotation.set(state.player.pitch,state.player.yaw,0,'YXZ');setResolution();settleMissions(state);refreshUI();updateShortcutLabels();
  titleCamera(0);await renderer.compileAsync(world.scene,camera);renderer.setAnimationLoop(animate);$('start-button').disabled=false;$('start-button').innerHTML='<span>'+(state.missions.completed.includes('equipment-return')?'VIEW ENDING':state.savedAt?'CONTINUE':'PLAY')+'</span>'+menuArrow;updateTitle();if(saveProblem){$('start-note').textContent=saveProblem;$('start-note').hidden=false;}
  $('start-button').onclick=launchFromMenu;
}

let launchingFromMenu=false;
const waitForTransition=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function launchFromMenu(){
 if(launchingFromMenu||!start.open)return;
 launchingFromMenu=true;orbitTime=0;titleCamera(0);
 const minimal=reducedMotion(),button=$('start-button'),wipe=$('launch-wipe');
 button.disabled=true;wipe.classList.toggle('is-reduced',minimal);
 start.classList.toggle('is-reduced-launch',minimal);
 start.classList.add('is-launching');
 stopMenuMusic();sound.setVolume(state.settings.sound);sound.setMusicVolume(state.settings.music);sound.setEffectsVolume(state.settings.effects);sound.start();tone('travel');
 await waitForTransition(minimal?20:620);
 wipe.classList.add('is-black');
 await waitForTransition(minimal?160:360);
 document.body.append(wipe);document.body.dataset.worldVisible='true';start.close();
 if(state.missions.completed.includes('equipment-return')){arrivalTime=null;started=true;document.body.dataset.intro='false';endDemo();}
 else if(minimal)finishArrival();else{arrivalTime=0;arrivalPosition=camera.position.clone();arrivalRotation=camera.quaternion.clone();$('skip-arrival').hidden=false;}
 await waitForTransition(40);
 wipe.classList.remove('is-black');
 await waitForTransition(minimal?180:520);
 start.append(wipe);wipe.classList.remove('is-reduced');start.classList.remove('is-launching','is-reduced-launch');button.disabled=false;launchingFromMenu=false;
}

const menuArrow="<svg viewBox=\"0 0 24 24\" width=\"24\" height=\"24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" aria-hidden=\"true\"><path d=\"m9 6 6 6-6 6\"/></svg>";
function updateTitle(){
 const objective=missionObjective(state);
 $('title-save').textContent=objective.title;
 const mission=currentMission(state);
 const makeRow=(label,status)=>{const row=document.createElement('li');row.textContent=label;row.className=status;return row;};
 const completed=MISSIONS.filter(m=>state.missions.completed.includes(m.id)).map(m=>makeRow(m.title,'done'));
 $('journey-toggle').style.setProperty('--journey-progress',`${Math.round(completed.length/MISSIONS.length*100)}%`);
 $('journey-done').replaceChildren(...completed);
 $('journey-completed').hidden=!completed.length;
 const remaining=mission?[makeRow(mission.title,'current')]:[];
 $('journey-left').replaceChildren(...remaining);
 $('journey-remaining').hidden=!remaining.length;
 const soundButton=$('title-sound'),muted=state.settings.sound<=0;
 soundButton.setAttribute('aria-label',muted?'Unmute audio':'Mute audio');
 soundButton.setAttribute('title',muted?'Unmute audio':'Mute audio');
 soundButton.setAttribute('aria-pressed',String(!muted));
}
const journeyWrap=document.querySelector('.journey-wrap'),journeyButton=$('journey-toggle'),journeyDetail=$('journey-detail');
function showJourneyDetail(open){journeyDetail.hidden=!open;journeyButton.setAttribute('aria-expanded',String(open));}
journeyWrap.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')showJourneyDetail(true);});
journeyWrap.addEventListener('pointerleave',()=>{if(document.activeElement!==journeyButton)showJourneyDetail(false);});
journeyButton.addEventListener('focus',()=>showJourneyDetail(true));
journeyButton.addEventListener('click',()=>showJourneyDetail(true));
journeyWrap.addEventListener('focusout',e=>{if(!journeyWrap.contains(e.relatedTarget))showJourneyDetail(false);});
journeyButton.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();showJourneyDetail(false);journeyButton.blur();}});
document.addEventListener('pointerdown',e=>{if(!journeyWrap.contains(e.target))showJourneyDetail(false);},true);
matchMedia('(orientation: landscape)').addEventListener('change',()=>{if(start.open){start.scrollTop=0;showJourneyDetail(false);}});
function renderControls(){
 cancelBindingCapture();$('panel-title').textContent='Controls';$('panel-kicker').textContent='AXIOMORT';
 const rows=[['forward','Move forward'],['back','Move back'],['left','Move left'],['right','Move right'],['use','Interact'],['jump','Jump'],['sprint','Sprint'],['inventory','Inventory'],['craft','Craft & build'],['missions','Missions'],['rotate','Rotate building'],['dismantle','Dismantle'],['tool1','Slot 1'],['tool2','Slot 2'],['tool3','Slot 3']];
 const padGuide='<section class="controller-guide"><h3>CONTROLLER</h3><div class="controller-guide-grid">'+[['move','Move'],['look','Look'],['sprint','Sprint'],['jump','Jump / confirm'],['back','Back'],['interact','Interact'],['inventory','Inventory'],['gather','Gather / place'],['useItem','Use berries'],['previous','Previous tool'],['next','Next tool'],['missions','Missions'],['craft','Craft / rotate'],['dismantle','Dismantle'],['pause','Pause']].map(([action,label])=>'<div>'+hintMarkup(action,{device:'gamepad',family:input.family})+'<span>'+label+'</span></div>').join('')+'</div></section>';
 $('panel-body').innerHTML=padGuide+'<h3 class="binding-heading">KEYBOARD</h3><dl class="control-rows binding-rows">'+rows.map(([action,label])=>'<div><dt>'+label+'</dt><dd><button type="button" data-bind="'+action+'" aria-label="Change '+label+' key">'+keyLabel(bind(action))+'</button></dd></div>').join('')+'</dl><p class="binding-note">Left click to gather · right click to eat selected berries · wheel to cycle slots · Esc to pause</p><button id="back-settings">Back to settings</button>';
 $('panel-body').querySelectorAll('[data-bind]').forEach(button=>button.onclick=()=>{
   if(input.device==='gamepad'){showToast('Use a keyboard to change keyboard bindings.');return;}cancelBindingCapture();button.textContent='Press key';
   bindingCapture=e=>{
     e.preventDefault();e.stopPropagation();
     if(e.code==='Escape'){renderControls();return;}
     if(e.ctrlKey||e.altKey||e.metaKey||!bindable(e.code)){showToast('Choose a letter, number, Shift, Space or punctuation key.');renderControls();return;}
     const action=button.dataset.bind,previous=bind(action),other=Object.keys(state.settings.bindings).find(key=>key!==action&&bind(key)===e.code);
     state.settings.bindings[action]=e.code;if(other)state.settings.bindings[other]=previous;
     keys.clear();sprintToggled=false;hotbarSignature='';saveSettings();updateShortcutLabels();renderHotbar();renderControls();
   };
   document.addEventListener('keydown',bindingCapture,true);
 });
 $('back-settings').onclick=()=>openPanel('settings');
}

$('title-settings').onclick=$('title-gear').onclick=()=>openPanel('settings');
$('title-sound').onclick=()=>{const wasMuted=!state.settings.sound;if(!wasMuted)tone('select');state.settings.sound=wasMuted ? .35 : 0;sound.setVolume(state.settings.sound);syncMenuMusic();saveSettings();updateTitle();if(wasMuted)tone('select');};
start.addEventListener('keydown',e=>{
 if(panel.open||!['ArrowUp','ArrowDown'].includes(e.code))return;
 e.preventDefault();
 const buttons=[...start.querySelectorAll('.menu-choice:not(:disabled)')],i=buttons.indexOf(document.activeElement);
 buttons[(i+(e.code==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();
});

boot().catch(error=>{console.error(error);start.close();$('fatal-message').textContent='A graphics feature or game resource could not load. Try a current browser with hardware acceleration enabled.';$('fatal').hidden=false;});


