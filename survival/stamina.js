export const STAMINA_MAX=100;
export const JUMP_COST=16;
const SPRINT_DRAIN=11;
const RECOVERY_RATE=26;
const EXHAUSTED_RECOVERY=28;
export function createStamina(){return {value:STAMINA_MAX,exhausted:false,recoveryDelay:0};}
export function resetStamina(stamina){stamina.value=STAMINA_MAX;stamina.exhausted=false;stamina.recoveryDelay=0;}
export function canSprint(stamina){return !stamina.exhausted&&stamina.value>0;}
export function spendJump(stamina){
  if(stamina.value<JUMP_COST)return false;
  stamina.value=Math.max(0,stamina.value-JUMP_COST);
  stamina.recoveryDelay=.55;
  if(stamina.value===0)stamina.exhausted=true;
  return true;
}
export function advanceStamina(stamina,dt,{moving=false,sprintRequested=false}={}){
  const seconds=Math.max(0,Math.min(Number.isFinite(dt)?dt:0,.1));
  const sprinting=!!moving&&!!sprintRequested&&canSprint(stamina);
  if(sprinting){
    stamina.value=Math.max(0,stamina.value-SPRINT_DRAIN*seconds);
    stamina.recoveryDelay=.35;
    if(stamina.value===0)stamina.exhausted=true;
  }else{
    stamina.recoveryDelay=Math.max(0,stamina.recoveryDelay-seconds);
    if(stamina.recoveryDelay===0){
      stamina.value=Math.min(STAMINA_MAX,stamina.value+(stamina.exhausted?EXHAUSTED_RECOVERY:RECOVERY_RATE)*seconds);
      if(stamina.exhausted&&stamina.value>=28)stamina.exhausted=false;
    }
  }
  return sprinting;
}
