# Fattura Vault

Italiano | [English](./README.md)

Fattura Vault e` un vault documentale per fatture e documenti personali costruito su Internet Computer.

Permette agli utenti di:

- caricare file in una Inbox temporanea
- rivedere e organizzare i documenti prima dell'archiviazione
- salvare i documenti nel Vault finale
- categorizzare, taggare, annotare e tracciare scadenze o stato di pagamento
- usare un prefill assistito dall'AI durante la catalogazione
- interrogare i dati strutturati del Vault con riepiloghi e chat AI on-chain

L'interfaccia della beta pubblica e` attualmente in italiano.

## Stato attuale

- beta pubblica
- sviluppo attivo
- codice aperto per trasparenza
- nessun audit di sicurezza indipendente pubblicato al momento

## Stack tecnico

- Frontend: SvelteKit + Tailwind CSS
- Canister backend: Rust
- Autenticazione: Internet Identity
- Crittografia: Web Crypto API lato client
- Prefill documenti AI: chiave OpenAI fornita dall'utente
- Riepiloghi/chat AI del Vault: LLM on-chain su ICP

## Canister

- `vault_inbox`
  - area temporanea per i file caricati
- `vault_backend`
  - metadati, categorie, note, logica dashboard, chat/riepiloghi AI
- `vault_storage`
  - storage dei blob file cifrati
- `vault_analytics`
  - eventi analytics e metriche correlate

## Sviluppo locale

### Requisiti

- toolchain Rust
- Node.js / npm
- CLI `icp`

### Installare le dipendenze frontend

```powershell
cd frontend
npm install
```

### Type-check del frontend

```powershell
cd frontend
npm run check
```

### Verifica del workspace Rust

```powershell
cargo check --workspace --target wasm32-unknown-unknown
```

### Configurazione progetto

Il progetto usa `icp.yaml` per la configurazione dei canister.

Le variabili d'ambiente del frontend sono solo locali e non devono essere committate. Usa:

- `frontend/.env.example`

come base di partenza per la tua configurazione locale.

## Note importanti

- Questo repository non include segreti di produzione, identity locali o mapping sensibili di deploy.
- Fattura Vault gestisce documenti potenzialmente sensibili, quindi i campi generati dall'AI vanno sempre verificati prima dell'archiviazione.
- L'open source migliora la trasparenza, ma non sostituisce una revisione o un audit indipendente.

## Documentazione aggiuntiva

- [ARCHITECTURE.it.md](./ARCHITECTURE.it.md)
- [SECURITY.it.md](./SECURITY.it.md)
