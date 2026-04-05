# Reset Workspace

Stato dopo pulizia del 31 marzo 2026.

Questo workspace è stato svuotato per ripartire da zero con una nuova app.

## Risorse conservate

- Dominio: `fatturavault.com`
- Backend canister staging: `sj5l7-xqaaa-aaaas-qge2q-cai`
- Frontend canister staging: `sa6ad-byaaa-aaaas-qge3a-cai`
- Controller / identità staging: `aezgl-frwrm-6d3xq-tb4mq-ulnu5-qkb3a-doa4s-sox3a-om6jw-ohqfg-eae`

## Stato canister ICP

I canister sono stati:

- reinstallati per azzerare lo stato applicativo
- fermati per ridurre consumo cycles

Stato finale:

- `fatturavault_backend`: `Stopped`
- `fatturavault_frontend`: `Stopped`

Cycles residui al momento della pulizia:

- backend: `450_468_355_807`
- frontend: `1_245_348_721_720`

## Stato server

Sul server Hetzner sono stati rimossi o fermati:

- servizio `fatturavault-relay`
- cartella `/root/mail/fatturavault-relay`
- `caddy` fermato e disabilitato

## Nota

Il progetto precedente è stato eliminato localmente.
Da qui si può ripartire con una nuova idea senza residui applicativi del progetto precedente.
