# Inbox AI Temporanea

## Obiettivo

Separare in modo netto:

- `Inbox`: area temporanea di acquisizione, visibile da tutti i dispositivi dello stesso utente e utilizzabile dall'AI
- `Vault`: archivio finale, cifrato lato client e pensato per la conservazione privata di lungo periodo

Questa separazione riduce la complessita` del flusso mobile/desktop e rende naturale l'integrazione futura con OCR e LLM.

## Problema del modello attuale

Oggi l'`Inbox` prova a comportarsi gia` come un mini-vault:

- upload file
- cifratura client-side quasi immediata
- blob su storage
- preview da ricostruire
- sync cross-device

Questo crea frizione in un punto che dovrebbe essere semplice:

- carico un file
- lo ritrovo ovunque
- lo apro
- lo verifico
- poi decido se archiviarlo

In piu`, un LLM non puo` lavorare in modo semplice su file gia` cifrati lato client.

## Nuovo modello proposto

### 1. Inbox temporanea

L'`Inbox` diventa uno spazio di lavorazione temporaneo.

Caratteristiche:

- file accessibili da mobile e desktop con lo stesso principal
- anteprime disponibili subito
- AI/OCR possono leggere il contenuto
- stato del documento pensato per lavorazione e verifica
- nessuna cifratura end-to-end in questa fase

L'Inbox non e` il vault.

E` il tavolo di lavoro.

### 2. Vault finale

Il `Vault` resta lo spazio definitivo e cifrato.

Caratteristiche:

- cifratura lato client
- blob cifrati in `vault_storage`
- metadata in `vault_backend`
- accesso finale solo tramite il modello chiavi scelto per il vault

## Architettura proposta

### Canister 1: `vault_inbox`

Responsabilita`:

- file temporanei non archiviati
- preview immagini/PDF
- testo OCR
- stato AI
- coda analisi
- cleanup automatico dei file vecchi

Dati principali:

- `inbox_document`
- `preview_blob`
- `ocr_text`
- `ai_status`
- `extracted_fields`
- `created_at`
- `expires_at`

### Canister 2: `vault_backend`

Responsabilita`:

- profilo utente
- sicurezza
- categorie
- note
- post-it
- metadata dei documenti archiviati
- attivita`

### Canister 3: `vault_storage`

Responsabilita`:

- blob cifrati finali
- upload chunked
- download blob archiviati
- preview cifrate archiviate

## Flusso utente

### Fase 1. Upload

L'utente carica un file da mobile o desktop.

Il file:

- va in `vault_inbox`
- viene registrato subito come documento inbox
- genera preview
- e` visibile da tutti i dispositivi dello stesso utente

Risultato atteso:

- carico da mobile
- apro da desktop
- vedo lo stesso file

### Fase 2. Analisi AI

L'AI/OCR lavora sul file in inbox.

Possibili output:

- tipo documento suggerito
- categoria suggerita
- tag suggeriti
- campi fattura estratti
- date rilevanti
- importi
- fornitore / merchant

Stato possibile:

- `uploaded`
- `processing`
- `ready_for_review`
- `error`

### Fase 3. Verifica utente

L'utente apre il documento inbox, controlla i dati e li modifica se serve.

### Fase 4. Salva e archivia

Quando l'utente clicca `Salva e archivia`:

1. il frontend genera o sblocca la chiave del vault
2. il file viene cifrato lato client
3. il blob cifrato va in `vault_storage`
4. i metadata finali vanno in `vault_backend`
5. il record temporaneo viene eliminato da `vault_inbox`

Risultato:

- il file non vive piu` nell'inbox
- entra nel vault finale
- resta leggibile secondo il modello di sicurezza finale

## Vantaggi

### UX piu` semplice

- inbox immediata
- sync cross-device naturale
- preview semplice
- niente complessita` crittografica nella fase di sola acquisizione

### AI naturale

- OCR e LLM leggono il file senza workaround
- categorizzazione e precompilazione diventano dirette

### Vault piu` pulito

- la cifratura resta concentrata dove serve davvero
- cioe` nella fase di archiviazione

### Meno attrito mobile/desktop

- il problema "file caricato qui ma non visibile la`" si riduce molto
- i dispositivi leggono una stessa inbox temporanea centralizzata

## Compromesso privacy

Questa architettura introduce una distinzione importante:

- `Inbox`: non end-to-end privata
- `Vault`: cifrato lato client

Quindi il messaggio da dare all'utente deve essere chiaro:

- i file nell'inbox sono documenti temporanei in lavorazione
- i file archiviati nel vault sono quelli protetti dal modello di cifratura finale

Formulazione consigliata:

`I documenti caricati in Inbox vengono usati per anteprima, analisi e preparazione all'archiviazione. Quando li archivi, vengono cifrati e spostati nel tuo Vault.`

## Regole di prodotto consigliate

### Pulizia automatica inbox

I documenti rimasti in inbox troppo a lungo non devono restare li` per sempre.

Proposta:

- cleanup automatico dopo 30 giorni
- reminder utente prima della cancellazione

### Stato visibile

Ogni file inbox deve mostrare chiaramente:

- caricato
- in analisi
- pronto per verifica
- errore

### Archiviazione esplicita

L'ingresso nel vault deve restare una scelta esplicita dell'utente.

## Cosa cambia nel frontend

Lato UI il concetto resta familiare:

- `Inbox` continua a essere il posto dove butti i file
- `Documento` continua a essere il form di verifica
- `Vault` continua a essere l'archivio finale

Ma sotto cambia la logica:

- `Inbox` legge da `vault_inbox`
- `Vault` legge da `vault_backend + vault_storage`

## Cosa cambia nella sicurezza

La chiave del vault serve solo per i documenti archiviati.

Quindi il modello sicurezza finale puo` essere deciso senza bloccare l'Inbox.

Questo aiuta molto anche il progetto:

- prima rendiamo l'Inbox semplice, robusta e AI-ready
- poi chiudiamo bene il modello chiavi del Vault

## Ordine di implementazione consigliato

### Blocco 1. Specifica e tipi

- definire tipi `vault_inbox`
- definire stati documento inbox
- definire regole di retention

### Blocco 2. Canister `vault_inbox`

- upload file inbox
- list documenti inbox
- preview
- delete inbox document
- mark processing state

### Blocco 3. Frontend Inbox

- collegare `Inbox` al nuovo canister
- togliere la cifratura dalla fase inbox
- sistemare preview e cross-device con logica centralizzata

### Blocco 4. AI/OCR

- introdurre testo estratto
- introdurre suggerimenti AI
- precompilare il form documento

### Blocco 5. Archiviazione finale

- cifratura lato client al click `Salva e archivia`
- blob su `vault_storage`
- metadata su `vault_backend`
- delete da `vault_inbox`

## Decisione consigliata

Per il prodotto, questa e` la direzione consigliata:

- `Inbox` temporanea e AI-ready
- `Vault` cifrato e definitivo

Questa separazione e` piu` semplice da spiegare, piu` coerente con l'uso reale e piu` adatta all'integrazione futura con LLM.
