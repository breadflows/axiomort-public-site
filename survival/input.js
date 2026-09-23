const DEADZONE=.18;
export const PAD_BUTTON=Object.freeze({confirm:0,back:1,interact:2,inventory:3,previous:4,next:5,useItem:6,gather:7,pause:9,sprint:10,missions:12,down:13,left:14,craft:15});
export function gamepadFamily(id=''){
  if(/playstation|dualshock|dualsense|sony|054c/i.test(id))return 'playstation';
  if(/xbox|xinput|microsoft|045e/i.test(id))return 'xbox';
  return 'generic';
}
export function deadzone(value){
  const n=Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0;
  return Math.abs(n)<=DEADZONE?0:Math.sign(n)*(Math.abs(n)-DEADZONE)/(1-DEADZONE);
}
export function touchStickVector(dx,dy,radius,deadRadius=.12){
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||!Number.isFinite(radius)||radius<=0)return {x:0,y:0};
  deadRadius=Math.max(0,Math.min(.95,deadRadius));
  const length=Math.hypot(dx,dy),distance=Math.min(1,length/radius);
  if(distance<=deadRadius)return {x:0,y:0};
  const strength=(distance-deadRadius)/(1-deadRadius);
  return {x:dx/length*strength,y:dy/length*strength};
}
export function createInputRouter({getGamepads=()=>navigator.getGamepads?.()||[],coarse=false,onChange=()=>{}}={}){
  let device=coarse?'touch':'keyboard',family='generic',padIndex=null,previousButtons=[],previousAxes=[];
  function activate(next,nextFamily=family){
    if(device===next&&family===nextFamily)return;
    device=next;family=nextFamily;onChange({device,family});
  }
  function keyboard(){activate('keyboard','generic');}
  function pointer(type){activate(type==='touch'?'touch':'keyboard','generic');}
  function poll(){
    let pads=[];try{pads=Array.from(getGamepads()||[]);}catch{return null;}
    const pad=pads.find(p=>p?.connected&&p.mapping==='standard');
    if(!pad){padIndex=null;previousButtons=[];previousAxes=[];if(device==='gamepad')activate(coarse?'touch':'keyboard','generic');return null;}
    if(padIndex!==pad.index){padIndex=pad.index;previousButtons=[];previousAxes=[];}
    const buttons=Array.from(pad.buttons||[],b=>!!b&&(b.pressed||b.value>.5));
    const axes=Array.from({length:4},(_,i)=>Number.isFinite(pad.axes?.[i])?pad.axes[i]:0);
    const pressed=new Set(buttons.flatMap((v,i)=>v&&!previousButtons[i]?[i]:[]));
    const moved=axes.some((v,i)=>Math.abs(v)>.35&&Math.abs(v-(previousAxes[i]??0))>.08);
    previousButtons=buttons;previousAxes=axes;
    if(pressed.size||moved)activate('gamepad',gamepadFamily(pad.id));
    if(device!=='gamepad')return null;
    return {family,pressed,held:new Set(buttons.flatMap((v,i)=>v?[i]:[])),moveX:deadzone(axes[0]),moveY:deadzone(axes[1]),lookX:deadzone(axes[2]),lookY:deadzone(axes[3])};
  }
  return {get device(){return device},get family(){return family},keyboard,pointer,poll};
}
const FACE={confirm:'south',jump:'south',back:'east',interact:'west',inventory:'north'};
const FIXED={gather:'rt',useItem:'lt',pause:'menu',previous:'lb',next:'rb',missions:'dpad-up',craft:'dpad-right',rotate:'dpad-right',dismantle:'dpad-down',slot1:'lb',slot3:'rb',move:'leftstick',look:'rightstick',sprint:'l3'};
const LABEL={south:{xbox:'A',playstation:'Cross',generic:'South'},east:{xbox:'B',playstation:'Circle',generic:'East'},west:{xbox:'X',playstation:'Square',generic:'West'},north:{xbox:'Y',playstation:'Triangle',generic:'North'},rt:'Right trigger',lt:'Left trigger',lb:'Left bumper',rb:'Right bumper',menu:'Menu', 'dpad-up':'D-pad up','dpad-right':'D-pad right','dpad-down':'D-pad down',leftstick:'Left stick',rightstick:'Right stick',l3:'Press left stick'};
const TOUCH_ICON={
  inventory:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16v12H4zM7 8V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3M4 13h16M10 13v3h4v-3"/></svg>',
  missions:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1zm0 0v15M5 8h5m4 0h5M5 11h5m4 0h5"/></svg>',
  gather:'<svg viewBox="0 0 48 48" aria-hidden="true"><use href="survival/ui/touch-actions.svg#gather"></use></svg>',
  place:'<svg viewBox="0 0 48 48" aria-hidden="true"><use href="survival/ui/touch-actions.svg#place"></use></svg>',
  interact:'<svg viewBox="0 0 48 48" aria-hidden="true"><use href="survival/ui/touch-actions.svg#interact"></use></svg>',
  jump:'<svg viewBox="0 0 48 48" aria-hidden="true"><use href="survival/ui/touch-actions.svg#jump"></use></svg>',
  sprint:'<svg viewBox="0 0 48 48" aria-hidden="true"><use href="survival/ui/touch-actions.svg#sprint"></use></svg>'
};
const escapeText=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function hintMarkup(action,{device='keyboard',family='generic',key='',touchLabel=''}={}){
  if(device==='touch'){
    if(TOUCH_ICON[action])return '<span class="touch-symbol">'+TOUCH_ICON[action]+'</span>';
    return '<span class="touch-hint">'+escapeText(touchLabel||({gather:'Hold Gather',interact:'Interact',useItem:'Tap berries',back:'Back'}[action]||''))+'</span>';
  }
  if(device==='gamepad'){
    const part=FACE[action]||FIXED[action];
    if(!part)return '';
    const id=FACE[action]?family+'-'+part:'pad-'+part;
    const label=LABEL[part]?.[family]||LABEL[part]||part;
    return '<span class="pad-hint" title="'+escapeText(label)+'"><svg class="pad-glyph" viewBox="0 0 64 64" role="img" aria-label="'+escapeText(label)+'"><use href="survival/ui/controller-glyphs.svg?v=20260923-input-2#'+id+'"></use></svg></span>';
  }
  const shown=key||({gather:'LMB',useItem:'RMB',back:'Esc',pause:'Esc'}[action]||'');
  return shown?'<kbd class="control-key">'+escapeText(shown)+'</kbd>':'';
}
