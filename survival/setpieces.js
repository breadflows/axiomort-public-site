import * as THREE from 'three/webgpu';
import {ECHO_CRYSTAL} from './chapter.js?v=20260923-inside-axio';
import {terrain} from './state.js';
import {ECHO_ISLAND} from './layout.js';

export function createSetpieces(scene){
 const stone=new THREE.MeshStandardMaterial({color:0x343b3e,roughness:.88}),metal=new THREE.MeshStandardMaterial({color:0x554735,metalness:.65,roughness:.5}),distortionStone=new THREE.MeshStandardMaterial({color:0x17272b,metalness:.18,roughness:.72}),crystalMaterial=new THREE.MeshPhysicalMaterial({color:0x69d8c4,metalness:.05,roughness:.17,clearcoat:.45,clearcoatRoughness:.12,emissive:0x2d8a79,emissiveIntensity:.8});
 const drifting=[],colliders=[];
 const cube=(group,x,y,z,w,h,d,mat)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
 const ruin=new THREE.Group();ruin.position.set(ECHO_CRYSTAL.x,terrain(ECHO_CRYSTAL.x,ECHO_CRYSTAL.z),ECHO_CRYSTAL.z);scene.add(ruin);
 cube(ruin,0,.25,0,5,.5,4,stone);cube(ruin,0,.83,0,1.2,1.2,1,stone);
 for(const side of [-1,1]){cube(ruin,side*3,2.6,-1,1,5.2,1.2,stone);const beam=cube(ruin,side*1.55,5.3,-1,3.4,.7,1.2,stone);beam.rotation.z=-side*.38;}
 // Nested lancet ribs echo the film's lunar-gothic silhouettes.
 for(const side of [-1,1])for(let layer=0;layer<3;layer++){
  const width=3.2+layer*.34,curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(side*width,1,-1-layer*.25),new THREE.Vector3(side*width,5.4,-1-layer*.25),new THREE.Vector3(side*.12,7.1+layer*.28,-1-layer*.25));
  const rib=new THREE.Mesh(new THREE.TubeGeometry(curve,22,.15,6,false),stone);rib.castShadow=true;rib.receiveShadow=true;ruin.add(rib);
 }
 for(const side of [-1,1])for(const y of [.35,1,4.6])cube(ruin,side*3,y,-1,1.35,.22,1.6,metal);
 // Broken masonry floats within the crystal's field, leaving the walking route open.
 for(let n=0;n<12;n++){const a=n/12*Math.PI*2,r=2.7+(n%3)*.4;const m=cube(ruin,Math.cos(a)*r,1.5+(n%4)*.5,Math.sin(a)*r,.35+(n%3)*.12,.25,.35,distortionStone);m.rotation.set(n*.6,n*.3,n);drifting.push({mesh:m,y:m.position.y,phase:n});}
 const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.42,0),crystalMaterial);crystal.scale.set(.8,1.45,.8);crystal.position.set(0,1.7,0);crystal.castShadow=true;ruin.add(crystal);
 const glow=new THREE.PointLight(0x7af0d8,4,9);glow.position.set(0,2,0);ruin.add(glow);
 // A readable spine of stones leads away from the arrival rift.
 for(let offset=-8;offset>-14;offset-=1.5){const z=ECHO_ISLAND.z+offset,step=new THREE.Mesh(new THREE.BoxGeometry(1.4,.16,.8),stone);step.position.set(ECHO_ISLAND.x,terrain(ECHO_ISLAND.x,z)+.06,z);scene.add(step);}
 return {ready:Promise.resolve(),colliders,update(time,state){for(const d of drifting){d.mesh.position.y=d.y+(state.chapter.recovered?0:Math.sin(time*.85+d.phase)*.32);if(!state.chapter.recovered)d.mesh.rotation.y+=.002;}crystal.visible=!state.chapter.recovered;crystal.position.y=1.7+Math.sin(time*1.2)*.09;crystal.rotation.y=time*.18;glow.intensity=state.chapter.recovered?.6:3+Math.sin(time*2)*.5;},ruin};
}
