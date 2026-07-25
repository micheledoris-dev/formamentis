import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronRight,
  Headphones,
  Home,
  Library,
  LoaderCircle,
  Menu,
  Music2,
  Pause,
  Play,
  Plus,
  TimerReset,
  Trash2,
  Upload,
  Wind,
  X,
} from 'lucide-react'
import { supabase, supabaseConfigured } from './supabase'
import { deleteLocalAudio, getLocalAudio, saveLocalAudio } from './storage'

const defaultRooms = [
  { id: 'respira', name: 'Respira', note: 'Quando hai bisogno di rallentare.' },
  { id: 'ricomincia', name: 'Ricomincia', note: 'Per dare un ritmo nuovo alla giornata.' },
  { id: 'impara', name: 'Impara', note: 'Audiolibri, podcast e parole che restano.' },
  { id: 'silenzio', name: 'Silenzio', note: 'Uno spazio senza rumore.' },
]

const starterMedia = [
  { id: 'demo-1', title: 'Respiro lento', author: 'FormaMentis', media_type: 'meditation', room: 'Respira', demo: true },
  { id: 'demo-2', title: 'Pensieri in movimento', author: 'FormaMentis', media_type: 'audiobook', room: 'Impara', demo: true },
]

const mediaLabels = { music: 'Musica', audiobook: 'Audiolibro', podcast: 'Podcast', meditation: 'Meditazione' }

function safeJson(value, fallback) {
  try { return JSON.parse(value) ?? fallback } catch { return fallback }
}

