# Panoramica Architetturale

Italiano | [English](./ARCHITECTURE.md)

## Modello di prodotto

Fattura Vault separa la gestione documentale in tre fasi principali:

1. Inbox
2. Vault
3. Servizi AI e dashboard

Questo mantiene la lavorazione temporanea separata dallo stato finale di archiviazione.

## Componenti principali

### `vault_inbox`

Area temporanea dei documenti.

Responsabilita`:

- ricevere i file caricati
- mantenere i documenti disponibili tra dispositivi mentre vengono revisionati
- supportare generazione preview e metadati di analisi
- conservare i dati di prefill AI prima dell'archiviazione finale

### `vault_backend`

Metadati applicativi e logica business.

Responsabilita`:

- metadati documento
- categorie
- note e post-it
- aggregati dashboard
- suggerimenti intelligenti
- riepiloghi e chat AI del Vault
- stato notifiche
- quote e limiti utente

### `vault_storage`

Storage dei blob cifrati.

Responsabilita`:

- creare blob
- caricare chunk
- finalizzare blob
- scaricare bytes cifrati
- eliminare blob salvati

### `vault_analytics`

Raccolta eventi analytics e metriche correlate.

## Ruolo del frontend

Il frontend e` responsabile di:

- gestione sessione Internet Identity
- cifratura e decifratura lato client
- preparazione preview file
- orchestrazione dei flussi Inbox e Vault
- invocazione del prefill AI con chiave OpenAI fornita dall'utente

Conseguenza importante:

- il frontend e` una parte critica del modello di sicurezza documentale e dell'esperienza utente

## Separazione AI

Il progetto usa intenzionalmente due percorsi AI diversi.

### Prefill documenti

- chiave OpenAI fornita dall'utente
- opzionale
- usato per leggere documenti e precompilare i campi del form

### AI del Vault

- LLM on-chain
- usato per riepiloghi, suggerimenti e chat sui dati strutturati del Vault
- non sostituisce la verifica documentale da parte dell'utente

## Modello di storage

Flusso attuale dello storage finale:

- il file viene cifrato lato client
- i metadati vengono salvati in `vault_backend`
- i blob cifrati vengono salvati in `vault_storage`

Il modello attuale e` ICP-native. Una futura evoluzione dello storage dovrebbe preservare la separazione tra:

- metadati
- blob cifrati
- elaborazione temporanea inbox

## Principio di design

Il prodotto dovrebbe mantenere la logica business il piu` possibile indipendente dalla gestione dei blob.

Questo e` importante sia per la manutenibilita` sia per un'eventuale evoluzione futura del layer storage.
