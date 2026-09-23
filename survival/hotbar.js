export const TOOL_SLOTS=[
  {id:'hands',name:'Hands',icon:'hands'},
  {id:'axe',name:'Field axe',icon:'axe'},
  {id:'berries',name:'Berries',icon:'berries'}
];
export function equippedTool(state){
  if(state.equippedTool==='berries')return 'berries';
  if(state.equippedTool==='axe'&&state.tools.includes('axe'))return 'axe';
  // Saves made before tool selection existed used the axe automatically.
  if(state.equippedTool===undefined&&state.tools.includes('axe'))return 'axe';
  return 'hands';
}
export function selectTool(state,id){
  if(!TOOL_SLOTS.some(t=>t.id===id)||(id==='axe'&&!state.tools.includes('axe')))return false;
  state.equippedTool=id;return true;
}
export function cycleTool(state,direction){
  const slots=TOOL_SLOTS.filter(t=>t.id!=='axe'||state.tools.includes('axe'));
  const current=slots.findIndex(t=>t.id===equippedTool(state));
  return selectTool(state,slots[(current+(direction<0?-1:1)+slots.length)%slots.length].id);
}
