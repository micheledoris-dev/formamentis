# FormaMentis — Release 0.3.1

Prima beta realmente utilizzabile.

## Funzioni

- nuovo ingresso: **Come vuoi stare?**
- creazione libera delle Stanze
- caricamento di MP3, M4A, WAV, AAC, OGG e FLAC
- salvataggio locale persistente con IndexedDB, anche senza Supabase
- Collezione con eliminazione dei contenuti
- player con play/pausa, avanzamento e durata
- collegamento Supabase con accesso anonimo automatico
- caricamento online, recupero automatico e URL firmati

## Avvio locale

```bash
npm install
npm run dev
```

## Pubblicazione Netlify

- Build command: `npm run build`
- Publish directory: `dist`

## Supabase opzionale

1. Eseguire `supabase/setup.sql` nel SQL Editor.
2. In Supabase aprire **Authentication → Providers → Anonymous** e attivare gli accessi anonimi.
3. In Netlify aggiungere:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Eseguire un nuovo deploy.

Senza Supabase l'app funziona comunque e conserva i file nel browser del dispositivo.
