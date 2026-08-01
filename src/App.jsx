import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlarmClock,
  ArrowLeft,
  ChevronRight,
  Headphones,
  Home,
  Library,
  Link2,
  LoaderCircle,
  Menu,
  Moon,
  Music2,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward,
  TimerReset,
  Trash2,
  Upload,
  Volume2,
  Wind,
  X,
} from 'lucide-react'
import { supabase, supabaseConfigured, supabaseConfigurationError } from './supabase'
import { deleteLocalAudio, getLocalAudio, saveLocalAudio } from './storage'

const defaultRooms = [
  { id: 'respira', name: 'Respira', note: 'Quando hai bisogno di rallentare.', position: 1 },
  { id: 'ricomincia', name: 'Ricomincia', note: 'Per dare un ritmo nuovo alla giornata.', position: 2 },
  { id: 'impara', name: 'Impara', note: 'Audiolibri, podcast e parole che restano.', position: 3 },
  { id: 'silenzio', name: 'Silenzio', note: 'Uno spazio senza rumore.', position: 4 },
]

const starterMedia = [
  { id: 'demo-1', title: 'Respiro lento', author: 'FormaMentis', media_type: 'meditation', room_ids: ['respira'], demo: true },
  { id: 'demo-2', title: 'Pensieri in movimento', author: 'FormaMentis', media_type: 'audiobook', room_ids: ['impara'], demo: true },
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
  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const [uploadTargetRoomId, setUploadTargetRoomId] = useState(null)
  const [showUpload, setShowUpload] = useState(false)
  const [showRoom, setShowRoom] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)
  const [showRoomContents, setShowRoomContents] = useState(false)
  const [showRitual, setShowRitual] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [editingMedia, setEditingMedia] = useState(null)
  const [showMediaDetails, setShowMediaDetails] = useState(false)
  const [alarms, setAlarms] = useState(() => safeJson(localStorage.getItem('formamentis-alarms'), []))
  const [sleepTimer, setSleepTimer] = useState(null)
  const sleepIntervalRef = useRef(null)
  const [rooms, setRooms] = useState(() => safeJson(localStorage.getItem('formamentis-rooms'), defaultRooms))
  const [rituals, setRituals] = useState(() => safeJson(localStorage.getItem('formamentis-rituals'), [
    { id: 'respira', name: 'Respira', timing: 'Ogni mattina', duration: '7 minuti', note: 'Un intervallo breve per cominciare con ordine.' },
    { id: 'ricomincia', name: 'Ricomincia', timing: 'Quando ne senti il bisogno', duration: '', note: 'Il tuo spazio non deve rispettare un orario.' },
  ]))
  const [media, setMedia] = useState(() => safeJson(localStorage.getItem('formamentis-media'), starterMedia))
  const [activeTrack, setActiveTrack] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [mediaDetailsError, setMediaDetailsError] = useState('')
  const [roomContentsError, setRoomContentsError] = useState('')
  const [onlineReady, setOnlineReady] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [repeatEnabled, setRepeatEnabled] = useState(false)
  const [shuffleEnabled, setShuffleEnabled] = useState(false)
  const audioRef = useRef(null)
  const objectUrlRef = useRef(null)

  const selectedRoom = useMemo(() => rooms.find(room => room.id === selectedRoomId) || null, [rooms, selectedRoomId])
  const roomMedia = useMemo(() => media.filter(item => (item.room_ids || []).includes(selectedRoomId)), [media, selectedRoomId])
  const roomCounts = useMemo(() => Object.fromEntries(rooms.map(room => [room.id, media.filter(item => (item.room_ids || []).includes(room.id)).length])), [rooms, media])

  useEffect(() => localStorage.setItem('formamentis-rooms', JSON.stringify(rooms)), [rooms])
  useEffect(() => localStorage.setItem('formamentis-rituals', JSON.stringify(rituals)), [rituals])
  useEffect(() => localStorage.setItem('formamentis-media', JSON.stringify(media.map(({ play_url, ...item }) => item))), [media])
  useEffect(() => localStorage.setItem('formamentis-alarms', JSON.stringify(alarms)), [alarms])

  useEffect(() => {
    let mounted = true
    async function connect() {
      if (!supabaseConfigured) {
        if (supabaseConfigurationError && !supabaseConfigurationError.includes('modalità locale')) setMessage(supabaseConfigurationError)
        return
      }
      try {
        let { data } = await supabase.auth.getSession()
        if (!data.session) {
          const result = await supabase.auth.signInAnonymously()
          if (result.error) throw result.error
          data = { session: result.data.session }
        }
        const user = data.session?.user
        if (!user) return

        let { data: onlineRooms, error: roomError } = await supabase.from('rooms').select('*').order('position', { ascending: true })
        if (roomError) throw roomError
        if (!onlineRooms?.length) {
          const seed = defaultRooms.map((room, index) => ({ user_id: user.id, name: room.name, note: room.note, position: index + 1 }))
          const created = await supabase.from('rooms').insert(seed).select('*').order('position')
          if (created.error) throw created.error
          onlineRooms = created.data || []
        }

        const { data: items, error } = await supabase.from('media_items').select('*').order('created_at', { ascending: false })
        if (error) throw error
        const { data: links, error: linkError } = await supabase.from('media_rooms').select('media_id,room_id')
        if (linkError) throw linkError
        const roomIdsByMedia = (links || []).reduce((acc, link) => {
          acc[link.media_id] = [...(acc[link.media_id] || []), link.room_id]
          return acc
        }, {})
        const hydrated = await Promise.all((items || []).map(async item => {
          const { data: signed } = await supabase.storage.from('audio-files').createSignedUrl(item.storage_path, 3600)
          return { ...item, room_ids: roomIdsByMedia[item.id] || [], play_url: signed?.signedUrl }
        }))
        if (mounted) {
          setRooms(onlineRooms || [])
          setMedia(hydrated)
          setOnlineReady(true)
          setMessage('')
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
    if (sleepIntervalRef.current) window.clearInterval(sleepIntervalRef.current)
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = new Date()
      const day = now.getDay()
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      setAlarms(current => current.map(alarm => {
        if (!alarm.enabled || alarm.time !== hhmm || !(alarm.days || []).includes(day)) return alarm
        const key = `${now.toDateString()}-${hhmm}`
        if (alarm.last_triggered === key) return alarm
        const track = media.find(item => item.id === alarm.media_id)
        if (track) selectTrack(track).then(() => {
          if (audioRef.current) {
            audioRef.current.volume = 0.08
            let step = 0
            const fade = window.setInterval(() => {
              step += 1
              if (!audioRef.current || step >= 20) return window.clearInterval(fade)
              audioRef.current.volume = Math.min(1, 0.08 + step * 0.046)
            }, 3000)
          }
        })
        setMessage(`Sveglia: ${alarm.name || 'È il momento di alzarsi'}`)
        return { ...alarm, last_triggered: key }
      }))
    }, 15000)
    return () => window.clearInterval(interval)
  }, [media])


  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !activeTrack?.play_url) return
    setProgress(0)
    setDuration(0)
    audio.pause()
    audio.src = activeTrack.play_url
    audio.load()
    setPlaying(false)
  }, [activeTrack?.id, activeTrack?.play_url])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !activeTrack?.play_url) return
    if (playing) audio.play().catch(() => setPlaying(false))
    else audio.pause()
  }, [playing])

  async function currentUser() {
    let { data } = await supabase.auth.getSession()
    if (!data.session) {
      const login = await supabase.auth.signInAnonymously()
      if (login.error) throw login.error
      data = { session: login.data.session }
    }
    const user = data.session?.user
    if (!user) throw new Error('Accesso anonimo Supabase non disponibile.')
    return user
  }

  async function selectTrack(item) {
    setMessage('')
    setPlaying(false)

    if (item.demo) {
      setActiveTrack(item)
      setMessage('Questo è un contenuto dimostrativo. Carica un file audio per ascoltarlo davvero.')
      return
    }

    try {
      let blob

      if (item.local) {
        blob = await getLocalAudio(item.id)
        if (!blob) throw new Error('Il file locale non è più disponibile. Ricaricalo nella Collezione.')
      } else if (supabaseConfigured && item.storage_path) {
        const { data, error } = await supabase.storage
          .from('audio-files')
          .download(item.storage_path)
        if (error) throw error
        blob = data
      } else {
        throw new Error('Percorso del file audio mancante.')
      }

      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error('Il file audio è vuoto o non è stato scaricato correttamente.')
      }

      const declaredType = item.mime_type || blob.type || ''
      if (declaredType && !declaredType.startsWith('audio/')) {
        throw new Error(`Formato non riconosciuto come audio (${declaredType}).`)
      }

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = URL.createObjectURL(blob)

      const playable = {
        ...item,
        play_url: objectUrlRef.current,
        downloaded_size: blob.size,
        downloaded_type: blob.type || item.mime_type || 'audio sconosciuto',
      }

      setActiveTrack(playable)

      const audio = audioRef.current
      if (!audio) throw new Error('Player audio non disponibile.')

      audio.pause()
      audio.src = playable.play_url
      audio.load()

      setMessage(`“${item.title}” è pronto. Premi Play nel player.`)
    } catch (error) {
      setActiveTrack(null)
      setPlaying(false)
      setMessage(`File non riproducibile: ${error?.message || 'errore sconosciuto'}`)
    }
  }

  async function togglePlayback() {
    const audio = audioRef.current
    if (!audio || !activeTrack) return

    try {
      if (audio.paused) {
        if (!activeTrack.play_url) throw new Error('Prima tocca il contenuto nella Collezione.')
        if (!audio.src) {
          audio.src = activeTrack.play_url
          audio.load()
        }

        const mime = activeTrack.downloaded_type || activeTrack.mime_type || ''
        if (mime && audio.canPlayType(mime) === '') {
          throw new Error(`Safari non supporta questo formato (${mime}). Prova un file MP3 o M4A senza protezione DRM.`)
        }

        await audio.play()
        setPlaying(true)
        setMessage('')
      } else {
        audio.pause()
        setPlaying(false)
      }
    } catch (error) {
      setPlaying(false)
      const mediaError = audio.error
      const detail = mediaError
        ? `codice ${mediaError.code}`
        : (error?.message || 'errore sconosciuto')
      setMessage(`Riproduzione non riuscita: ${detail}`)
    }
  }

  async function uploadMedia(event) {
    event.preventDefault()
    setMessage('')
    const form = new FormData(event.currentTarget)
    const file = form.get('file')
    const title = String(form.get('title') || '').trim()
    const author = String(form.get('author') || '').trim()
    const mediaType = String(form.get('media_type') || 'music')
    const roomIds = form.getAll('room_ids').map(String)

    if (!(file instanceof File) || file.size === 0) return setMessage('Scegli prima un file audio.')
    if (!title) return setMessage('Inserisci il titolo.')
    setUploading(true)

    try {
      if (!supabaseConfigured) {
        const id = `local-${crypto.randomUUID()}`
        await saveLocalAudio(id, file)
        const item = { id, title, author: author || 'Senza autore', media_type: mediaType, room_ids: roomIds, file_name: file.name, local: true, created_at: new Date().toISOString() }
        setMedia(current => [item, ...current.filter(x => !x.demo)])
        setShowUpload(false)
        event.currentTarget.reset()
        await selectTrack(item)
        return
      }

      const user = await currentUser()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${user.id}/${Date.now()}-${safeName}`
      const { error: storageError } = await supabase.storage.from('audio-files').upload(storagePath, file, { contentType: file.type || 'audio/mpeg' })
      if (storageError) throw storageError

      const record = { user_id: user.id, title, author: author || null, media_type: mediaType, storage_path: storagePath, file_name: file.name, mime_type: file.type, size_bytes: file.size }
      const { data: inserted, error: dbError } = await supabase.from('media_items').insert(record).select().single()
      if (dbError) throw dbError
      if (roomIds.length) {
        const { error: roomsError } = await supabase.from('media_rooms').insert(roomIds.map(roomId => ({ user_id: user.id, media_id: inserted.id, room_id: roomId })))
        if (roomsError) throw roomsError
      }
      const { data: signed } = await supabase.storage.from('audio-files').createSignedUrl(storagePath, 3600)
      const item = { ...inserted, room_ids: roomIds, play_url: signed?.signedUrl }
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

  async function saveRoom(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    const note = String(form.get('note') || '').trim()
    if (!name) return
    setSaving(true)
    try {
      if (!supabaseConfigured) {
        if (editingRoom) setRooms(current => current.map(room => room.id === editingRoom.id ? { ...room, name, note } : room))
        else setRooms(current => [...current, { id: crypto.randomUUID(), name, note: note || 'Il tuo spazio personale.', position: current.length + 1 }])
      } else {
        const user = await currentUser()
        if (editingRoom) {
          const { data, error } = await supabase.from('rooms').update({ name, note }).eq('id', editingRoom.id).select().single()
          if (error) throw error
          setRooms(current => current.map(room => room.id === editingRoom.id ? data : room))
        } else {
          const { data, error } = await supabase.from('rooms').insert({ user_id: user.id, name, note: note || 'Il tuo spazio personale.', position: rooms.length + 1 }).select().single()
          if (error) throw error
          setRooms(current => [...current, data])
        }
      }
      setShowRoom(false)
      setEditingRoom(null)
    } catch (error) { setMessage(error.message) } finally { setSaving(false) }
  }

  async function deleteRoom(room) {
    if (!confirm(`Eliminare la stanza “${room.name}”? I contenuti resteranno nella Collezione.`)) return
    try {
      if (supabaseConfigured && !String(room.id).startsWith('local-')) {
        const { error } = await supabase.from('rooms').delete().eq('id', room.id)
        if (error) throw error
      }
      setRooms(current => current.filter(item => item.id !== room.id))
      setMedia(current => current.map(item => ({ ...item, room_ids: (item.room_ids || []).filter(id => id !== room.id) })))
      setSelectedRoomId(null)
      setView('rooms')
    } catch (error) { setMessage(error.message) }
  }

  async function saveRoomContents(event) {
    event.preventDefault()
    if (!selectedRoom || saving) return

    const form = new FormData(event.currentTarget)
    const selectedMediaIds = form.getAll('media_ids').map(String)
    const roomId = String(selectedRoom.id)
    const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value))

    setSaving(true)
    setRoomContentsError('')

    try {
      // Scriviamo su Supabase solo per elementi realmente online. I contenuti locali
      // restano comunque assegnabili e vengono salvati nel localStorage.
      if (supabaseConfigured && onlineReady && isUuid(roomId)) {
        const user = await currentUser()
        const onlineItems = media.filter(item => !item.demo && !item.local && isUuid(item.id))
        const onlineIds = new Set(onlineItems.map(item => String(item.id)))
        const wantedIds = selectedMediaIds.filter(id => onlineIds.has(id))
        const previousIds = onlineItems
          .filter(item => (item.room_ids || []).map(String).includes(roomId))
          .map(item => String(item.id))

        const idsToRemove = previousIds.filter(id => !wantedIds.includes(id))
        const idsToAdd = wantedIds.filter(id => !previousIds.includes(id))

        if (idsToRemove.length) {
          const { error: removeError } = await supabase
            .from('media_rooms')
            .delete()
            .eq('user_id', user.id)
            .eq('room_id', roomId)
            .in('media_id', idsToRemove)
          if (removeError) throw removeError
        }

        if (idsToAdd.length) {
          const { error: addError } = await supabase
            .from('media_rooms')
            .upsert(
              idsToAdd.map(mediaId => ({ user_id: user.id, media_id: mediaId, room_id: roomId })),
              { onConflict: 'media_id,room_id', ignoreDuplicates: true },
            )
          if (addError) throw addError
        }
      }

      setMedia(current => current.map(item => {
        const currentRoomIds = (item.room_ids || []).map(String)
        const shouldBelong = selectedMediaIds.includes(String(item.id))
        return {
          ...item,
          room_ids: shouldBelong
            ? Array.from(new Set([...currentRoomIds, roomId]))
            : currentRoomIds.filter(id => id !== roomId),
        }
      }))
      setShowRoomContents(false)
      setMessage('Contenuti della Stanza salvati.')
    } catch (error) {
      const detail = error?.message || 'Salvataggio non riuscito.'
      setRoomContentsError(detail)
      setMessage(`Salvataggio non riuscito: ${detail}`)
    } finally {
      setSaving(false)
    }
  }


  async function saveMediaDetails(event) {
    event.preventDefault()
    if (!editingMedia || saving) return

    const form = new FormData(event.currentTarget)
    const roomIds = form.getAll('room_ids').map(String)
    const title = String(form.get('title') || '').trim() || editingMedia.title
    const author = String(form.get('author') || '').trim()
    const isLocalItem = Boolean(editingMedia.local) || String(editingMedia.id).startsWith('local-')

    setSaving(true)
    setMediaDetailsError('')

    try {
      if (supabaseConfigured && !editingMedia.demo && !isLocalItem) {
        const user = await currentUser()

        const { error: updateError } = await supabase
          .from('media_items')
          .update({ title, author: author || null })
          .eq('id', editingMedia.id)
          .eq('user_id', user.id)
        if (updateError) throw updateError

        const previousRoomIds = (editingMedia.room_ids || []).map(String)
        const roomIdsToRemove = previousRoomIds.filter(id => !roomIds.includes(id))
        const roomIdsToAdd = roomIds.filter(id => !previousRoomIds.includes(id))

        if (roomIdsToRemove.length) {
          const { error: deleteError } = await supabase
            .from('media_rooms')
            .delete()
            .eq('media_id', editingMedia.id)
            .eq('user_id', user.id)
            .in('room_id', roomIdsToRemove)
          if (deleteError) throw deleteError
        }

        if (roomIdsToAdd.length) {
          const { error: insertError } = await supabase
            .from('media_rooms')
            .upsert(
              roomIdsToAdd.map(roomId => ({ user_id: user.id, media_id: editingMedia.id, room_id: roomId })),
              { onConflict: 'media_id,room_id', ignoreDuplicates: true },
            )
          if (insertError) throw insertError
        }
      }

      setMedia(current => current.map(item =>
        item.id === editingMedia.id ? { ...item, title, author, room_ids: roomIds } : item
      ))
      setEditingMedia(null)
      setShowMediaDetails(false)
      setMessage(roomIds.length ? 'Collocazione salvata.' : 'Contenuto salvato senza Stanza.')
    } catch (error) {
      const detail = error?.message || 'Salvataggio non riuscito.'
      setMediaDetailsError(detail)
      setMessage(`Salvataggio non riuscito: ${detail}`)
    } finally {
      setSaving(false)
    }
  }

  function openMediaDetails(item) {
    setMediaDetailsError('')
    setEditingMedia(item)
    setShowMediaDetails(true)
  }

  function createAlarm(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const days = form.getAll('days').map(Number)
    const mediaId = String(form.get('media_id') || '')
    const time = String(form.get('time') || '')
    if (!time || !mediaId || !days.length) return setMessage('Scegli orario, giorni e melodia.')
    setAlarms(current => [...current, { id: crypto.randomUUID(), name: String(form.get('name') || '').trim() || 'Risveglio', time, days, media_id: mediaId, enabled: true }])
    event.currentTarget.reset()
    setMessage('Sveglia salvata. Per ora deve rimanere aperta nel browser.')
  }

  function toggleAlarm(id) { setAlarms(current => current.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a)) }
  function deleteAlarm(id) { setAlarms(current => current.filter(a => a.id !== id)) }

  async function startSleepTimer(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const mediaId = String(form.get('media_id') || '')
    const minutes = Number(form.get('minutes') || 30)
    const track = media.find(item => item.id === mediaId)
    if (!track) return setMessage('Scegli una voce o una melodia.')
    await selectTrack(track)
    const endAt = Date.now() + minutes * 60000
    setSleepTimer({ media_id: mediaId, endAt, minutes })
    if (sleepIntervalRef.current) window.clearInterval(sleepIntervalRef.current)
    sleepIntervalRef.current = window.setInterval(() => {
      const remaining = endAt - Date.now()
      if (audioRef.current && remaining <= 60000) audioRef.current.volume = Math.max(0, remaining / 60000)
      if (remaining <= 0) {
        window.clearInterval(sleepIntervalRef.current)
        sleepIntervalRef.current = null
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.volume = 1 }
        setPlaying(false)
        setSleepTimer(null)
        setMessage('Buonanotte.')
      }
    }, 1000)
    setMessage(`Timer sonno avviato per ${minutes} minuti.`)
  }

  function cancelSleepTimer() {
    if (sleepIntervalRef.current) window.clearInterval(sleepIntervalRef.current)
    sleepIntervalRef.current = null
    if (audioRef.current) audioRef.current.volume = 1
    setSleepTimer(null)
    setMessage('Timer sonno annullato.')
  }

  function createRitual(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    if (!name) return
    setRituals(current => [...current, {
      id: crypto.randomUUID(), name,
      timing: String(form.get('timing') || '').trim() || 'Quando ne senti il bisogno',
      duration: String(form.get('duration') || '').trim(),
      note: String(form.get('note') || '').trim() || 'Un momento personale da vivere con calma.',
    }])
    setShowRitual(false)
  }

  function openRoom(room) {
    setSelectedRoomId(room.id)
    setView('room')
  }

  function openUpload(roomId = null) {
    setUploadTargetRoomId(roomId)
    setShowUpload(true)
  }

  function goTo(nextView) {
    setView(nextView)
    setShowMenu(false)
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
      if (activeTrack?.id === item.id) { setPlaying(false); setActiveTrack(null) }
    } catch (error) { setMessage(error.message) }
  }

  const playableMedia = useMemo(() => media.filter(item => !item.demo), [media])

  async function playTrackByIndex(index) {
    if (!playableMedia.length) return
    const normalizedIndex = (index + playableMedia.length) % playableMedia.length
    await selectTrack(playableMedia[normalizedIndex])
  }

  async function playNext() {
    if (!playableMedia.length) return
    if (shuffleEnabled && playableMedia.length > 1) {
      const candidates = playableMedia.filter(item => item.id !== activeTrack?.id)
      await selectTrack(candidates[Math.floor(Math.random() * candidates.length)])
      return
    }
    const currentIndex = playableMedia.findIndex(item => item.id === activeTrack?.id)
    await playTrackByIndex(currentIndex < 0 ? 0 : currentIndex + 1)
  }

  async function playPrevious() {
    const audio = audioRef.current
    if (audio && audio.currentTime > 3) { audio.currentTime = 0; setProgress(0); return }
    const currentIndex = playableMedia.findIndex(item => item.id === activeTrack?.id)
    await playTrackByIndex(currentIndex < 0 ? playableMedia.length - 1 : currentIndex - 1)
  }

  async function handleTrackEnded() {
    if (repeatEnabled && audioRef.current) {
      audioRef.current.currentTime = 0
      setProgress(0)
      try { await audioRef.current.play(); setPlaying(true) } catch { setPlaying(false) }
      return
    }
    if (playableMedia.length > 1) await playNext()
    else setPlaying(false)
  }

  function seek(event) {
    const value = Number(event.target.value)
    if (!audioRef.current) return
    audioRef.current.currentTime = value
    setProgress(value)
  }

  const MediaList = ({ items, emptyText = 'Nessun contenuto' }) => <div className="mediaList">
    {items.length === 0 && <div className="emptyState"><Music2 /><strong>{emptyText}</strong><span>I contenuti della Collezione possono essere assegnati qui.</span></div>}
    {items.map((item, index) => <button className={`mediaItem ${activeTrack?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => openMediaDetails(item)}>
      <span className="cover">{String(index + 1).padStart(2, '0')}</span>
      <span className="mediaMeta"><strong>{item.title}</strong><small>{mediaLabels[item.media_type] || item.media_type}{item.author ? ` · ${item.author}` : ''}</small>
        {(item.room_ids || []).length === 0 ? <span className="unassigned">Da assegnare a una Stanza</span> : <span className="roomTags">{(item.room_ids || []).map(roomId => { const room = rooms.find(r => r.id === roomId); return room ? <span key={roomId} role="button" tabIndex="0" onClick={e => { e.stopPropagation(); openRoom(room) }}>{room.name}</span> : null })}</span>}
      </span>
      <span className="itemActions">{!item.demo && <span role="button" tabIndex="0" className="deleteButton" onClick={e => removeMedia(e, item)} aria-label="Elimina"><Trash2 size={16} /></span>}<span role="button" tabIndex="0" onClick={e => { e.stopPropagation(); selectTrack(item) }}><Play size={18} fill="currentColor" /></span></span>
    </button>)}
  </div>

  return (
    <div className="shell">
      <audio
        ref={audioRef}
        preload="metadata"
        playsInline
        onEnded={handleTrackEnded}
        onTimeUpdate={e => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => {
          const code = audioRef.current?.error?.code
          setPlaying(false)
          setMessage(`Errore audio${code ? ` (${code})` : ''}. Tocca nuovamente il brano per rigenerare il collegamento.`)
        }}
      />
      <header className="topbar"><Brand /><button className="iconButton" aria-label="Apri menu" onClick={() => setShowMenu(true)}><Menu size={21} strokeWidth={1.6} /></button></header>

      <main>
        {view === 'home' && <section className="hero"><div className="overlay" /><div className="heroContent"><p className="eyebrow">Questo momento è per te.</p><h1>Come vuoi stare?</h1><p className="heroLead">Non conserviamo file. Custodiamo momenti.</p><div className="actions"><button className="primary" onClick={() => setView('rooms')}>Scegli una stanza</button><button className="secondary" onClick={() => setView('library')}>La Collezione</button></div></div></section>}

        {view === 'rooms' && <section className="page"><div className="pageHead"><div><p className="eyebrow">I TUOI LUOGHI</p><h2>Stanze</h2></div><button className="addButton" onClick={() => { setEditingRoom(null); setShowRoom(true) }}><Plus size={27} /></button></div><div className="roomGrid">{rooms.map((room, index) => <button className={`roomCard room${(index % 4) + 1}`} key={room.id} onClick={() => openRoom(room)}><span>STANZA {String(index + 1).padStart(2, '0')} · {roomCounts[room.id] || 0} CONTENUTI</span><strong>{room.name}</strong><p>{room.note}</p><ChevronRight size={20} /></button>)}</div></section>}

        {view === 'room' && selectedRoom && <section className="page roomDetail"><button className="backLink" onClick={() => setView('rooms')}><ArrowLeft size={18} /> Tutte le stanze</button><div className="pageHead"><div><p className="eyebrow">IL TUO LUOGO</p><h2>{selectedRoom.name}</h2><p className="roomDescription">{selectedRoom.note}</p></div><button className="addButton" onClick={() => openUpload(selectedRoom.id)}><Plus size={27} /></button></div><div className="roomToolbar"><button className="secondary" onClick={() => { setRoomContentsError(''); setShowRoomContents(true) }}><Link2 size={17} /> Aggiungi dalla Collezione</button><button className="ghostButton" onClick={() => { setEditingRoom(selectedRoom); setShowRoom(true) }}><Pencil size={16} /> Modifica</button><button className="ghostButton danger" onClick={() => deleteRoom(selectedRoom)}><Trash2 size={16} /> Elimina</button></div>{message && <div className="pageMessage">{message}</div>}<MediaList items={roomMedia} emptyText="Questa stanza è ancora vuota" /></section>}

        {view === 'rituals' && <section className="page"><div className="pageHead"><div><p className="eyebrow">TEMPO PER TE</p><h2>Rituali</h2></div><button className="addButton" onClick={() => setShowRitual(true)}><Plus size={27} /></button></div>{rituals.map((ritual, index) => <article className="ritualCard" key={ritual.id}>{index % 2 === 0 ? <Wind /> : <TimerReset />}<div><strong>{ritual.name}</strong><span>{ritual.timing}{ritual.duration ? ` · ${ritual.duration}` : ''}</span><p>{ritual.note}</p></div></article>)}</section>}

        {view === 'sleep' && <section className="page"><div className="pageHead"><div><p className="eyebrow">NOTTE E RISVEGLIO</p><h2>Sonno e Sveglie</h2></div><Moon size={30} /></div>{message && <div className="pageMessage">{message}</div>}<div className="sleepGrid"><form className="wellnessCard" onSubmit={startSleepTimer}><Moon size={24} /><h3>Addormentati con calma</h3><p>Scegli una voce, una meditazione o una musica. Il volume diminuirà nell'ultimo minuto.</p><label>Ascolto<select name="media_id" required defaultValue=""><option value="" disabled>Scegli dalla Collezione</option>{media.filter(i => !i.demo).map(i => <option key={i.id} value={i.id}>{i.title}</option>)}</select></label><label>Durata<select name="minutes" defaultValue="30"><option value="15">15 minuti</option><option value="30">30 minuti</option><option value="45">45 minuti</option><option value="60">60 minuti</option><option value="90">90 minuti</option></select></label>{sleepTimer ? <button type="button" className="secondary submit" onClick={cancelSleepTimer}>Annulla timer</button> : <button className="primary submit" type="submit">Avvia il sonno</button>}</form><form className="wellnessCard" onSubmit={createAlarm}><AlarmClock size={24} /><h3>Svegliati come preferisci</h3><p>Yoga, una melodia dolce oppure l'alzabandiera: scegli tu il primo suono della giornata.</p><label>Nome<input name="name" placeholder="Risveglio del mattino" /></label><label>Ora<input name="time" type="time" required /></label><label>Melodia<select name="media_id" required defaultValue=""><option value="" disabled>Scegli dalla Collezione</option>{media.filter(i => !i.demo).map(i => <option key={i.id} value={i.id}>{i.title}</option>)}</select></label><fieldset className="dayChoices"><legend>Giorni</legend>{[['D',0],['L',1],['M',2],['M',3],['G',4],['V',5],['S',6]].map(([d,v]) => <label key={v}><input type="checkbox" name="days" value={v} /><span>{d}</span></label>)}</fieldset><button className="primary submit" type="submit">Salva sveglia</button></form></div><div className="alarmList">{alarms.map(alarm => { const track=media.find(i=>i.id===alarm.media_id); return <article className="alarmCard" key={alarm.id}><button className={`alarmToggle ${alarm.enabled?'on':''}`} onClick={()=>toggleAlarm(alarm.id)}><AlarmClock size={18}/></button><div><strong>{alarm.time} · {alarm.name}</strong><span>{track?.title || 'Contenuto non disponibile'}</span></div><button className="deleteButton" onClick={()=>deleteAlarm(alarm.id)}><Trash2 size={16}/></button></article>})}</div><p className="technicalNote">Nota: nella versione web la sveglia è affidabile solo se FormaMentis resta aperta. La versione app userà notifiche locali anche a schermo bloccato.</p></section>}

        {view === 'library' && <section className="page"><div className="pageHead"><div><p className="eyebrow">MUSICA E PAROLE</p><h2>La Collezione</h2></div><button className="addButton" onClick={() => openUpload()}><Plus size={27} /></button></div><button className="uploadHint" onClick={() => openUpload()}><Upload size={21} /><div><strong>Aggiungi un nuovo ascolto</strong><span>Musica, audiolibri, podcast o meditazioni</span></div><ChevronRight size={20} /></button>{message && <div className="pageMessage">{message}</div>}<MediaList items={media} emptyText="La Collezione è vuota" /></section>}
      </main>

      {showMenu && <div className="menuBackdrop" onMouseDown={() => setShowMenu(false)}><aside className="sideMenu" onMouseDown={e => e.stopPropagation()}><div className="menuHead"><Brand /><button className="closeButton menuClose" onClick={() => setShowMenu(false)}><X size={20} /></button></div><p className="menuIntro">Il tuo spazio personale.</p><nav className="menuLinks"><button onClick={() => goTo('home')}><Home size={20} /><span>Benvenuto</span><ChevronRight size={18} /></button><button onClick={() => goTo('rooms')}><Headphones size={20} /><span>Stanze</span><ChevronRight size={18} /></button><button onClick={() => goTo('rituals')}><TimerReset size={20} /><span>Rituali</span><ChevronRight size={18} /></button><button onClick={() => goTo('sleep')}><AlarmClock size={20} /><span>Sonno e Sveglie</span><ChevronRight size={18} /></button><button onClick={() => goTo('library')}><Library size={20} /><span>La Collezione</span><ChevronRight size={18} /></button></nav></aside></div>}

      {activeTrack && <aside className="player"><div className="playerTop"><div className="playerIcon"><Music2 size={18} /></div><div className="playerText"><strong>{activeTrack.title}</strong><span>{activeTrack.author || mediaLabels[activeTrack.media_type]}</span></div><button className="mainPlay" onClick={togglePlayback}>{playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button></div><div className="timeline"><span>{formatTime(progress)}</span><input type="range" min="0" max={duration || 0} value={Math.min(progress, duration || 0)} onChange={seek} /><span>{formatTime(duration)}</span></div><div className="playerControls"><button className={shuffleEnabled ? 'active' : ''} onClick={() => setShuffleEnabled(v => !v)}><Shuffle size={17} /></button><button onClick={playPrevious}><SkipBack size={19} fill="currentColor" /></button><button className="controlPlay" onClick={togglePlayback}>{playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button><button onClick={playNext}><SkipForward size={19} fill="currentColor" /></button><button className={repeatEnabled ? 'active' : ''} onClick={() => setRepeatEnabled(v => !v)}><Repeat2 size={17} /></button></div></aside>}

      <nav className="bottomNav"><button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}><Home size={20} /><span>Benvenuto</span></button><button className={view === 'rooms' || view === 'room' ? 'active' : ''} onClick={() => setView('rooms')}><Headphones size={20} /><span>Stanze</span></button><button className={view === 'rituals' || view === 'sleep' ? 'active' : ''} onClick={() => setView('sleep')}><AlarmClock size={20} /><span>Sveglie</span></button><button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}><Library size={20} /><span>Collezione</span></button></nav>

      {showMediaDetails && editingMedia && <div className="modalBackdrop" onMouseDown={() => !saving && setShowMediaDetails(false)}><form className="modal" onSubmit={saveMediaDetails} onMouseDown={e => e.stopPropagation()}><button className="closeButton" type="button" disabled={saving} onClick={() => setShowMediaDetails(false)}><X size={20} /></button><p className="eyebrow">ORGANIZZA IL CONTENUTO</p><h2>{editingMedia.title}</h2><p className="modalIntro">Scegli in quali Stanze deve comparire. Il file resta unico nella Collezione.</p><label>Titolo<input name="title" defaultValue={editingMedia.title} /></label><label>Autore<input name="author" defaultValue={editingMedia.author || ''} /></label><fieldset className="roomChoices"><legend>Colloca nelle Stanze</legend>{rooms.map(room => <label key={room.id}><input type="checkbox" name="room_ids" value={room.id} defaultChecked={(editingMedia.room_ids || []).map(String).includes(String(room.id))} /><span>{room.name}</span></label>)}</fieldset>{mediaDetailsError && <div className="formError" role="alert"><strong>Non riesco a salvare.</strong><span>{mediaDetailsError}</span></div>}<button className="secondary submit" type="button" disabled={saving} onClick={() => selectTrack(editingMedia)}><Volume2 size={18}/> Ascolta</button><button className="primary submit" type="submit" disabled={saving}>{saving ? 'Salvataggio…' : 'Salva collocazione'}</button></form></div>}

      {showUpload && <div className="modalBackdrop" onMouseDown={() => setShowUpload(false)}><form className="modal" onSubmit={uploadMedia} onMouseDown={e => e.stopPropagation()}><button className="closeButton" type="button" onClick={() => setShowUpload(false)}><X size={20} /></button><p className="eyebrow">NUOVO ASCOLTO</p><h2>Aggiungi</h2><p className="modalIntro">Scegli ciò che questo contenuto rappresenta per te.</p><label>Tipo<select name="media_type" defaultValue="music"><option value="music">Musica</option><option value="audiobook">Audiolibro</option><option value="podcast">Podcast</option><option value="meditation">Meditazione</option></select></label><label>Titolo<input name="title" required /></label><label>Autore<input name="author" placeholder="Facoltativo" /></label><fieldset className="roomChoices"><legend>Stanze</legend>{rooms.map(room => <label key={room.id}><input type="checkbox" name="room_ids" value={room.id} defaultChecked={room.id === uploadTargetRoomId} /><span>{room.name}</span></label>)}</fieldset><label className="fileField">File audio<input name="file" type="file" accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.flac" required /></label>{message && <div className="message">{message}</div>}<button className="primary submit" type="submit" disabled={uploading}>{uploading ? <><LoaderCircle className="spin" size={19} /> Caricamento...</> : 'Carica e ascolta'}</button><small className="localNotice">{supabaseConfigured ? (onlineReady ? 'Archivio online collegato.' : 'Collegamento Supabase in corso…') : 'Modalità locale persistente.'}</small></form></div>}

      {showRoom && <div className="modalBackdrop" onMouseDown={() => setShowRoom(false)}><form className="modal" onSubmit={saveRoom} onMouseDown={e => e.stopPropagation()}><button className="closeButton" type="button" onClick={() => setShowRoom(false)}><X size={20} /></button><p className="eyebrow">{editingRoom ? 'MODIFICA LUOGO' : 'NUOVO LUOGO'}</p><h2>{editingRoom ? 'Modifica stanza' : 'Crea una stanza'}</h2><label>Nome<input name="name" defaultValue={editingRoom?.name || ''} required /></label><label>Significato<input name="note" defaultValue={editingRoom?.note || ''} /></label><button className="primary submit" type="submit" disabled={saving}>{saving ? 'Salvataggio…' : editingRoom ? 'Salva modifiche' : 'Crea la stanza'}</button></form></div>}

      {showRoomContents && selectedRoom && <div className="modalBackdrop" onMouseDown={() => !saving && setShowRoomContents(false)}><form className="modal" onSubmit={saveRoomContents} onMouseDown={e => e.stopPropagation()}><button className="closeButton" type="button" disabled={saving} onClick={() => setShowRoomContents(false)}><X size={20} /></button><p className="eyebrow">CONTENUTI DELLA STANZA</p><h2>{selectedRoom.name}</h2><p className="modalIntro">Scegli quali contenuti della Collezione devono vivere in questa stanza.</p><div className="assignmentList">{media.filter(item => !item.demo).map(item => <label key={item.id}><input type="checkbox" name="media_ids" value={item.id} defaultChecked={(item.room_ids || []).map(String).includes(String(selectedRoom.id))} /><span><strong>{item.title}</strong><small>{mediaLabels[item.media_type] || item.media_type}</small></span></label>)}</div>{roomContentsError && <div className="formError" role="alert"><strong>Non riesco a salvare.</strong><span>{roomContentsError}</span></div>}<button className="primary submit" type="submit" disabled={saving}>{saving ? 'Salvataggio…' : 'Salva contenuti'}</button></form></div>}

      {showRitual && <div className="modalBackdrop" onMouseDown={() => setShowRitual(false)}><form className="modal" onSubmit={createRitual} onMouseDown={e => e.stopPropagation()}><button className="closeButton" type="button" onClick={() => setShowRitual(false)}><X size={20} /></button><p className="eyebrow">NUOVO RITUALE</p><h2>Crea un rituale</h2><label>Nome<input name="name" required /></label><label>Quando<input name="timing" /></label><label>Durata<input name="duration" /></label><label>Significato<input name="note" /></label><button className="primary submit" type="submit">Crea il rituale</button></form></div>}
    </div>
  )
}
