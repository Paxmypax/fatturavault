# Cifratura Client-Side

## Obiettivo

Portare Fattura Vault da:

- metadata su `vault_backend`
- blob su `vault_storage`

a un modello in cui i file vengono cifrati nel browser prima dell'upload.

Il principio resta questo:

- il canister non deve vedere il contenuto in chiaro dei file
- il team non deve avere una chiave amministrativa di recupero
- l'accesso ai documenti dipende dall'accesso dell'utente a Internet Identity

## Regola di prodotto

Per ogni documento:

1. il browser genera una `document content key` casuale
2. il file originale viene cifrato con AES-GCM
3. la preview viene cifrata con AES-GCM
4. la content key viene protetta con una chiave utente derivata dall'identita
5. su `vault_storage` finiscono solo blob cifrati
6. su `vault_backend` finiscono solo metadata e riferimenti crittografici

## Cosa cifriamo

### Blob cifrati

- file originale
- preview immagine

### Metadata da cifrare dopo

Il prossimo passo, separato dai blob, sara cifrare anche:

- titolo
- merchant / esercente
- amount
- tag
- note
- invoice data
- warranty data

Per il blocco attuale partiamo dai blob, che sono il punto piu sensibile.

## Algoritmo v1

Per la v1 usiamo:

- `AES-GCM`
- chiave da `256 bit`
- `iv` da `12 byte`

Motivi:

- supportato nativamente da Web Crypto
- buone prestazioni nel browser
- envelope semplice da serializzare

## Envelope blob v1

Per ogni blob cifrato salviamo un envelope di questo tipo:

```ts
type BlobEncryptionMetadata = {
  version: 1;
  algorithm: 'AES-GCM-256';
  ivBase64: string;
  plaintextSha256Hex: string;
  ciphertextSha256Hex: string;
  plaintextSize: number;
  ciphertextSize: number;
};
```

Questi dati non contengono il file in chiaro.

Servono per:

- decrittazione
- verifica integrita
- debug controllato

## Modello chiavi

### 1. Chiave utente

La chiave utente non viene salvata in chiaro nel canister.

Direzione finale:

- chiave derivata tramite Internet Identity + vetKD
- consegnata cifrata al client
- usata solo nel browser

Per il blocco tecnico che parte ora, il frontend deve gia lavorare contro una interfaccia astratta:

```ts
type UserKeyProvider = {
  getUserWrappingKey(): Promise<CryptoKey>;
};
```

Questo ci permette di:

- implementare prima AES-GCM e envelope
- agganciare dopo la vera derivazione vetKD senza riscrivere il flusso upload

### 2. Chiave documento

Per ogni documento generiamo:

- una `document content key` casuale

Questa chiave cifra:

- blob originale
- preview

La document key viene poi protetta dalla chiave utente.

## Dati da salvare nel backend

Nel `DocumentRecord` servira una sezione crittografica simile a questa:

```ts
type DocumentCryptoState = {
  scheme: 'client-aes-gcm-v1';
  original?: BlobEncryptionMetadata;
  preview?: BlobEncryptionMetadata;
  wrappedDocumentKeyBase64: string;
  keyWrapping: 'ii-derived';
};
```

Per ora il frontend prepara i tipi e le utility.
L'aggiunta del campo al backend va nel blocco immediatamente successivo.

## Flusso upload

### Stato attuale

1. prendo il file
2. carico il blob su `vault_storage`
3. salvo i metadata su `vault_backend`

### Stato target

1. prendo il file
2. genero document key
3. calcolo hash plaintext
4. cifro file originale
5. cifro preview
6. calcolo hash ciphertext
7. carico blob cifrati su `vault_storage`
8. salvo metadata documento + envelope + wrapped key su `vault_backend`

## Flusso download / preview

1. leggo il `DocumentRecord`
2. scarico il blob cifrato da `vault_storage`
3. recupero la chiave utente
4. unwrap della document key
5. decifro il blob nel browser
6. creo object URL temporaneo

## Recupero e rischio

Il modello di prodotto resta coerente con la sezione sicurezza:

- niente recupero amministrativo lato team
- niente chiave master custodita da noi
- se l'utente perde l'accesso a Internet Identity senza recovery, perde la possibilita di decifrare i file

## Ordine di implementazione

### Blocco A

- specifica
- utility AES-GCM frontend
- tipi envelope
- refactor upload/download per accettare blob cifrati

### Blocco B

- campi crypto nel backend
- wrapped document key nel `DocumentRecord`
- sync completo frontend -> backend

### Blocco C

- integrazione chiave utente reale tramite vetKD

### Blocco D

- cifratura metadata sensibili

## Decisione operativa

Decisione adottata:

- cifratura blob lato client come prossimo blocco tecnico
- AES-GCM v1 come envelope iniziale
- document key casuale per file
- chiave utente astratta subito, vetKD reale nel blocco successivo
