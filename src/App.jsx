import { useEffect, useMemo, useState } from 'react'
import { BookOpen, ChevronRight, CirclePlus, Flame, Headphones, Home, Library, Menu, Music2, Pause, Play, Plus, TimerReset, Wind, X } from 'lucide-react'

const starterRooms=[
{id:'yoga',name:'Yoga',label:'EQUILIBRIO',description:'Respira, rallenta, ritrova il centro.',icon:Wind,mood:'sand'},
{id:'running',name:'Corsa',label:'ENERGIA',description:'Il ritmo giusto per muovere corpo e pensieri.',icon:Flame,mood:'copper'},
{id:'books',name:'Audiolibri',label:'ASCOLTO',description:'Storie e idee da portare con te.',icon:BookOpen,mood:'blue'},
{id:'quiet',name:'Silenzio',label:'PRESENZA',description:'Uno spazio vuoto, finalmente tuo.',icon:Headphones,mood:'stone'}]
const libraryItems=[{id:1,title:'Respiro lento',type:'Meditazione',duration:'12 min'},{id:2,title:'Passi nella pioggia',type:'Atmosfera',duration:'28 min'},{id:3,title:'Pensieri in movimento',type:'Audiolibro',duration:'46 min'}]
const rituals=[{id:1,title:'Yoga',when:'Martedì · 10:00',note:'Hai promesso mezz’ora a te stesso.'},{id:2,title:'Corsa',when:'Giovedì · 18:00',note:'Muoviti. Il resto può aspettare.'}]

function Brand(){return <div className="brand"><span className="brandLight">forma</span><span className="brandBold">mentis</span></div>}

