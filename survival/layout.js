// Authoring coordinates for the playable route and far-field island silhouettes.
// Existing save IDs remain stable; only world-space placement changes.
export const HAVEN_ELEVATION=32;
export const HAVEN_ISLAND={id:'haven',name:'Starting Island',x:0,z:0,radius:49,elevation:HAVEN_ELEVATION};
export const ECHO_ISLAND={id:'echo',name:'Sky Island',x:60,z:-310,radius:29,elevation:92};
export const OLD_ECHO={x:112,z:-48,radius:29,elevation:46};
export const ISLAND_LAYOUT=[HAVEN_ISLAND,ECHO_ISLAND];
// Headlands extend outward from the original safe coastline; no old land is removed.
export function shoreRadius(island,angle){
  if(island.id!=='haven')return island.radius;
  return island.radius*(1+.025+.075*(1+Math.sin(angle*3+.4))+.035*(1+Math.sin(angle*7-1.1))+.014*(1+Math.sin(angle*13+.7)));
}
// Distinct heights and receding depths hint at later climbs without making these islands playable.
export const DISTANT_ISLANDS=[
  {x:-250,z:-450,elevation:160,radius:30},
  {x:180,z:-535,elevation:205,radius:34},
  {x:-90,z:-670,elevation:270,radius:40},
  {x:320,z:-715,elevation:345,radius:46},
  {x:-350,z:-810,elevation:435,radius:52},
  {x:120,z:-930,elevation:540,radius:62},
];
export function migrateEchoPoint(x,z,version){
  if(version>=8||Math.hypot(x-OLD_ECHO.x,z-OLD_ECHO.z)>=OLD_ECHO.radius)return {x,z,migrated:false};
  return {x:x+ECHO_ISLAND.x-OLD_ECHO.x,z:z+ECHO_ISLAND.z-OLD_ECHO.z,migrated:true};
}
