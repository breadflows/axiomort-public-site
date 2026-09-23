import {equippedTool} from './hotbar.js?v=20260922-inventory';
import {available,harvest} from './state.js';

// Partial hits are session-only; completed harvests use the existing save system.
export function createGathering() {
  const damage=new Map();
  let lastHit=-Infinity;
  const total=node=>['wood','stone','scrap','crystal'].includes(node.type)?3:1;
  return {
    remaining(node){return Math.max(0,total(node)-(damage.get(node.id)||0));},
    hit(state,node){
      if(!available(state,node)||state.time-lastHit<.45)return null;
      lastHit=state.time;
      const amount=equippedTool(state)==='axe'?2:1;
      const next=(damage.get(node.id)||0)+amount;
      if(next<total(node)){damage.set(node.id,next);return {remaining:total(node)-next,result:null};}
      const result=harvest(state,node);
      if(!result)return null;
      damage.delete(node.id);
      return {remaining:0,result};
    }
  };
}
export function isSprinting(keys,food,moving){
  return !!moving&&food>10&&(keys.has('ShiftLeft')||keys.has('ShiftRight'));
}
