const groups={
 concept:[
  {id:'arrival',title:'ARRIVAL',src:'landing/arrival.webp',alt:'Concept of an open island cove and a distant rift'},
  {id:'refuge',title:'ISLAND SHELTER',src:'landing/refuge.webp',alt:'Concept of a timber shelter built from coastal salvage'},
  {id:'expedition',title:'ISLAND CROSSING',src:'landing/expedition.webp',alt:'Concept of a vessel approaching fractured islands'}
 ],
 gameplay:[
  {id:'island',title:'THE ISLAND',src:'landing/gameplay/island.webp',alt:'Actual browser playtest: the starting island seen from the arrival camera'},
  {id:'shelter',title:'BUILT SHELTER',src:'landing/gameplay/shelter.webp',alt:'Browser demo: player-built shelter'},
  {id:'rift',title:'RIFT TRIAL',src:'landing/gameplay/rift.webp',alt:'Browser demo: a trial reached through the island rift'}
 ]
};
let category='concept',selected=0;
const $=id=>document.getElementById(id),viewer=$('art-viewer');
function select(index){
 selected=index;const art=groups[category][index];$('stage-image').src=art.src;$('stage-image').alt=art.alt;$('stage-title').textContent=art.title;$('stage-kind').textContent=category==='concept'?'ENVIRONMENT CONCEPT · NOT GAMEPLAY':'CAPTURED IN THE BROWSER PLAYTEST';$('media-count').textContent=`${String(index+1).padStart(2,'0')} / ${String(groups[category].length).padStart(2,'0')}`;$('open-art').setAttribute('aria-label','Enlarge '+art.title.toLowerCase());
 for(const [i,b] of [...$('media-thumbnails').children].entries())b.setAttribute('aria-pressed',String(i===index));
}
function showCategory(next){
 category=next;for(const b of document.querySelectorAll('[data-category]')){const active=b.dataset.category===next;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}$('media-panel').setAttribute('aria-labelledby',next==='concept'?'concept-tab':'gameplay-tab');
 $('media-thumbnails').replaceChildren(...groups[category].map((art,i)=>{const b=document.createElement('button');b.dataset.art=art.id;b.setAttribute('aria-label',art.title);b.innerHTML=`<img src="${art.src}" alt="" loading="lazy">`;b.onclick=()=>select(i);return b;}));select(0);
}
for(const b of document.querySelectorAll('[data-category]')){b.onclick=()=>showCategory(b.dataset.category);b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'concept':e.key==='End'?'gameplay':category==='concept'?'gameplay':'concept';showCategory(next);document.querySelector(`[data-category=${next}]`).focus();}};}
$('open-art').onclick=()=>{const art=groups[category][selected];$('full-art').src=art.src;$('full-art').alt=art.alt;$('art-title').textContent=art.title;$('art-description').textContent=category==='concept'?'AXIOMORT environment concept. Visual direction, not gameplay footage.':'Captured from the current AXIOMORT browser playtest.';viewer.showModal();};
$('close-art').onclick=()=>viewer.close();viewer.addEventListener('click',e=>{if(e.target===viewer){const r=viewer.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)viewer.close();}});
const toggle=$('nav-toggle'),nav=$('main-nav');toggle.onclick=()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');nav.classList.toggle('open',open);};
nav.addEventListener('click',e=>{if(e.target.closest('a')){nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('open')){nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.focus();}});
showCategory('concept');
try{const save=JSON.parse(localStorage.getItem('axiomort_survival_v1'));if(save?.savedAt)document.querySelector('[data-play]').innerHTML='CONTINUE GAME';}catch{}
