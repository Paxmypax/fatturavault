# Architecture Overview

## Product model

Fattura Vault separates document handling into three main stages:

1. Inbox
2. Vault
3. AI and dashboard services

This keeps temporary processing separate from final archival state.

## Main components

### `vault_inbox`

Temporary document workspace.

Responsibilities:

- receive uploaded files
- keep documents available across devices while they are being reviewed
- support preview generation and analysis metadata
- hold AI-assisted prefill data before final archiving

### `vault_backend`

Application metadata and business logic.

Responsibilities:

- document metadata
- categories
- notes and post-its
- dashboard aggregates
- smart suggestions
- AI vault summaries and chat
- notification state
- user quotas and limits

### `vault_storage`

Encrypted blob storage.

Responsibilities:

- create blobs
- upload chunks
- finalize blobs
- download encrypted bytes
- delete stored blobs

### `vault_analytics`

Analytics event collection and related measurements.

## Frontend role

The frontend is responsible for:

- Internet Identity session handling
- client-side encryption and decryption
- file preview preparation
- orchestrating Inbox and Vault flows
- AI prefill invocation with a user-provided OpenAI API key

Important consequence:

- the frontend is a critical part of the document security and user experience model

## AI split

The project intentionally uses two different AI paths:

### Document prefill

- user-provided OpenAI API key
- opt-in
- used for reading documents and precompiling form fields

### Vault AI

- on-chain LLM
- used for summaries, suggestions, and chat on structured Vault data
- does not replace document verification by the user

## Storage model

Current final storage flow:

- file is encrypted client-side
- metadata is stored in `vault_backend`
- encrypted blobs are stored in `vault_storage`

The current model is ICP-native. A future storage evolution should preserve the separation between:

- metadata
- encrypted blobs
- temporary inbox processing

## Design principle

The product should keep business logic independent from blob handling as much as possible.

This is important both for maintainability and for future evolution of the storage layer.

