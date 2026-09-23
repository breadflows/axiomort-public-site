// Source-inspired acceleration and air strafing, tuned to the island's metre scale.
export function createMotion(){return {x:0,z:0};}
export function resetMotion(motion){motion.x=0;motion.z=0;}
export function movePlayer(player,motion,input,dt,canMove){
  const length=Math.hypot(input.forward,input.side);
  const wishSpeed=input.speed*Math.min(1,length);
  const wishX=length?(-Math.sin(player.yaw)*input.forward+Math.cos(player.yaw)*input.side)/length:0;
  const wishZ=length?(-Math.cos(player.yaw)*input.forward-Math.sin(player.yaw)*input.side)/length:0;
  if(input.grounded){
    const speed=Math.hypot(motion.x,motion.z);
    if(speed){const remaining=Math.max(0,speed-Math.max(speed,2)*7*dt)/speed;motion.x*=remaining;motion.z*=remaining;}
  }
  if(wishSpeed){
    const cap=input.grounded?wishSpeed:Math.min(wishSpeed,2.4);
    const along=motion.x*wishX+motion.z*wishZ;
    const added=Math.min(Math.max(0,cap-along),(input.grounded?22:8)*wishSpeed*dt);
    motion.x+=wishX*added;motion.z+=wishZ*added;
  }
  if(!input.grounded){
    const speed=Math.hypot(motion.x,motion.z),limit=Math.max(9.5,input.speed*1.4);
    if(speed>limit){motion.x*=limit/speed;motion.z*=limit/speed;}
  }
  const dx=motion.x*dt,dz=motion.z*dt;
  // Sweep in short steps so extra speed cannot pass through trees or buildings.
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));
  for(let i=0;i<steps;i++){
    if(canMove(player.x+dx/steps,player.z))player.x+=dx/steps;else motion.x=0;
    if(canMove(player.x,player.z+dz/steps))player.z+=dz/steps;else motion.z=0;
  }
  return {dx,dz};
}
