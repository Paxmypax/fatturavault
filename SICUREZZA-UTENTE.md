# Sicurezza Utente

## Obiettivo

Fattura Vault deve proteggere i documenti degli utenti con un modello semplice e molto chiaro:

- i file vengono cifrati prima del salvataggio
- l'accesso ai file dipende dall'identita` Internet Identity dell'utente
- il team di Fattura Vault non deve poter leggere i documenti in chiaro
- non deve esistere un recupero amministrativo dei file da parte nostra

## Principio di base

Il prodotto assume questo modello:

- un utente autenticato con Internet Identity puo` accedere ai propri file cifrati
- un utente che perde definitivamente l'accesso alla propria Internet Identity perde anche la possibilita` di decifrare i file

Quindi:

- noi non possiamo recuperare i file
- DFINITY non puo` recuperare i file per conto dell'utente
- il recupero dipende solo dai metodi di accesso e di recovery gia` configurati dentro Internet Identity

## Rischio principale

Il rischio reale non e` Internet Identity in se`, ma il comportamento dell'utente:

- registra un solo dispositivo
- non salva la recovery phrase
- perde o rompe quel dispositivo

In questo scenario l'utente puo` perdere l'accesso definitivo ai documenti.

## Decisione di prodotto

Per mitigare questo rischio, Fattura Vault adotta tre misure UX obbligatorie o fortemente visibili.

### 1. Onboarding

Prima di poter caricare file, l'utente deve confermare esplicitamente:

- `Ho salvato la mia recovery phrase`

Questo controllo non prova tecnicamente che l'utente lo abbia fatto davvero, ma serve a:

- portare il rischio in primo piano
- ridurre gli utenti che ignorano il problema
- chiarire subito che il recupero non dipende da noi

### 2. Dashboard

La dashboard deve mostrare un banner sicurezza persistente finche` l'utente non completa la checklist di sicurezza.

Messaggio guida:

- aggiungi un dispositivo di backup
- verifica di aver salvato la recovery phrase

Il banner non deve dichiarare informazioni che la dapp non conosce con certezza, per esempio:

- `hai un solo dispositivo registrato`

Questa affermazione non e` affidabile se non abbiamo una fonte tecnica reale da Internet Identity.

### 3. Impostazioni > Sicurezza

Deve esistere una sezione dedicata alla sicurezza account con:

- spiegazione del modello di accesso
- stato checklist sicurezza
- invito ad aggiungere un dispositivo di backup
- link diretto a Internet Identity per gestire dispositivi e recovery phrase

## Cosa la dapp puo` sapere

La dapp puo` sapere:

- se l'utente e` autenticato
- il principal dell'utente
- eventuali conferme manuali salvate nel profilo dell'utente

La dapp non puo` assumere automaticamente:

- il numero reale di dispositivi registrati in Internet Identity
- se la recovery phrase e` stata davvero salvata
- se l'utente ha un backup funzionante

Per questo motivo la UX sicurezza sara` una checklist guidata, non una verifica tecnica completa dello stato di Internet Identity.

## Copy prodotto da mantenere chiaro

I messaggi verso l'utente devono essere molto espliciti.

Concetti da comunicare:

- i tuoi documenti sono protetti dal tuo accesso Internet Identity
- se perdi accesso a Internet Identity e non hai recovery, perdi anche l'accesso ai documenti
- Fattura Vault non puo` recuperare i tuoi file per te

Tono richiesto:

- chiaro
- serio
- non allarmista
- senza ambiguita`

## Implicazioni tecniche

Quando implementeremo il backend ICP, questa specifica implica:

- cifratura lato client prima del salvataggio
- blob salvati nel backend solo in forma cifrata
- niente reset password classico
- niente recupero documenti lato supporto
- profilo utente con stato checklist sicurezza

## Campi da salvare nel profilo utente

Il profilo utente dovra` includere almeno:

- `display_name`
- `security_ack_recovery_phrase: bool`
- `security_ack_backup_device: bool`
- `security_ack_last_reviewed_at: timestamp`

Questi campi rappresentano conferme utente, non prove tecniche.

## Flusso consigliato

Ordine di implementazione suggerito:

1. onboarding con checkbox obbligatoria recovery phrase
2. banner sicurezza in dashboard
3. sezione `Sicurezza` nelle impostazioni
4. solo dopo, integrazione del modello di cifratura e salvataggio su ICP

## Decisione attuale

Decisione approvata:

- Fattura Vault usera` Internet Identity come base di accesso ai file
- il prodotto non offrira` recupero amministrativo dei documenti
- la mitigazione del rischio passera` attraverso onboarding, banner e sezione sicurezza dedicata
