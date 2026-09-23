import * as THREE from 'three/webgpu';
import {
  cameraPosition, cos, float, mix, mx_noise_float, positionLocal, positionWorld,
  reflector, sin, smoothstep, time, transformNormal, transformNormalToView, uniform, vec2, vec3
} from 'three/tsl';

// Ocean-only presentation. Game traversal still treats the sea as a boundary.
export function createOceanCandidate(scene, {quality='balanced'}={}) {
  const origin=uniform(new THREE.Vector2());
  const swell=uniform(1);
  const deepColor=uniform(new THREE.Color(0x071b25));
  const reflectedColor=uniform(new THREE.Color(0x293d44));
  const horizonColor=uniform(new THREE.Color(0xa9c5cf));
  const waterMaterial=new THREE.NodeMaterial();waterMaterial.side=THREE.DoubleSide;

  const x=positionLocal.x.add(origin.x),z=positionLocal.y.add(origin.y);
  // Gerstner waves move vertices toward the crests, giving broad troughs and
  // sharp, travelling peaks. Steepness stays below the self-intersection limit.
  const waves=[
    {length:21,amplitude:.63,dir:[.94,.34],steepness:.30,phase:0},
    {length:13,amplitude:.36,dir:[.74,-.67],steepness:.24,phase:1.8},
    {length:32,amplitude:.47,dir:[-.18,.98],steepness:.22,phase:3.1},
    {length:8.5,amplitude:.18,dir:[.52,.85],steepness:.16,phase:4.5},
    {length:11,amplitude:.20,dir:[-.86,-.51],steepness:.15,phase:2.4}
  ];
  let height=float(0),shiftX=float(0),shiftZ=float(0),slopeX=float(0),slopeZ=float(0),normalUp=float(1);
  for(const w of waves){
    const k=2*Math.PI/w.length,omega=Math.sqrt(9.81*k);
    const wavePhase=x.mul(w.dir[0]*k).add(z.mul(w.dir[1]*k)).sub(time.mul(omega)).add(w.phase);
    const s=sin(wavePhase),c=cos(wavePhase),amp=float(w.amplitude).mul(swell);
    height=height.add(s.mul(amp));
    shiftX=shiftX.add(c.mul(amp).mul(w.steepness*w.dir[0]));
    shiftZ=shiftZ.add(c.mul(amp).mul(w.steepness*w.dir[1]));
    slopeX=slopeX.add(c.mul(amp).mul(k*w.dir[0]));
    slopeZ=slopeZ.add(c.mul(amp).mul(k*w.dir[1]));
    normalUp=normalUp.sub(s.mul(amp).mul(k*w.steepness));
  }
  // Sub-vertex ripples affect reflection and glints, not the mesh silhouette.
  const rippleA=x.mul(2.7).add(z.mul(1.1)).sub(time.mul(3.4));
  const rippleB=x.mul(-1.5).add(z.mul(2.5)).add(time.mul(2.8));
  const rippleX=cos(rippleA).mul(.04).sub(cos(rippleB).mul(.022));
  const rippleZ=cos(rippleA).mul(.016).add(cos(rippleB).mul(.037));
  const nearWeight=float(1).sub(smoothstep(250,850,positionLocal.xy.length()));
  const normal=vec3(slopeX.add(rippleX).negate(),slopeZ.add(rippleZ).negate(),normalUp).normalize();
  const worldNormal=transformNormal(normal);
  const view=cameraPosition.sub(positionWorld).normalize();
  const fresnel=float(.02).add(float(.98).mul(float(1).sub(worldNormal.dot(view).clamp(0,1)).pow(5)));
  waterMaterial.positionNode=positionLocal.add(vec3(shiftX.mul(nearWeight),shiftZ.mul(nearWeight),height.mul(nearWeight)));
  waterMaterial.normalNode=transformNormalToView(normal);
  const opticalColor=mix(deepColor,reflectedColor,fresnel.mul(.48).add(.06));
  const atmosphere=smoothstep(350,1000,positionWorld.sub(cameraPosition).length());
  const foamNoise=mx_noise_float(vec3(x.mul(.32),z.mul(.32),time.mul(.19)));
  const crest=float(1).sub(normalUp).add(height.mul(.055));
  const foam=smoothstep(.18,.31,crest).mul(smoothstep(.05,.42,foamNoise)).mul(nearWeight);
  const surface=mix(opticalColor,vec3(.48,.60,.60),foam.mul(.38));
  waterMaterial.colorNode=mix(surface,horizonColor,atmosphere);

  // Only the near tile incurs a reflection pass. The outer ring stays inexpensive.
  const nearMaterial=new THREE.NodeMaterial();
  nearMaterial.positionNode=waterMaterial.positionNode;
  const reflection=reflector();
  reflection.reflector.resolutionScale=quality==='high'?.7:.5;
  reflection.uvNode=reflection.uvNode.add(vec2(slopeX,slopeZ).mul(.045));
  const sunDirection=uniform(new THREE.Vector3(-.45,.8,.25).normalize());
  const sunStrength=uniform(.08);
  const sunReflection=sunDirection.negate().reflect(worldNormal).normalize();
  const glint=sunReflection.dot(view).max(0).pow(48).mul(sunStrength);
  const edge=positionLocal.x.abs().max(positionLocal.y.abs());
  const reflectionFade=float(1).sub(smoothstep(88,124,edge));
  nearMaterial.colorNode=mix(waterMaterial.colorNode,reflection.rgb.mul(vec3(.12,.15,.16)),fresnel.mul(.12).mul(reflectionFade)).add(vec3(1,.77,.48).mul(glint).mul(reflectionFade));

  const group=new THREE.Group();group.position.y=-.12;group.rotation.x=-Math.PI/2;scene.add(group);
  const near=quality==='performance'?96:quality==='high'?256:192;
  const far=quality==='performance'?64:quality==='high'?160:128;
  const addTile=(width,depth,ox,oz,sx,sz,material=waterMaterial)=>{
    const geometry=new THREE.PlaneGeometry(width,depth,sx,sz).translate(ox,-oz,0);
    // Preserve the animated wave silhouette while allowing off-screen tiles to be skipped.
    geometry.computeBoundingSphere();geometry.boundingSphere.radius+=3;
    const tile=new THREE.Mesh(geometry,material);
    tile.castShadow=false;tile.receiveShadow=false;
    group.add(tile);return tile;
  };
  const nearTile=addTile(256,256,0,0,near,near,quality==='performance'?waterMaterial:nearMaterial);
  if(quality!=='performance')nearTile.add(reflection.target);
  // Shared edge vertices keep the near/far wave surfaces watertight.
  for(const side of [-1,1]){
    addTile(256,972,0,side*614,near,far);
    addTile(972,256,side*614,0,far,near);
    for(const depthSide of [-1,1])addTile(972,972,side*614,depthSide*614,far,far);
  }
  // Beyond the animated sea, the same material has already faded to the fog
  // colour. These coarse tiles extend past the camera's 4 km far plane, so
  // neither the water mesh nor a hard colour seam can form a visible border.
  for(const side of [-1,1]){
    addTile(8000,2900,0,side*2550,2,2);
    addTile(2900,2200,side*2550,0,2,2);
  }

  return {
    group,
    controls:{swell,deepColor,reflectedColor,horizonColor,sunDirection,sunStrength},
    update(player){if(!player)return;group.position.x=player.x;group.position.z=player.z;origin.value.set(player.x,-player.z);},
    dispose(){group.children.forEach(tile=>tile.geometry.dispose());waterMaterial.dispose();nearMaterial.dispose();scene.remove(group);}
  };
}
