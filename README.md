# Fattura Vault

[Italiano](./README.it.md) | English

Fattura Vault is a document vault for invoices and personal documents built on the Internet Computer.

- Live beta: [fatturavault.com](https://fatturavault.com)
- Current UI language: Italian
- Repository goal: transparency, architecture visibility, and community review

## What it does

- Upload files into a temporary Inbox
- Review and organize documents before archiving
- Store documents in a final Vault
- Categorize, tag, annotate, and track expiry or payment status
- Use AI-assisted prefill for document cataloging
- Query structured Vault data with on-chain AI summaries and chat
- Calculate quarterly VAT locally in the browser from CSV exports

## Current status

- Public beta
- Active development
- Open code for transparency
- No independent security audit published yet

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
  - metadata, categories, notes, dashboard logic, suggestions, AI chat/summaries
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

as a starting point for your local configuration.

## Important notes

- This repository does not include production secrets, local identities, or deployment-sensitive local mappings.
- Fattura Vault handles potentially sensitive documents, so users should verify AI-generated fields before archiving.
- Open source improves transparency, but it does not replace independent review or audit.

## Documentation

- [Architecture overview](./ARCHITECTURE.md)
- [Security policy](./SECURITY.md)
- [Italian README](./README.it.md)
- [Italian architecture overview](./ARCHITECTURE.it.md)
- [Italian security policy](./SECURITY.it.md)
