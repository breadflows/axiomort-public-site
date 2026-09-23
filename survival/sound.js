export function createSound(){
 let context,master,musicBus,effectsBus,ambientSource,noiseBuffer;
 let volume=.35,musicVolume=1,effectsVolume=1,started=false,paused=true,lastHover=-Infinity,lastAdjust=-Infinity;
 const buffers=new Map(),decoded=new Set();

 async function unlock(){
  try{
   if(!context){
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextClass)return;
    context=new AudioContextClass();
    master=context.createGain();master.gain.value=volume;master.connect(context.destination);
    musicBus=context.createGain();musicBus.gain.value=paused?0:musicVolume;musicBus.connect(master);
    effectsBus=context.createGain();effectsBus.gain.value=effectsVolume;effectsBus.connect(master);
   }
   if(context.state!=='running')await context.resume();
  }catch{/* Audio is optional and must never interrupt play. */}
 }
 function oscillator(type,from,to,duration,gain,delay=0){
  const t=context.currentTime+delay,o=context.createOscillator(),g=context.createGain();
  o.type=type;o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(Math.max(1,to),t+duration);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.008);
  g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  o.connect(g);g.connect(effectsBus);o.start(t);o.stop(t+duration+.01);
  o.onended=()=>{o.disconnect();g.disconnect();};
 }
 function noise(center,duration,gain){
  if(!noiseBuffer){
   const count=Math.ceil(context.sampleRate*.35),data=new Float32Array(count);let seed=9137;
   for(let i=0;i<count;i++){seed=(seed*16807)%2147483647;data[i]=(seed/2147483647)*2-1;}
   noiseBuffer=context.createBuffer(1,count,context.sampleRate);noiseBuffer.copyToChannel(data,0);
  }
  const t=context.currentTime,source=context.createBufferSource(),filter=context.createBiquadFilter(),g=context.createGain();
  source.buffer=noiseBuffer;filter.type='bandpass';filter.frequency.value=center;filter.Q.value=.8;
  g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  source.connect(filter);filter.connect(g);g.connect(effectsBus);source.start(t);source.stop(t+duration+.01);
  source.onended=()=>{source.disconnect();filter.disconnect();g.disconnect();};
 }
 function cue(kind='select'){
  if(!context||!volume||!effectsVolume)return;
  if(context.state!=='running'){void unlock().then(()=>{if(context?.state==='running')cue(kind);});return;}
  const now=performance.now();
  if(kind==='hover'){if(now-lastHover<85)return;lastHover=now;oscillator('triangle',760,530,.052,.09);noise(2200,.014,.045);return;}
  if(kind==='adjust'){if(now-lastAdjust<65)return;lastAdjust=now;oscillator('sine',620,780,.055,.10);return;}
  switch(kind){
   case 'select': oscillator('triangle',440,615,.095,.18);noise(1800,.018,.06);break;
   case 'back': oscillator('sine',500,290,.09,.15);break;
   case 'equip': oscillator('triangle',350,590,.12,.19);noise(1350,.025,.1);break;
   case 'wood': oscillator('triangle',185,90,.12,.21);noise(620,.095,.32);break;
   case 'stone': oscillator('sine',380,190,.16,.17);noise(1900,.105,.26);break;
   case 'scrap': oscillator('triangle',590,280,.17,.18);noise(3100,.11,.28);break;
   case 'fiber': noise(1850,.085,.20);oscillator('sine',430,290,.085,.08);break;
   case 'berries': noise(1150,.065,.13);oscillator('sine',520,380,.07,.10);break;
   case 'collect': oscillator('sine',510,760,.16,.14);oscillator('sine',760,990,.13,.08,.055);break;
   case 'build': oscillator('triangle',190,105,.18,.24);noise(1000,.11,.28);oscillator('sine',510,670,.18,.10,.06);break;
   case 'eat': oscillator('sine',440,310,.13,.14);noise(850,.055,.10);break;
   case 'step': oscillator('sine',115,75,.085,.065);noise(710,.065,.12);break;
   case 'jump': oscillator('sine',145,225,.13,.10);noise(780,.045,.08);break;
   case 'land': oscillator('sine',130,70,.12,.12);noise(570,.085,.17);break;
   case 'error': oscillator('triangle',210,125,.18,.16);break;
   case 'travel': oscillator('sine',175,650,.32,.20);oscillator('triangle',340,880,.25,.09,.065);break;
   case 'objective': oscillator('sine',570,760,.17,.15);oscillator('sine',760,1030,.23,.12,.12);break;
   default: oscillator('sine',410,500,.10,.14);
  }
 }
 async function load(name){
  if(buffers.has(name))return buffers.get(name);
  const promise=fetch(`survival/assets/${name}.ogg`).then(r=>{if(!r.ok)throw Error('Audio unavailable');return r.arrayBuffer();}).then(b=>context.decodeAudioData(b)).then(b=>{decoded.add(name);return b;});
  buffers.set(name,promise);return promise;
 }
 async function start(){
  await unlock();if(started||!context)return;started=true;
  try{
   const buffer=await load('mountain');
   ambientSource=context.createBufferSource();const ambientGain=context.createGain();ambientGain.gain.value=.13;
   ambientSource.buffer=buffer;ambientSource.loop=true;ambientSource.connect(ambientGain);ambientGain.connect(musicBus);ambientSource.start();
  }catch{/* Optional ambience must not block the game. */}
 }
 async function effect(name,gain=.45,pan=0){
  try{
   if(!context||!effectsVolume||!volume)return;
   const buffer=await load(name),source=context.createBufferSource(),g=context.createGain(),p=context.createStereoPanner();
   source.buffer=buffer;g.gain.value=gain;p.pan.value=pan;
   source.connect(g);g.connect(p);p.connect(effectsBus);source.start();
   source.onended=()=>{source.disconnect();g.disconnect();p.disconnect();};
  }catch{/* Optional effects fail quietly. */}
 }
 return {
  unlock,start,effect,cue,
  setVolume(v){volume=v;if(master)master.gain.setTargetAtTime(v,context.currentTime,.05);},
  setMusicVolume(v){musicVolume=v;if(musicBus)musicBus.gain.setTargetAtTime(paused?0:v,context.currentTime,.12);},
  setEffectsVolume(v){effectsVolume=v;if(effectsBus)effectsBus.gain.setTargetAtTime(v,context.currentTime,.05);},
  setPaused(v){paused=v;if(musicBus)musicBus.gain.setTargetAtTime(v?0:musicVolume,context.currentTime,.12);},
  get status(){return {started,paused,context:context?.state||'not-started',decoded:decoded.size,volume,musicVolume,effectsVolume};}
 };
}
