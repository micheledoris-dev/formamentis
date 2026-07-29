# FormaMentis — Release 0.4

Release completa per GitHub + Netlify + Supabase.

## Funzioni

- landing ufficiale FormaMentis
- Stanze e Rituali
- caricamento di MP3, M4A, WAV, AAC, OGG e FLAC
- salvataggio locale se Supabase non è disponibile
- salvataggio online su Supabase Storage
- archivio `media_items` con Row Level Security
- riproduzione ed eliminazione dei contenuti
- compatibilità con `VITE_SUPABASE_ANON_KEY` e `VITE_SUPABASE_PUBLISHABLE_KEY`
- controllo delle variabili per evitare la pagina nera

## Pubblicazione

Estrarre lo ZIP e caricare su GitHub tutto il contenuto della cartella, sostituendo i file esistenti. Netlify avvierà automaticamente il deploy.

## Configurazione Supabase

1. In Authentication > Sign In / Providers attivare **Allow anonymous sign-ins**.
2. Aprire SQL Editor.
3. Copiare ed eseguire `supabase/setup.sql`.
4. Su Netlify conservare:
   - `VITE_SUPABASE_URL` = solo URL `https://...supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = solo chiave `sb_publishable_...`

Non inserire mai la Secret key nel progetto o su GitHub.
