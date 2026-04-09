# Informativa di Sicurezza

Italiano | [English](./SECURITY.md)

## Fase del progetto

Fattura Vault e` attualmente in beta pubblica.

Questo repository viene pubblicato per trasparenza e revisione da parte della community, ma il progetto non deve essere considerato auditato in modo indipendente a meno che tale audit non venga pubblicato esplicitamente.

## Segnalazione di vulnerabilita`

Se ritieni di aver trovato un problema di sicurezza, evita di aprire una issue pubblica con dettagli di exploit.

Segnalalo invece in privato al maintainer del progetto attraverso il canale ufficiale usato per il supporto beta.

Se in futuro verra` aggiunta una email di sicurezza dedicata, questo file andra` aggiornato.

## Sintesi del modello di sicurezza

Principi attuali di progetto:

- autenticazione utente tramite Internet Identity
- cifratura lato client prima dello storage finale
- metadati documento salvati separatamente dai blob cifrati
- il prefill AI dei documenti e` opzionale e usa una chiave API fornita dall'utente, salvata localmente nel browser
- le funzioni AI on-chain lavorano su dati strutturati del Vault, non sui file grezzi caricati

## Limiti importanti

- la beta pubblica implica che il comportamento possa ancora cambiare
- al momento non e` presente un audit pubblico di terze parti
- l'utente deve verificare i campi assistiti dall'AI prima di farvi affidamento
- la sicurezza operativa dipende anche da come l'utente protegge accesso e metodi di recupero di Internet Identity

## Ambito

Questa policy si applica a:

- canister Rust
- codice frontend
- flusso di cifratura
- gestione storage documenti e metadati

Non garantisce che il software sia privo di difetti o vulnerabilita`.
