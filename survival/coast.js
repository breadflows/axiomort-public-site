import * as THREE from 'three/webgpu';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {terrain,ISLANDS,NODES} from './state.js';
import {WRECKS} from './expedition.js?v=20260923-sky-route';
import {ECHO_ISLAND} from './layout.js';

// An original, reusable coastal dressing kit. Static parts are batched by material.
// Wreck silhouettes borrow the film's ribbed machinery vocabulary, not a named vehicle.
const mat=(color,roughness=.85,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
export function createCoast(scene){
  const palette={slate:mat(0x4b5756),edge:mat(0x77827b),sand:mat(0xa99b7b),rust:mat(0x73563e,.86,.35),steel:mat(0x34494c,.56,.7),cloth:mat(0xbaa378),leaf:mat(0x566d48),amber:mat(0xdba854,.5,.1)};
  const root=new THREE.Group(),colliders=[],markers=[];let seed=43811;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const add=(g,geo,m,x=0,y=0,z=0)=>{const o=new THREE.Mesh(geo,palette[m]);o.position.set(x,y,z);g.add(o);return o;};
  const box=(g,x,y,z,w,h,d,m)=>add(g,new THREE.BoxGeometry(w,h,d),m,x,y,z);
  const beam=(g,a,b,r,m)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),o=add(g,new THREE.CylinderGeometry(r,r,start.distanceTo(end),7),m);o.position.copy(start.clone().add(end).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());return o;};
  // Long, chipped sediment layers replace isolated rounded shoreline boulders.
  for(const island of ISLANDS)for(let n=0;n<42;n++){
    const a=n/42*Math.PI*2,r=island.radius*(.87+rand()*.06),x=island.x+Math.cos(a)*r,z=island.z+Math.sin(a)*r;
    const g=new THREE.Group();g.position.set(x,terrain(x,z)-.35,z);g.rotation.y=-a;root.add(g);
    for(let layer=0;layer<3;layer++){
      const geo=new THREE.CylinderGeometry(1,1.15,.55,7,1),p=geo.attributes.position;
      for(let i=0;i<p.count;i++){const px=p.getX(i),py=p.getY(i),pz=p.getZ(i);const k=1+Math.sin(px*9+pz*6+layer)*.16;p.setXYZ(i,px*k,py+Math.sin(px*5+pz*4)*.12,pz*k);}geo.computeVertexNormals();
      const rock=add(g,geo,layer===2?'edge':'slate',layer*.1,layer*.36,0);rock.scale.set(2.2+rand()*1.2,1,1.3+rand());rock.rotation.y=layer*.1;
    }
  }
  // Low ground cover leaves resources and the central building meadow readable.
  for(let i=0;i<420;i++){
    const island=ISLANDS[i%4===0?1:0],a=rand()*6.283,r=island.radius*(.3+rand()*.53),x=island.x+Math.cos(a)*r,z=island.z+Math.sin(a)*r;
    if(terrain(x,z)<.5||NODES.some(n=>Math.hypot(x-n.x,z-n.z)<1.4)||Math.abs(x)<9&&z>8||WRECKS.some(w=>Math.hypot(x-w.x,z-w.z)<4))continue;
    if(i%3===0){const o=add(root,new THREE.IcosahedronGeometry(.18+rand()*.2,0),'sand',x,terrain(x,z)+.05,z);o.scale.set(1.8,.5,1);continue;}
    const g=new THREE.Group();g.position.set(x,terrain(x,z),z);g.rotation.y=rand()*6.28;root.add(g);
    for(let n=0;n<5;n++){const a=n*2.4,len=.4+rand()*.5;const shape=new THREE.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(.13,len*.5,0,len);shape.quadraticCurveTo(-.1,len*.4,0,0);const leaf=add(g,new THREE.ShapeGeometry(shape,3),'leaf');leaf.rotation.set(.7,a,.3);palette.leaf.side=THREE.DoubleSide;}
  }
  // Open-ended wrecks: rewards sit outside the ribs, no corridor or locked door.
  for(const w of WRECKS){
    const g=new THREE.Group();g.position.set(w.x,terrain(w.x,w.z),w.z);root.add(g);
    const east=w.id==='harness',cx=east?2.8:-2.8;
    for(let n=0;n<5;n++){
      const curve=new THREE.EllipseCurve(0,0,2.3,2.05,0,Math.PI*1.68,false,.25);
      const pts=curve.getPoints(30).map(p=>new THREE.Vector3(p.x,p.y,0));
      const rib=add(g,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),30,.11,6,false),'rust',cx,.8,-2.5+n*.85);rib.rotation.z=east?-.25:.3;
    }
    // Torn sections of curved skin make the ribs read as a damaged hull.
    for(let strip=0;strip<5;strip++){
      const positions=[],start=.32+strip*.64,end=start+.48,z0=-2.48+(strip%2)*.3,z1=.7-(strip%3)*.24;
      const point=(a,z)=>[cx+Math.cos(a)*2.22,.8+Math.sin(a)*1.94,z];
      for(let segment=0;segment<6;segment++){const a=start+(end-start)*segment/6,b=start+(end-start)*(segment+1)/6;positions.push(...point(a,z0),...point(b,z0),...point(a,z1),...point(b,z0),...point(b,z1),...point(a,z1));}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();const skin=add(g,geo,strip%2?'steel':'slate');skin.rotation.z=east?-.08:.08;palette.steel.side=palette.slate.side=THREE.DoubleSide;
    }
    for(let n=0;n<6;n++){box(g,cx,.24,-2.1+n*.48,2.7,.09,.18,'rust');box(g,cx-1.2,.31,-2.1+n*.48,.14,.14,.14,'edge');}
    for(const side of [-1,1]){beam(g,[cx+side*1.7,.3,-2.7],[cx+side*1.7,.3,1.1],.15,'steel');}
    for(let n=0;n<8;n++){const panel=box(g,cx+Math.sin(n)*1.6,.2,-2+n*.38,.6,.12,1.2,n%2?'slate':'steel');panel.rotation.set(n*.07,n*.8,.1);}
    // A mast and distinct colour cue are visible from the arrival clearing.
    beam(g,[0,0,-1],[0,5.6,-1],.065,'steel');beam(g,[-.8,4.7,-1],[.8,4.7,-1],.045,'rust');
    const flag=box(g,.35,4.4,-1,.7,.65,.018,east?'edge':'amber');flag.rotation.y=east?.5:-.5;
    box(g,0,.4,0,1,.8,.65,'steel');box(g,0,.85,0,1.08,.1,.72,'rust');
    const color=east?0x94d8c5:0xffc277,m=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.3,roughness:.6});
    const marker=new THREE.Mesh(new THREE.TorusGeometry(.22,.055,6,20),m);marker.rotation.x=Math.PI/2;marker.position.set(w.x,terrain(w.x,w.z)+1.1,w.z);scene.add(marker);markers.push({id:w.id,mesh:marker});
    colliders.push({x:w.x,z:w.z,r:.65,height:.95});
    // Hull collision stays on the flank; the reward is reachable from the front.
    colliders.push({x:w.x+cx,z:w.z-1,r:1.8,height:3});
    for(let n=1;n<7;n++){const x=w.x+(ECHO_ISLAND.x-w.x)*n/7,z=w.z+Math.sin(n*.8)*.55;const stone=add(root,new THREE.IcosahedronGeometry(.22,0),'edge',x,terrain(x,z)+.04,z);stone.scale.set(1,.3,1.5);}
  }
  root.updateMatrixWorld(true);
  for(const material of Object.values(palette)){
    const pieces=[];root.traverse(o=>{if(o.isMesh&&o.material===material){const geometry=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geometry.applyMatrix4(o.matrixWorld);geometry.deleteAttribute('uv');pieces.push(geometry);}});
    if(pieces.length){const mesh=new THREE.Mesh(mergeGeometries(pieces),material);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);pieces.forEach(p=>p.dispose());}
  }
  root.traverse(o=>o.geometry?.dispose());
  return {colliders,update(t,state){for(const m of markers){m.mesh.visible=!state.expedition.recovered.includes(m.id);m.mesh.rotation.z=t*.5;}}};
}
