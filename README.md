# FormaMentis 0.6.0

Release con Collezione organizzabile, timer sonno e sveglie web.

## Pubblicazione
Caricare tutti i file nel repository GitHub collegato a Netlify. Non è necessario rieseguire SQL per usare le nuove funzioni locali di sonno e sveglia.

## Limite sveglia web
La pagina deve restare aperta. Una futura app nativa/ibrida potrà usare notifiche locali con schermo bloccato.


## Correzione 0.6.3

- rigenerazione del link audio Supabase a ogni tocco;
- riproduzione avviata direttamente dal gesto dell'utente, compatibile con Safari/iPhone;
- messaggi di errore audio visibili;
- sincronizzazione dello stato Play/Pausa con il player reale.


## Correzione 0.6.4 — riproduzione affidabile

- il file viene scaricato da Supabase Storage come Blob;
- il player usa un URL locale del browser;
- il primo tocco prepara il file;
- il secondo tocco sul Play avvia l'audio direttamente, compatibile con Safari;
- vengono controllati dimensione, MIME type e compatibilità del formato;
- gli errori di riproduzione sono mostrati nell'interfaccia.
