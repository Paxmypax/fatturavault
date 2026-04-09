# Security Policy

## Project stage

Fattura Vault is currently in public beta.

This repository is published for transparency and community review, but the project should not be interpreted as independently audited unless such an audit is explicitly published.

## Reporting a vulnerability

If you believe you have found a security issue, please avoid opening a public issue with exploit details.

Instead, report it privately to the project maintainer through the official project contact channel used for beta support.

If a dedicated security email is added later, this file should be updated accordingly.

## Security model summary

Current design principles:

- user authentication through Internet Identity
- client-side encryption before final storage
- document metadata stored separately from encrypted blobs
- AI document prefill is opt-in and uses a user-provided API key stored locally in the browser
- on-chain AI features operate on structured Vault data, not raw uploaded files

## Important limitations

- public beta means behavior may still change
- no public third-party audit is included at this stage
- users must verify AI-assisted fields before relying on them
- operational security also depends on the user protecting Internet Identity access and recovery methods

## Scope

This policy applies to:

- Rust canisters
- frontend code
- encryption flow
- document storage and metadata handling

It does not guarantee that the software is free from defects or vulnerabilities.