export default function App(){
 const [view,setView]=useState('home')
 const [rooms,setRooms]=useState(()=>{const s=localStorage.getItem('fm-rooms');return s?JSON.parse(s):starterRooms})
 const [showRoomCreator,setShowRoomCreator]=useState(false)
 const [newRoom,setNewRoom]=useState('')
 const [activeTrack,setActiveTrack]=useState(libraryItems[0])
 const [playing,setPlaying]=useState(false)
 useEffect(()=>localStorage.setItem('fm-rooms',JSON.stringify(rooms)),[rooms])
 const greeting=useMemo(()=>{const h=new Date().getHours();return h<12?'Buongiorno':h<18?'Buon pomeriggio':'Buonasera'},[])
 function createRoom(e){e.preventDefault();const name=newRoom.trim();if(!name)return;setRooms(r=>[...r,{id:String(Date.now()),name,label:'PERSONALE',description:'La tua stanza. Il tuo modo di viverla.',mood:'forest'}]);setNewRoom('');setShowRoomCreator(false)}
 return <div className="shell">
  <header className="topbar"><Brand/><button className="iconButton"><Menu size={21}/></button></header>
  <main>
   {view==='home'&&<section className="homeView"><div className="ambientGlow ambientOne"/><div className="ambientGlow ambientTwo"/><div className="welcome"><p className="eyebrow">{greeting}, MICHELE</p><h1>Come vuoi stare oggi?</h1><p className="intro">Non scegliere soltanto cosa ascoltare. Scegli il momento che vuoi vivere.</p></div><div className="quickRoom"><div><span>IL TUO PROSSIMO RITUALE</span><strong>Yoga</strong><small>Martedì · 10:00</small></div><button onClick={()=>setView('rituals')}><ChevronRight size={22}/></button></div><div className="sectionHeading"><div><span>ENTRA</span><h2>Le tue stanze</h2></div><button className="textButton" onClick={()=>setView('rooms')}>Vedi tutte</button></div><div className="roomStrip">{rooms.slice(0,3).map(room=><button key={room.id} className={`roomMini ${room.mood||'forest'}`} onClick={()=>setView('rooms')}><span>{room.label}</span><strong>{room.name}</strong></button>)}</div></section>}
   {view==='rooms'&&<section className="pageView"><div className="pageTitle"><div><p className="eyebrow">I TUOI LUOGHI</p><h2>Stanze</h2></div><button className="addButton" onClick={()=>setShowRoomCreator(true)}><Plus size={24}/></button></div><p className="pageIntro">Non sono playlist. Sono luoghi, attività, persone e stati d’animo.</p><div className="roomGrid">{rooms.map(room=>{const Icon=room.icon;return <article className={`roomCard ${room.mood||'forest'}`} key={room.id}><div className="roomTop"><span>{room.label}</span>{Icon?<Icon size={24}/>:<Music2 size={24}/>}</div><div><h3>{room.name}</h3><p>{room.description}</p></div><button onClick={()=>setPlaying(true)}>Entra <ChevronRight size={18}/></button></article>})}</div></section>}
   {view==='rituals'&&<section className="pageView"><div className="pageTitle"><div><p className="eyebrow">TEMPO PER TE</p><h2>Rituali</h2></div><button className="addButton"><Plus size={24}/></button></div><p className="pageIntro">Piccoli appuntamenti che non chiedono prestazioni. Soltanto presenza.</p><div className="ritualList">{rituals.map(r=><article className="ritualCard" key={r.id}><div className="ritualIcon"><TimerReset size={23}/></div><div><strong>{r.title}</strong><span>{r.when}</span><p>{r.note}</p></div><button><ChevronRight size={20}/></button></article>)}</div></section>}
   {view==='library'&&<section className="pageView"><div className="pageTitle"><div><p className="eyebrow">ASCOLTA</p><h2>Libreria</h2></div><button className="addButton"><CirclePlus size={24}/></button></div><p className="pageIntro">Musica, parole, meditazioni e atmosfere raccolte in un solo spazio.</p><div className="libraryList">{libraryItems.map((item,i)=><button className={`libraryItem ${activeTrack?.id===item.id?'selected':''}`} key={item.id} onClick={()=>{setActiveTrack(item);setPlaying(true)}}><span className="cover">{String(i+1).padStart(2,'0')}</span><span className="trackMeta"><strong>{item.title}</strong><small>{item.type} · {item.duration}</small></span><Play size={18} fill="currentColor"/></button>)}</div></section>}
  </main>
  {activeTrack&&<aside className={`player ${playing?'playing':''}`}><div className="playerCover"><Music2 size={18}/></div><div className="playerText"><strong>{activeTrack.title}</strong><span>{activeTrack.type}</span></div><button onClick={()=>setPlaying(!playing)}>{playing?<Pause size={20} fill="currentColor"/>:<Play size={20} fill="currentColor"/>}</button></aside>}
  <nav className="bottomNav"><button className={view==='home'?'active':''} onClick={()=>setView('home')}><Home size={20}/><span>Benvenuto</span></button><button className={view==='rooms'?'active':''} onClick={()=>setView('rooms')}><Headphones size={20}/><span>Stanze</span></button><button className={view==='rituals'?'active':''} onClick={()=>setView('rituals')}><TimerReset size={20}/><span>Rituali</span></button><button className={view==='library'?'active':''} onClick={()=>setView('library')}><Library size={20}/><span>Libreria</span></button></nav>
  {showRoomCreator&&<div className="modalBackdrop" onMouseDown={()=>setShowRoomCreator(false)}><form className="modal" onSubmit={createRoom} onMouseDown={e=>e.stopPropagation()}><button className="modalClose" type="button" onClick={()=>setShowRoomCreator(false)}><X size={20}/></button><p className="eyebrow">NUOVO SPAZIO</p><h2>Crea una stanza</h2><p>Quale luogo manca oggi al tuo benessere?</p><input value={newRoom} onChange={e=>setNewRoom(e.target.value)} placeholder="Es. Pioggia, Camino, Montagna..." autoFocus/><button className="primaryButton" type="submit">Crea la stanza</button></form></div>}
 </div>
}
