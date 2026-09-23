import {terrain,RECIPES} from './state.js';

export const level=b=>b.y??terrain(b.x,b.z);
export const edge=rotation=>((Math.round(rotation/(Math.PI/2))%4)+4)%4;
export function localPoint(b,x,z){const dx=x-b.x,dz=z-b.z,c=Math.cos(b.rotation),s=Math.sin(b.rotation);return {x:dx*c-dz*s,z:dx*s+dz*c};}
export function floorHeight(state,x,z,feet=Infinity){
  let height=terrain(x,z);
  for(const b of state.buildings){if(b.kind!=='foundation')continue;const p=localPoint(b,x,z),top=level(b)+.2;
    if(Math.abs(p.x)<=2&&Math.abs(p.z)<=2&&top<=feet+.55)height=Math.max(height,top);
  }return height;
}
export function underRoof(state,x,z){return state.buildings.some(b=>{if(b.kind!=='roof')return false;const p=localPoint(b,x,z);return Math.abs(p.x)<1.95&&Math.abs(p.z)<1.95;});}
export function ceilingHeight(state,x,z,feet){
  let ceiling=Infinity;
  for(const b of state.buildings){const p=localPoint(b,x,z);let height=Infinity;
    if(b.kind==='roof'&&Math.abs(p.x)<2.1&&Math.abs(p.z)<2.1)height=level(b)+2.7;
    if(b.kind==='doorway'&&Math.abs(p.x)<.95&&Math.abs(p.z+2)<.4)height=level(b)+2.25;
    if(height>=feet+1.69)ceiling=Math.min(ceiling,height);
  }return ceiling;
}
export function constructionPose(state,kind,x,z,rotation){
  const bases=state.buildings.filter(b=>b.kind==='foundation');
  if(RECIPES[kind].attachment){const b=bases.filter(b=>Math.hypot(x-b.x,z-b.z)<4).sort((a,b)=>Math.hypot(x-a.x,z-a.z)-Math.hypot(x-b.x,z-b.z))[0];
    return b?{x:b.x,z:b.z,y:level(b)+.2,rotation:edge(rotation)*Math.PI/2,supportId:b.id}:{x,z,y:terrain(x,z),rotation,supportId:null};
  }
  if(kind==='foundation'){
    const candidates=bases.flatMap(b=>[[4,0],[-4,0],[0,4],[0,-4]].map(([dx,dz])=>({x:b.x+dx,z:b.z+dz,y:level(b),rotation:0})));
    const snap=candidates.filter(p=>Math.hypot(x-p.x,z-p.z)<2.4).sort((a,b)=>Math.hypot(x-a.x,z-a.z)-Math.hypot(x-b.x,z-b.z))[0];
    if(snap)return snap;
    x=Math.round(x*2)/2;z=Math.round(z*2)/2;
    return {x,z,y:Math.max(...[-2,2].flatMap(dx=>[-2,2].map(dz=>terrain(x+dx,z+dz)))),rotation:0};
  }
  return {x:Math.round(x*2)/2,z:Math.round(z*2)/2,y:terrain(Math.round(x*2)/2,Math.round(z*2)/2),rotation};
}
export function moduleError(state,kind,pose,player){
  if(!RECIPES[kind].modular)return null;
  const {x,z,y,rotation,supportId}=pose;
  if(RECIPES[kind].attachment){
    if(!supportId)return 'Aim at a timber foundation first';
    if(state.buildings.some(b=>b.supportId===supportId&&(kind==='roof'?b.kind==='roof':['wall','doorway'].includes(b.kind)&&edge(b.rotation)===edge(rotation))))return 'That foundation slot is already occupied';
    if(kind==='wall'||kind==='doorway'){const p=localPoint(pose,player.x,player.z);if(Math.abs(p.z+2)<.6&&Math.abs(p.x)<2.4)return 'Step away from this wall edge';}
    // Adjacent foundations can share an edge; only one panel may occupy that edge.
    if(kind==='wall'||kind==='doorway')for(const b of state.buildings.filter(b=>['wall','doorway'].includes(b.kind))){
      const ax=x-Math.sin(rotation)*2,az=z-Math.cos(rotation)*2,bx=b.x-Math.sin(b.rotation)*2,bz=b.z-Math.cos(b.rotation)*2;
      if(Math.hypot(ax-bx,az-bz)<.1&&Math.abs(y-level(b))<.1)return 'This shared edge already has a wall or doorway';
    }
  }else{
    for(const dx of [-2,0,2])for(const dz of [-2,0,2]){const h=terrain(x+dx,z+dz);if(h<.65)return 'Keep the whole foundation on dry land';if(y-h<-.05||y-h>.7)return 'Find flatter ground for the foundation';}
    if(state.buildings.some(b=>b.kind==='foundation'&&Math.abs(x-b.x)<3.99&&Math.abs(z-b.z)<3.99))return 'This floor space is already occupied';
  }
  return null;
}
export function moduleCollides(b,x,y,z){
  if(!RECIPES[b.kind]?.modular)return false;
  const p=localPoint(b,x,z),feet=y-level(b),head=feet+1.7;
  if(b.kind==='foundation')return Math.abs(p.x)<2.28&&Math.abs(p.z)<2.28&&feet<.19&&head>-.55;
  if(b.kind==='wall'||b.kind==='doorway'){
    if(Math.abs(p.z+2)>.4||Math.abs(p.x)>2.28||feet>=2.7||head<=0)return false;
    return b.kind==='wall'||Math.abs(p.x)>.67||head>2.25;
  }
  if(b.kind==='roof'){
    for(const px of [-1.85,1.85])for(const pz of [-1.85,1.85])if(Math.hypot(p.x-px,p.z-pz)<.36&&feet<2.7&&head>0)return true;
    return Math.abs(p.x)<2.1&&Math.abs(p.z)<2.1&&head>2.7&&feet<3.25;
  }
  return false;
}
