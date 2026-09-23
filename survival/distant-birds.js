import * as THREE from 'three/webgpu';

// A distant sea-bird colony gives the cliff a scale cue without entering the
// player's route or becoming another interactable object.
export function createDistantBirds(scene){
  const birds=[];
  const bodyMaterial=new THREE.MeshStandardMaterial({color:0x29383a,roughness:1,side:THREE.DoubleSide});
  const wingShape=new THREE.BufferGeometry();
  wingShape.setAttribute('position',new THREE.Float32BufferAttribute([
    0,0,-.10, .54,.025,-.23, 1.05,.015,-.04,
    0,0,-.10, 1.05,.015,-.04, .39,0,.12
  ],3));
  wingShape.computeVertexNormals();
  for(let i=0;i<11;i++){
    const bird=new THREE.Group(),wings=[];
    const body=new THREE.Mesh(new THREE.SphereGeometry(.13,7,5),bodyMaterial);
    body.scale.set(.95,.47,1.8);bird.add(body);
    for(const side of [-1,1]){
      const hinge=new THREE.Group();
      const wing=new THREE.Mesh(wingShape,bodyMaterial);
      wing.scale.x=side;hinge.add(wing);bird.add(hinge);wings.push({hinge,side});
    }
    bird.scale.setScalar(.7+(i%4)*.12);
    scene.add(bird);
    birds.push({bird,wings,phase:i*1.81,orbit:i%3===0?1:-1,radius:12+(i%5)*4,centerX:i%2===0?83:-72,centerZ:i%2===0?-35:-70,height:52+(i%5)*3});
  }
  return {update(t){for(const b of birds){
    const angle=t*.13*b.orbit+b.phase;
    b.bird.position.set(b.centerX+Math.cos(angle)*b.radius,b.height+Math.sin(t*.54+b.phase)*1.8,b.centerZ+Math.sin(angle)*b.radius*.7);
    b.bird.rotation.y=-angle+b.orbit*Math.PI*.5;
    for(const {hinge,side} of b.wings)hinge.rotation.z=side*(.08+Math.sin(t*3.4+b.phase)*.19);
  }}};
}
