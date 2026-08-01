# FormaMentis 0.6.5

## Messaggi e qualità

- Uniformati tutti i messaggi dell'app in italiano.
- Rimossi i testi tecnici grezzi restituiti da Supabase.
- Aggiunte spiegazioni semplici per errori di database, permessi, rete, Storage e audio.

# FormaMentis 0.6.4

## Riproduzione audio

- Sostituiti i link firmati con il download autenticato del file da Supabase Storage.
- Creato un Blob locale prima della riproduzione.
- Separata la preparazione del file dal comando Play per rispettare i limiti di Safari/iPhone.
- Aggiunti controlli su dimensione, MIME type e supporto del browser.
- Migliorati i messaggi diagnostici.

# FormaMentis 0.6.3

## Correzioni

- Corretto il mancato avvio dei brani su Safari, iPhone, Mac e browser mobili.
- Il link firmato Supabase viene rigenerato quando si tocca un contenuto.
- `audio.play()` viene chiamato direttamente durante il clic dell'utente.
- Aggiunti messaggi di errore del player.
- Il pulsante Play/Pausa ora segue lo stato reale dell'elemento audio.

# FormaMentis 0.6.2

- Corretto il salvataggio dei contenuti dalla finestra di una Stanza.
- Gestione separata dei contenuti online e locali.
- Aggiornamento differenziale delle associazioni senza cancellazioni preventive.
- Errori di Supabase mostrati direttamente nella finestra.
- Conferma visibile dopo il salvataggio.

# Changelog

## 0.6.1
- Corretto il salvataggio della collocazione dei contenuti nelle Stanze.
- Gestiti correttamente anche i contenuti locali creati prima del collegamento a Supabase.
- Aggiunto un messaggio di errore visibile dentro la finestra di organizzazione.
- Salvataggio dei collegamenti differenziale, senza cancellazioni inutili.

## 0.6.0
- Organizzazione contenuti nelle Stanze.
- Timer sonno e sveglie web.