function Brand() {
  return <div className="brand" aria-label="FormaMentis"><span className="brandLight">forma</span><span className="brandBold">mentis</span></div>
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

export default function App() {
  const [view, setView] = useState('home')
  const [showUpload, setShowUpload] = useState(false)
  const [showRoom, setShowRoom] = useState(false)
  const [rooms, setRooms] = useState(() => safeJson(localStorage.getItem('formamentis-rooms'), defaultRooms))
  const [media, setMedia] = useState(() => safeJson(localStorage.getItem('formamentis-media'), starterMedia))
  const [activeTrack, setActiveTrack] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [onlineReady, setOnlineReady] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef(null)
  const objectUrlRef = useRef(null)

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Buongiorno'
    if (hour < 18) return 'Buon pomeriggio'
    return 'Buonasera'
  }, [])

  useEffect(() => localStorage.setItem('formamentis-rooms', JSON.stringify(rooms)), [rooms])
  useEffect(() => localStorage.setItem('formamentis-media', JSON.stringify(media.map(({ play_url, ...item }) => item))), [media])

  useEffect(() => {
    let mounted = true
    async function connect() {
      if (!supabaseConfigured) return
      try {
        let { data } = await supabase.auth.getSession()
        if (!data.session) {
          const result = await supabase.auth.signInAnonymously()
          if (result.error) throw result.error
          data = { session: result.data.session }
        }
        const user = data.session?.user
        if (!user) return
        const { data: items, error } = await supabase.from('media_items').select('*').order('created_at', { ascending: false })
        if (error) throw error
        const hydrated = await Promise.all((items || []).map(async item => {
          const { data: signed } = await supabase.storage.from('audio-files').createSignedUrl(item.storage_path, 3600)
          return { ...item, play_url: signed?.signedUrl }
        }))
        if (mounted) {
          setMedia(hydrated.length ? hydrated : starterMedia)
          setOnlineReady(true)
        }
      } catch (error) {
        if (mounted) setMessage(`Supabase: ${error.message}`)
      }
    }
    connect()
    return () => { mounted = false }
  }, [])

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !activeTrack?.play_url) return
    audio.src = activeTrack.play_url
    audio.load()
    if (playing) audio.play().catch(() => setPlaying(false))
  }, [activeTrack?.id, activeTrack?.play_url])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !activeTrack?.play_url) return
    if (playing) audio.play().catch(() => setPlaying(false))
    else audio.pause()
  }, [playing])

  async function selectTrack(item) {
    setMessage('')
    if (item.demo) {
      setActiveTrack(item)
      setPlaying(false)
      setMessage('Questo è un contenuto dimostrativo. Carica un file audio per ascoltarlo davvero.')
      return
    }

    let playable = item
    if (item.local && !item.play_url) {
      const blob = await getLocalAudio(item.id)
      if (!blob) {
        setMessage('Il file locale non è più disponibile. Ricaricalo nella Collezione.')
        return
      }
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = URL.createObjectURL(blob)
      playable = { ...item, play_url: objectUrlRef.current }
    }
    setActiveTrack(playable)
    setPlaying(Boolean(playable.play_url))
  }

  async function uploadMedia(event) {
    event.preventDefault()
    setMessage('')
    const form = new FormData(event.currentTarget)
    const file = form.get('file')
    const title = String(form.get('title') || '').trim()
    const author = String(form.get('author') || '').trim()
    const mediaType = String(form.get('media_type') || 'music')
    const room = String(form.get('room') || '')

    if (!(file instanceof File) || file.size === 0) return setMessage('Scegli prima un file audio.')
    if (!title) return setMessage('Inserisci il titolo.')
    setUploading(true)

    try {
      if (!supabaseConfigured) {
        const id = `local-${crypto.randomUUID()}`
        await saveLocalAudio(id, file)
        const item = { id, title, author: author || 'Senza autore', media_type: mediaType, room, file_name: file.name, local: true, created_at: new Date().toISOString() }
        setMedia(current => [item, ...current.filter(x => !x.demo)])
        setShowUpload(false)
        event.currentTarget.reset()
        await selectTrack(item)
        return
      }

      let { data } = await supabase.auth.getSession()
      if (!data.session) {
        const login = await supabase.auth.signInAnonymously()
        if (login.error) throw login.error
        data = { session: login.data.session }
      }
      const user = data.session?.user
      if (!user) throw new Error('Accesso anonimo Supabase non disponibile.')

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${user.id}/${Date.now()}-${safeName}`
      const { error: storageError } = await supabase.storage.from('audio-files').upload(storagePath, file, { contentType: file.type || 'audio/mpeg' })
      if (storageError) throw storageError

      const record = { user_id: user.id, title, author: author || null, media_type: mediaType, room: room || null, storage_path: storagePath, file_name: file.name, mime_type: file.type, size_bytes: file.size }
      const { data: inserted, error: dbError } = await supabase.from('media_items').insert(record).select().single()
      if (dbError) throw dbError
      const { data: signed } = await supabase.storage.from('audio-files').createSignedUrl(storagePath, 3600)
      const item = { ...inserted, play_url: signed?.signedUrl }
      setMedia(current => [item, ...current.filter(x => !x.demo)])
      setOnlineReady(true)
      setShowUpload(false)
      event.currentTarget.reset()
      await selectTrack(item)
    } catch (error) {
      setMessage(error.message || 'Caricamento non riuscito.')
    } finally {
      setUploading(false)
    }
  }

  function createRoom(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    const note = String(form.get('note') || '').trim()
    if (!name) return
    setRooms(current => [...current, { id: crypto.randomUUID(), name, note: note || 'Il tuo spazio personale.' }])
    setShowRoom(false)
    event.currentTarget.reset()
  }

  async function removeMedia(event, item) {
    event.stopPropagation()
    if (!confirm(`Eliminare “${item.title}”?`)) return
    try {
      if (item.local) await deleteLocalAudio(item.id)
      if (supabaseConfigured && item.storage_path && !item.demo) {
        await supabase.storage.from('audio-files').remove([item.storage_path])
        await supabase.from('media_items').delete().eq('id', item.id)
      }
      setMedia(current => current.filter(x => x.id !== item.id))
      if (activeTrack?.id === item.id) {
        setPlaying(false)
        setActiveTrack(null)
      }
    } catch (error) { setMessage(error.message) }
  }

  function seek(event) {
    const value = Number(event.target.value)
    if (!audioRef.current) return
    audioRef.current.currentTime = value
    setProgress(value)
  }

  return (
    <div className="shell">
      <audio ref={audioRef} onEnded={() => setPlaying(false)} onTimeUpdate={e => setProgress(e.currentTarget.currentTime)} onLoadedMetadata={e => setDuration(e.currentTarget.duration)} />

      <header className="topbar"><Brand /><button className="iconButton" aria-label="Menu"><Menu size={21} strokeWidth={1.6} /></button></header>

      <main>
        {view === 'home' && <section className="hero"><div className="overlay" /><div className="heroContent"><p className="eyebrow">{greeting}, FLAMINIA</p><h1>Come vuoi stare?</h1><p className="heroLead">Non conserviamo file. Custodiamo momenti.</p><div className="actions"><button className="primary" onClick={() => setView('rooms')}>Scegli una stanza</button><button className="secondary" onClick={() => setView('library')}>La Collezione</button></div></div></section>}

        {view === 'rooms' && <section className="page"><div className="pageHead"><div><p className="eyebrow">I TUOI LUOGHI</p><h2>Stanze</h2></div><button className="addButton" onClick={() => setShowRoom(true)} aria-label="Crea una stanza"><Plus size={27} /></button></div><div className="roomGrid">{rooms.map((room, index) => <button className={`roomCard room${(index % 4) + 1}`} key={room.id} onClick={() => setView('library')}><span>STANZA {String(index + 1).padStart(2, '0')}</span><strong>{room.name}</strong><p>{room.note}</p><ChevronRight size={20} /></button>)}</div></section>}

        {view === 'rituals' && <section className="page"><div className="pageHead"><div><p className="eyebrow">TEMPO PER TE</p><h2>Rituali</h2></div></div><article className="ritualCard"><Wind /><div><strong>Respira</strong><span>Ogni mattina · 7 minuti</span><p>Un intervallo breve per cominciare con ordine.</p></div></article><article className="ritualCard"><TimerReset /><div><strong>Ricomincia</strong><span>Quando ne senti il bisogno</span><p>Il tuo spazio non deve rispettare un orario.</p></div></article></section>}

        {view === 'library' && <section className="page"><div className="pageHead"><div><p className="eyebrow">MUSICA E PAROLE</p><h2>La Collezione</h2></div><button className="addButton" onClick={() => setShowUpload(true)} aria-label="Carica un file"><Plus size={27} /></button></div><button className="uploadHint" onClick={() => setShowUpload(true)}><Upload size={21} /><div><strong>Aggiungi un nuovo ascolto</strong><span>Musica, audiolibri, podcast o meditazioni</span></div><ChevronRight size={20} /></button>{message && <div className="pageMessage">{message}</div>}<div className="mediaList">{media.length === 0 && <div className="emptyState"><Music2 /><strong>La Collezione è vuota</strong><span>Carica il primo contenuto e premi Play.</span></div>}{media.map((item, index) => <button className={`mediaItem ${activeTrack?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => selectTrack(item)}><span className="cover">{String(index + 1).padStart(2, '0')}</span><span className="mediaMeta"><strong>{item.title}</strong><small>{mediaLabels[item.media_type] || item.media_type}{item.author ? ` · ${item.author}` : ''}{item.room ? ` · ${item.room}` : ''}</small></span><span className="itemActions">{!item.demo && <span role="button" tabIndex="0" className="deleteButton" onClick={e => removeMedia(e, item)} aria-label="Elimina"><Trash2 size={16} /></span>}<Play size={18} fill="currentColor" /></span></button>)}</div></section>}
      </main>

      {activeTrack && <aside className="player"><div className="playerTop"><div className="playerIcon"><Music2 size={18} /></div><div className="playerText"><strong>{activeTrack.title}</strong><span>{activeTrack.author || mediaLabels[activeTrack.media_type]}</span></div><button onClick={() => activeTrack.play_url && setPlaying(!playing)} aria-label={playing ? 'Pausa' : 'Riproduci'}>{playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button></div><div className="timeline"><span>{formatTime(progress)}</span><input type="range" min="0" max={duration || 0} value={Math.min(progress, duration || 0)} onChange={seek} /><span>{formatTime(duration)}</span></div></aside>}

      <nav className="bottomNav"><button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}><Home size={20} /><span>Benvenuto</span></button><button className={view === 'rooms' ? 'active' : ''} onClick={() => setView('rooms')}><Headphones size={20} /><span>Stanze</span></button><button className={view === 'rituals' ? 'active' : ''} onClick={() => setView('rituals')}><TimerReset size={20} /><span>Rituali</span></button><button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}><Library size={20} /><span>Collezione</span></button></nav>

      {showUpload && <div className="modalBackdrop" onMouseDown={() => setShowUpload(false)}><form className="modal" onSubmit={uploadMedia} onMouseDown={e => e.stopPropagation()}><button className="closeButton" type="button" onClick={() => setShowUpload(false)}><X size={20} /></button><p className="eyebrow">NUOVO ASCOLTO</p><h2>Aggiungi</h2><p className="modalIntro">Scegli ciò che questo contenuto rappresenta per te.</p><label>Tipo<select name="media_type" defaultValue="music"><option value="music">Musica</option><option value="audiobook">Audiolibro</option><option value="podcast">Podcast</option><option value="meditation">Meditazione</option></select></label><label>Titolo<input name="title" placeholder="Es. Il mio audiolibro" required /></label><label>Autore<input name="author" placeholder="Facoltativo" /></label><label>Stanza<select name="room" defaultValue={rooms[0]?.name}>{rooms.map(room => <option key={room.id}>{room.name}</option>)}</select></label><label className="fileField">File audio<input name="file" type="file" accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.flac" required /></label>{message && <div className="message">{message}</div>}<button className="primary submit" type="submit" disabled={uploading}>{uploading ? <><LoaderCircle className="spin" size={19} /> Caricamento...</> : 'Carica e ascolta'}</button><small className="localNotice">{supabaseConfigured ? (onlineReady ? 'Archivio online collegato.' : 'Collegamento Supabase in corso…') : 'Modalità locale persistente: il file resta su questo dispositivo anche dopo la chiusura del browser.'}</small></form></div>}

      {showRoom && <div className="modalBackdrop" onMouseDown={() => setShowRoom(false)}><form className="modal" onSubmit={createRoom} onMouseDown={e => e.stopPropagation()}><button className="closeButton" type="button" onClick={() => setShowRoom(false)}><X size={20} /></button><p className="eyebrow">NUOVO LUOGO</p><h2>Crea una stanza</h2><p className="modalIntro">Dalle un nome che descriva come desideri stare.</p><label>Nome<input name="name" placeholder="Es. Concentrazione" required /></label><label>Significato<input name="note" placeholder="Es. Quando devo ritrovare il filo." /></label><button className="primary submit" type="submit">Crea la stanza</button></form></div>}
    </div>
  )
}
