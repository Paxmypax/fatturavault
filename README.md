# Fattura Vault

[Italiano](./README.it.md) | English

Fattura Vault is a document vault for invoices and personal documents built on the Internet Computer.

It lets users:

- upload files into a temporary Inbox
- review and organize documents before archiving
- store documents in a final Vault
- categorize, tag, annotate, and track expiry or payment status
- use AI-assisted prefill for document cataloging
- query structured Vault data with on-chain AI summaries and chat

The current public beta UI is in Italian.

## Current status

- public beta
- active development
- open code for transparency
- no independent security audit published yet

## Tech stack

- Frontend: SvelteKit + Tailwind CSS
- Backend canisters: Rust
- Authentication: Internet Identity
- Encryption: client-side Web Crypto API
- AI document prefill: user-provided OpenAI API key
- AI vault summaries/chat: on-chain LLM on ICP

## Canisters

- `vault_inbox`
  - temporary workspace for uploaded files
- `vault_backend`
  - metadata, categories, notes, dashboard logic, AI chat/summaries
- `vault_storage`
  - encrypted file blob storage
- `vault_analytics`
  - analytics events and related metrics

## Local development

### Requirements

- Rust toolchain
- Node.js / npm
- `icp` CLI

### Install frontend dependencies

```powershell
cd frontend
npm install
```

### Type-check the frontend

```powershell
cd frontend
npm run check
```

### Check the Rust workspace

```powershell
cargo check --workspace --target wasm32-unknown-unknown
```

### Project configuration

The project uses `icp.yaml` for canister configuration.

Frontend environment variables are local-only and should not be committed. Use:

- `frontend/.env.example`

as a starting point for your own local configuration.

## Important notes

- This repository does not include production secrets, local identities, or deployment-sensitive local mappings.
- Fattura Vault handles potentially sensitive documents, so users should verify AI-generated fields before archiving.
- Open source improves transparency, but it does not replace independent review or audit.

## Additional documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [SECURITY.md](./SECURITY.md)
