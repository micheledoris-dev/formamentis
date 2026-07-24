import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
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
  Upload,
  Wind,
  X,
} from 'lucide-react'
import { supabase, supabaseConfigured } from './supabase'

const starterRooms = ['Yoga', 'Corsa', 'Audiolibri', 'Silenzio']

const starterMedia = [
  {
    id: 'demo-1',
    title: 'Respiro lento',
    author: 'FormaMentis',
    media_type: 'meditation',
    room: 'Yoga',
    duration: '12 min',
    local: true,
  },
  {
    id: 'demo-2',
    title: 'Pensieri in movimento',
    author: 'FormaMentis',
    media_type: 'audiobook',
    room: 'Audiolibri',
    duration: '46 min',
    local: true,
  },
]

const mediaLabels = {
  music: 'Musica',
  audiobook: 'Audiolibro',
  podcast: 'Podcast',
  meditation: 'Meditazione',
}

function Brand() {
  return (
    <div className="brand" aria-label="FormaMentis">
      <span className="brandLight">forma</span>
      <span className="brandBold">mentis</span>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState('home')
  const [showUpload, setShowUpload] = useState(false)
  const [media, setMedia] = useState(() => {
    const saved = localStorage.getItem('formamentis-media')
    return saved ? JSON.parse(saved) : starterMedia
  })
  const [activeTrack, setActiveTrack] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const audioRef = useRef(null)

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Buongiorno'
    if (hour < 18) return 'Buon pomeriggio'
    return 'Buonasera'
  }, [])

  useEffect(() => {
    localStorage.setItem('formamentis-media', JSON.stringify(media))
  }, [media])

  useEffect(() => {
    if (!audioRef.current || !activeTrack?.play_url) return
    audioRef.current.src = activeTrack.play_url
    if (playing) audioRef.current.play().catch(() => setPlaying(false))
  }, [activeTrack])

  useEffect(() => {
    if (!audioRef.current) return
    if (playing) audioRef.current.play().catch(() => setPlaying(false))
    else audioRef.current.pause()
  }, [playing])

  async function uploadMedia(event) {
    event.preventDefault()
    setMessage('')

    const form = new FormData(event.currentTarget)
    const file = form.get('file')
    const title = String(form.get('title') || '').trim()
    const author = String(form.get('author') || '').trim()
    const mediaType = String(form.get('media_type') || 'music')
    const room = String(form.get('room') || '')

    if (!(file instanceof File) || file.size === 0) {
      setMessage('Scegli prima un file audio.')
      return
    }
    if (!title) {
      setMessage('Inserisci il titolo.')
      return
    }

    setUploading(true)

    try {
      if (!supabaseConfigured) {
        const localUrl = URL.createObjectURL(file)
        const item = {
          id: `local-${Date.now()}`,
          title,
          author: author || 'Senza autore',
          media_type: mediaType,
          room,
          file_name: file.name,
          play_url: localUrl,
          local: true,
        }
        setMedia((current) => [item, ...current])
        setActiveTrack(item)
        setPlaying(true)
        setShowUpload(false)
        event.currentTarget.reset()
        return
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user

      if (!user) {
        throw new Error('Per salvare online bisogna prima collegare il login Supabase.')
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${user.id}/${Date.now()}-${safeName}`

      const { error: storageError } = await supabase.storage
        .from('audio-files')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'audio/mpeg',
        })

      if (storageError) throw storageError

      const { data: signedData, error: signedError } = await supabase.storage
        .from('audio-files')
        .createSignedUrl(storagePath, 60 * 60)

      if (signedError) throw signedError

      const record = {
        user_id: user.id,
        title,
        author: author || null,
        media_type: mediaType,
        room: room || null,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      }

      const { data: inserted, error: dbError } = await supabase
        .from('media_items')
        .insert(record)
        .select()
        .single()

      if (dbError) throw dbError

      const item = { ...inserted, play_url: signedData.signedUrl }
      setMedia((current) => [item, ...current])
      setActiveTrack(item)
      setPlaying(true)
      setShowUpload(false)
      event.currentTarget.reset()
    } catch (error) {
      setMessage(error.message || 'Caricamento non riuscito.')
    } finally {
      setUploading(false)
    }
  }

  function selectTrack(item) {
    setActiveTrack(item)
    if (item.play_url) setPlaying(true)
    else setPlaying(false)
  }

  return (
    <div className="shell">
      <audio ref={audioRef} onEnded={() => setPlaying(false)} />

      <header className="topbar">
        <Brand />
        <button className="iconButton" aria-label="Menu">
          <Menu size={21} strokeWidth={1.6} />
        </button>
      </header>

      <main>
        {view === 'home' && (
          <section className="hero">
            <div className="overlay" />
            <div className="heroContent">
              <p className="eyebrow">{greeting}, FLAMINIA</p>
              <h1>Questo momento è tutto per te.</h1>
              <div className="actions">
                <button className="primary" onClick={() => setView('library')}>Entra</button>
                <button className="secondary" onClick={() => setView('rituals')}>I tuoi rituali</button>
              </div>
            </div>
          </section>
        )}

        {view === 'rooms' && (
          <section className="page">
            <div className="pageHead">
              <div>
                <p className="eyebrow">I TUOI LUOGHI</p>
                <h2>Stanze</h2>
              </div>
            </div>
            <div className="roomGrid">
              {starterRooms.map((room, index) => (
                <button className={`roomCard room${index + 1}`} key={room} onClick={() => setView('library')}>
                  <span>STANZA {String(index + 1).padStart(2, '0')}</span>
                  <strong>{room}</strong>
                  <ChevronRight size={20} />
                </button>
              ))}
            </div>
          </section>
        )}

        {view === 'rituals' && (
          <section className="page">
            <div className="pageHead">
              <div>
                <p className="eyebrow">TEMPO PER TE</p>
                <h2>Rituali</h2>
              </div>
            </div>
            <article className="ritualCard">
              <TimerReset />
              <div>
                <strong>Yoga</strong>
                <span>Martedì · 10:00</span>
                <p>Hai promesso mezz’ora a te stesso.</p>
              </div>
            </article>
            <article className="ritualCard">
              <TimerReset />
              <div>
                <strong>Corsa</strong>
                <span>Giovedì · 18:00</span>
                <p>Muoviti. Il resto può aspettare.</p>
              </div>
            </article>
          </section>
        )}

        {view === 'library' && (
          <section className="page">
            <div className="pageHead">
              <div>
                <p className="eyebrow">MUSICA E PAROLE</p>
                <h2>Ascolta</h2>
              </div>
              <button className="addButton" onClick={() => setShowUpload(true)} aria-label="Carica un file">
                <Plus size={27} />
              </button>
            </div>

            <div className="uploadHint" onClick={() => setShowUpload(true)}>
              <Upload size={21} />
              <div>
                <strong>Aggiungi musica o un audiolibro</strong>
                <span>Premi qui oppure usa il pulsante +</span>
              </div>
              <ChevronRight size={20} />
            </div>

            <div className="mediaList">
              {media.map((item, index) => (
                <button
                  className={`mediaItem ${activeTrack?.id === item.id ? 'selected' : ''}`}
                  key={item.id}
                  onClick={() => selectTrack(item)}
                >
                  <span className="cover">{String(index + 1).padStart(2, '0')}</span>
                  <span className="mediaMeta">
                    <strong>{item.title}</strong>
                    <small>
                      {mediaLabels[item.media_type] || item.media_type}
                      {item.author ? ` · ${item.author}` : ''}
                      {item.room ? ` · ${item.room}` : ''}
                    </small>
                  </span>
                  <Play size={18} fill="currentColor" />
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {activeTrack && (
        <aside className="player">
          <div className="playerIcon"><Music2 size={18} /></div>
          <div className="playerText">
            <strong>{activeTrack.title}</strong>
            <span>{mediaLabels[activeTrack.media_type] || activeTrack.media_type}</span>
          </div>
          <button
            onClick={() => activeTrack.play_url && setPlaying(!playing)}
            aria-label={playing ? 'Pausa' : 'Riproduci'}
          >
            {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
        </aside>
      )}

      <nav className="bottomNav">
        <button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>
          <Home size={20} /><span>Benvenuto</span>
        </button>
        <button className={view === 'rooms' ? 'active' : ''} onClick={() => setView('rooms')}>
          <Headphones size={20} /><span>Stanze</span>
        </button>
        <button className={view === 'rituals' ? 'active' : ''} onClick={() => setView('rituals')}>
          <TimerReset size={20} /><span>Rituali</span>
        </button>
        <button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}>
          <Library size={20} /><span>Ascolta</span>
        </button>
      </nav>

      {showUpload && (
        <div className="modalBackdrop" onMouseDown={() => setShowUpload(false)}>
          <form className="modal" onSubmit={uploadMedia} onMouseDown={(e) => e.stopPropagation()}>
            <button className="closeButton" type="button" onClick={() => setShowUpload(false)}>
              <X size={20} />
            </button>

            <p className="eyebrow">NUOVO ASCOLTO</p>
            <h2>Aggiungi un file</h2>
            <p className="modalIntro">Musica, audiolibri, podcast o meditazioni.</p>

            <label>
              Tipo
              <select name="media_type" defaultValue="music">
                <option value="music">Musica</option>
                <option value="audiobook">Audiolibro</option>
                <option value="podcast">Podcast</option>
                <option value="meditation">Meditazione</option>
              </select>
            </label>

            <label>
              Titolo
              <input name="title" placeholder="Es. Il mio audiolibro" />
            </label>

            <label>
              Autore
              <input name="author" placeholder="Facoltativo" />
            </label>

            <label>
              Stanza
              <select name="room" defaultValue="Audiolibri">
                {starterRooms.map((room) => <option key={room}>{room}</option>)}
              </select>
            </label>

            <label className="fileField">
              File audio
              <input
                name="file"
                type="file"
                accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.flac"
              />
            </label>

            {message && <div className="message">{message}</div>}

            <button className="primary submit" type="submit" disabled={uploading}>
              {uploading ? <><LoaderCircle className="spin" size={19} /> Caricamento...</> : 'Carica e ascolta'}
            </button>

            {!supabaseConfigured && (
              <small className="localNotice">
                Modalità prova: il file funziona subito, ma resta soltanto su questo dispositivo finché Supabase non viene collegato.
              </small>
            )}
          </form>
        </div>
      )}
    </div>
  )
}
