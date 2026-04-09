# Fattura Vault

Italiano | [English](./README.md)

Fattura Vault e` un vault documentale per fatture e documenti personali costruito su Internet Computer.

- Beta live: [fatturavault.com](https://fatturavault.com)
- Lingua attuale dell'interfaccia: italiano
- Obiettivo del repository: trasparenza, visibilita` architetturale e revisione da parte della community

## Cosa fa

- Carica file in una Inbox temporanea
- Rivede e organizza i documenti prima dell'archiviazione
- Salva i documenti nel Vault finale
- Categorizza, tagga, annota e traccia scadenze o stato di pagamento
- Usa un prefill assistito dall'AI durante la catalogazione
- Interroga i dati strutturati del Vault con riepiloghi e chat AI on-chain
- Calcola l'IVA trimestrale localmente nel browser a partire da CSV

## Stato attuale

- Beta pubblica
- Sviluppo attivo
- Codice aperto per trasparenza
- Nessun audit di sicurezza indipendente pubblicato al momento

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
  - metadati, categorie, note, logica dashboard, suggerimenti, chat/riepiloghi AI
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

## Documentazione

- [Panoramica architetturale](./ARCHITECTURE.it.md)
- [Informativa di sicurezza](./SECURITY.it.md)
- [README inglese](./README.md)
- [Architecture overview](./ARCHITECTURE.md)
- [Security policy](./SECURITY.md)
