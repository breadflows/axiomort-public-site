import * as THREE from 'three/webgpu';
import {shoreRadius} from './layout.js';

// The playable top and the sea face share one surveyed shoreline. Its height is
// supplied by terrain(), so render geometry, resource placement and collision agree.
export function addHavenCliff(parent,island,terrain,groundMaterial,stoneTexture){
  const root=new THREE.Group();root.position.set(island.x,0,island.z);parent.add(root);
  const segments=320,rings=[.12,.24,.38,.52,.65,.76,.85,.92,.965,.987,.998];
  const topPositions=[0,terrain(island.x,island.z),0],topIndices=[];
  for(const fraction of rings)for(let j=0;j<segments;j++){
    const a=j*Math.PI*2/segments,r=shoreRadius(island,a)*fraction;
    const x=Math.cos(a)*r,z=Math.sin(a)*r;
    topPositions.push(x,terrain(island.x+x,island.z+z),z);
  }
  for(let j=0;j<segments;j++)topIndices.push(0,1+(j+1)%segments,1+j);
  for(let ring=1;ring<rings.length;ring++){
    const inner=1+(ring-1)*segments,outer=1+ring*segments;
    for(let j=0;j<segments;j++){
      const next=(j+1)%segments;
      topIndices.push(inner+j,outer+next,outer+j,inner+j,inner+next,outer+next);
    }
  }
  const top=new THREE.BufferGeometry();
  top.setAttribute('position',new THREE.Float32BufferAttribute(topPositions,3));
  top.setIndex(topIndices);top.computeVertexNormals();
  const land=new THREE.Mesh(top,groundMaterial);land.receiveShadow=true;root.add(land);

  const rows=39,width=segments+1,positions=[],colors=[],uvs=[],indices=[];
  for(let row=0;row<rows;row++)for(let j=0;j<=segments;j++){
    const f=row/(rows-1),a=(j%segments)*Math.PI*2/segments;
    const lip=shoreRadius(island,a)*rings.at(-1);
    const lipX=Math.cos(a)*lip,lipZ=Math.sin(a)*lip;
    const topY=terrain(island.x+lipX,island.z+lipZ);
    const buttress=Math.sin(a*17+.4)*.024+Math.cos(a*29-1.2)*.012;
    const fracture=Math.sin(a*47+f*12)*.013+Math.cos(a*83-f*29)*.005;
    const ledge=Math.sin(f*28+a*3)*.006+Math.cos(f*51-a*7)*.004;
    const radius=lip*(1+f*.016+(buttress+fracture+ledge)*Math.sin(Math.PI*f));
    const y=topY+(-5-topY)*f+Math.sin(Math.PI*f)*(Math.sin(a*19+f*23)*.6+Math.cos(a*61-f*33)*.18);
    positions.push(Math.cos(a)*radius,y,Math.sin(a)*radius);
    const strata=Math.sin((topY-y)*1.8+a*2.3)*.065;
    const variation=Math.sin(a*17+f*19)*.09+Math.cos(a*47-f*29)*.045;
    const shade=THREE.MathUtils.clamp(.69+strata+variation+f*.04,.43,.90);
    colors.push(shade*.87,shade*.95,shade);
    uvs.push(j/segments*10,(topY-y)/3.3);
  }
  for(let row=0;row<rows-1;row++)for(let j=0;j<segments;j++){
    const a=row*width+j,b=a+1,c=a+width,d=c+1;
    indices.push(a,b,c,b,d,c);
  }
  const face=new THREE.BufferGeometry();
  face.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  face.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  face.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  face.setIndex(indices);face.computeVertexNormals();
  const rock=new THREE.MeshStandardMaterial({color:0x505c61,vertexColors:true,roughness:.98,bumpMap:stoneTexture,bumpScale:.14,side:THREE.DoubleSide});
  const wall=new THREE.Mesh(face,rock);wall.castShadow=true;wall.receiveShadow=true;root.add(wall);
  return {root,land,wall};
}
