# Nota Tecnica: Storage Evolutivo

## Obiettivo

Questa nota serve a fissare una linea architetturale semplice:

- Fattura Vault continua oggi con storage nativo su ICP
- non facciamo refactor prematuri
- teniamo pero' il progetto pronto a evolvere il layer storage in futuro, ad esempio se i Cloud Engines diventeranno una soluzione concreta e conveniente

## Stato attuale

L'architettura e' gia' abbastanza ben separata:

- `vault_inbox`
  - area temporanea di lavoro
  - upload iniziale
  - preview e prefill
- `vault_backend`
  - ownership
  - metadati documento
  - categorie
  - note
  - limiti utente
  - AI chat/riepiloghi
- `vault_storage`
  - storage blob e chunk
  - upload, download, delete dei file

Anche il frontend e' gia' impostato in modo abbastanza pulito:

- `frontend/src/lib/vault.ts`
  - centralizza il ciclo blob
  - e' il punto giusto dove un domani sostituire o estendere il provider storage

## Punto forte gia' presente

Il prodotto non dipende in modo caotico dal canister storage.

La separazione attuale tra:

- logica applicativa
- area inbox temporanea
- storage blob

e' una buona base e non va stravolta adesso.

## Punto rigido attuale

Oggi i documenti conoscono ancora troppo bene il provider storage corrente.

In particolare, i metadata usano riferimenti diretti come:

- `original_blob_id`
- `preview_blob_id`

Questo significa che il modello dati e alcune regole del backend sono ancora legate implicitamente a `vault_storage`.

Esempi:

- un documento processato viene considerato valido se ha blob id coerenti
- un documento puo' essere considerato orfano se quei blob id mancano

Questa logica oggi va bene, ma non e' ancora provider-agnostic.

## Cosa NON fare adesso

Non conviene:

- rifare subito il modello storage
- creare astrazioni troppo grandi "per il futuro"
- introdurre provider multipli senza un bisogno reale
- migrare i documenti attuali

Questo sarebbe overengineering e rallenterebbe il prodotto.

## Cosa tenere a mente per il futuro

Se un domani Cloud Engines o un altro layer storage diventano davvero interessanti, il punto giusto da evolvere sara' questo:

### 1. Riferimenti storage piu' neutri

Al posto di campi troppo specifici tipo:

- `original_blob_id`
- `preview_blob_id`

potremo passare a qualcosa di piu' generale, ad esempio:

- `storage_provider`
- `original_asset_ref`
- `preview_asset_ref`

### 2. Regole backend meno legate al provider

Le regole su:

- documento valido
- documento orfano
- documento completato

andranno rese indipendenti dal fatto che il file viva per forza in `vault_storage`.

### 3. Adapter frontend unico

Il frontend dovra' continuare a passare da un solo layer centralizzato per:

- upload
- download
- delete
- preview

Il posto corretto, oggi, e' gia':

- `frontend/src/lib/vault.ts`

## Strategia consigliata

La strategia da seguire e':

1. continuare a sviluppare Fattura Vault sull'architettura attuale
2. non fermarsi in attesa dei Cloud Engines
3. mantenere pulita la separazione tra metadata e blob
4. evitare nuove dipendenze forti dal provider storage attuale
5. rivalutare il layer storage solo quando esistera' una soluzione concreta, disponibile e vantaggiosa

## Sintesi finale

Oggi Fattura Vault e':

- abbastanza vicino a uno storage evolutivo
- ben impostato nei confini principali
- non ancora pienamente provider-agnostic

Il punto sensibile da ricordare e' uno solo:

- i documenti conoscono ancora troppo bene `vault_storage`

Finche' questo viene tenuto presente, possiamo continuare a costruire senza bloccarci e senza perdere la possibilita' di evolvere il progetto in futuro.
