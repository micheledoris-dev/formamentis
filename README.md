# FormaMentis — Beta 02

Questa versione aggiunge:

- marchio `formamentis`
- sezione **Ascolta**
- pulsante **+**
- caricamento di musica, audiolibri, podcast e meditazioni
- selezione della stanza
- anteprima locale immediata
- collegamento predisposto a Supabase Storage

## Avvio

```bash
npm install
npm run dev
```

## Netlify

- Build command: `npm run build`
- Publish directory: `dist`

## Variabili Netlify / Supabase

Aggiungere in Netlify:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Supabase

Eseguire il file:

`supabase/setup.sql`

Il bucket si chiama:

`audio-files`
