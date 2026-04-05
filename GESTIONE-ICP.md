# Gestione Spazio ICP - FatturaVault

Documento operativo per gestire il tuo spazio su ICP, le identita`, le chiavi, i saldi e i canister del progetto.

Ultimo aggiornamento: 1 aprile 2026

## 1. Cosa stai usando oggi

In questo momento il progetto usa una identita` dedicata per lo staging:

- Identita`: `fatturavault-staging`
- Principal: `aezgl-frwrm-6d3xq-tb4mq-ulnu5-qkb3a-doa4s-sox3a-om6jw-ohqfg-eae`
- Account ICP da finanziare: `6a735ab09c47a431be8839dfb5fa9b017b546f3cec11de5c477802c076bfdfae`

Canister collegati a questa identita`:

- Frontend: `sa6ad-byaaa-aaaas-qge3a-cai`
- Inbox: `gfi4d-wiaaa-aaaab-qgrma-cai`
- Backend: `sj5l7-xqaaa-aaaas-qge2q-cai`
- Storage: `cd6pz-eqaaa-aaaac-bekmq-cai`
- Analytics: `ap74x-uaaaa-aaaaa-qgyra-cai`

## 2. Come funziona lo "spazio" su ICP

Su ICP hai 3 cose da tenere d'occhio:

1. `ICP` sull'identita`
   Serve per finanziare lo staging e convertire token in cycles.

2. `Cycles` sull'identita`
   Sono la "benzina" che puoi poi usare per top-up o creazione canister.

3. `Cycles` dentro i canister
   Sono quelli che il frontend e il backend consumano davvero per restare online.

In pratica il flusso e`:

`ICP -> cycles -> canister`

## 3. Dati attuali del tuo staging

### Saldo identita`

- Saldo ICP: `2.56802852 ICP`
- Saldo cycles identita`: `799_200_006_620 cycles`

### Frontend

- Canister ID: `sa6ad-byaaa-aaaas-qge3a-cai`
- Stato: `Running`
- Cycles: `1_240_215_231_519`
- Memoria usata: `3_820_000`
- Consumo idle stimato: `76_513_316 cycles/giorno`

### Inbox

- Canister ID: `gfi4d-wiaaa-aaaab-qgrma-cai`
- Stato: `Running`
- Note: canister temporaneo per la nuova Inbox cross-device e AI-ready

### Backend

- Canister ID: `sj5l7-xqaaa-aaaas-qge2q-cai`
- Stato: `Running`
- Cycles: `443_544_545_475`
- Memoria usata: `2_656_705`
- Consumo idle stimato: `53_212_908 cycles/giorno`

### Storage

- Canister ID: `cd6pz-eqaaa-aaaac-bekmq-cai`
- Stato: `Running`
- Cycles: `343_990_804_086`
- Memoria usata: `2_109_726`
- Consumo idle stimato: `42_257_102 cycles/giorno`

### Analytics

- Canister ID: `ap74x-uaaaa-aaaaa-qgyra-cai`
- Stato: `Running`
- Cycles: `343_513_336_125`
- Memoria usata: `10_629_552`
- Consumo idle stimato: `212_906_355 cycles/giorno`

Nota:
- Il frontend e` online e serve lo staging pubblico.
- Backend, storage e analytics ora sono deployati anche su staging ICP.

## 4. Link utili del progetto

- App staging: [https://sa6ad-byaaa-aaaas-qge3a-cai.icp0.io/](https://sa6ad-byaaa-aaaas-qge3a-cai.icp0.io/)
- Dashboard: [https://sa6ad-byaaa-aaaas-qge3a-cai.icp0.io/dashboard](https://sa6ad-byaaa-aaaas-qge3a-cai.icp0.io/dashboard)
- Inbox: [https://sa6ad-byaaa-aaaas-qge3a-cai.icp0.io/inbox](https://sa6ad-byaaa-aaaas-qge3a-cai.icp0.io/inbox)
- Categorie: [https://sa6ad-byaaa-aaaas-qge3a-cai.icp0.io/categorie](https://sa6ad-byaaa-aaaas-qge3a-cai.icp0.io/categorie)
- Vault: [https://sa6ad-byaaa-aaaas-qge3a-cai.icp0.io/vault](https://sa6ad-byaaa-aaaas-qge3a-cai.icp0.io/vault)
- Note: [https://sa6ad-byaaa-aaaas-qge3a-cai.icp0.io/note](https://sa6ad-byaaa-aaaas-qge3a-cai.icp0.io/note)
- Analytics: [https://sa6ad-byaaa-aaaas-qge3a-cai.icp0.io/analytics](https://sa6ad-byaaa-aaaas-qge3a-cai.icp0.io/analytics)

## 5. Comandi base da ricordare

Apri PowerShell e lavora da:

```powershell
cd "C:\Users\Luigi\Desktop\icp fatture"
```

### Vedere le identita`

```powershell
icp identity list
```

### Vedere qual e` il principal della tua identita` staging

```powershell
icp identity principal --identity fatturavault-staging
```

### Vedere l'account ICP da finanziare

```powershell
icp identity account-id --identity fatturavault-staging
```

### Vedere il saldo ICP dell'identita`

```powershell
icp token balance -n ic --identity fatturavault-staging
```

### Vedere il saldo cycles dell'identita`

```powershell
icp cycles balance -n ic --identity fatturavault-staging
```

### Vedere lo stato del frontend

```powershell
icp canister status sa6ad-byaaa-aaaas-qge3a-cai -n ic --identity fatturavault-staging
```

### Vedere lo stato del backend

```powershell
icp canister status sj5l7-xqaaa-aaaas-qge2q-cai -n ic --identity fatturavault-staging
```

### Vedere lo stato della inbox temporanea

```powershell
icp canister status gfi4d-wiaaa-aaaab-qgrma-cai -n ic --identity fatturavault-staging
```

### Vedere lo stato dello storage

```powershell
icp canister status cd6pz-eqaaa-aaaac-bekmq-cai -n ic --identity fatturavault-staging
```

### Vedere lo stato di analytics

```powershell
icp canister status ap74x-uaaaa-aaaaa-qgyra-cai -n ic --identity fatturavault-staging
```

## 6. Come finanziare lo staging

Se vuoi aggiungere fondi, devi inviare ICP a questo account:

```text
6a735ab09c47a431be8839dfb5fa9b017b546f3cec11de5c477802c076bfdfae
```

Dopo che gli ICP sono arrivati:

### Convertire ICP in cycles

Per esempio:

```powershell
icp cycles mint --icp 0.5 -n ic --identity fatturavault-staging
```

Oppure chiedere un certo numero di cycles:

```powershell
icp cycles mint --cycles 1t -n ic --identity fatturavault-staging
```

`1t` = 1 trillion cycles.

## 7. Come spostare cycles dentro un canister

Se vuoi fare top-up del frontend:

```powershell
icp canister top-up sa6ad-byaaa-aaaas-qge3a-cai --amount 500b -n ic --identity fatturavault-staging
```

Se vuoi fare top-up del backend:

```powershell
icp canister top-up sj5l7-xqaaa-aaaas-qge2q-cai --amount 500b -n ic --identity fatturavault-staging
```

Se vuoi fare top-up dello storage:

```powershell
icp canister top-up cd6pz-eqaaa-aaaac-bekmq-cai --amount 500b -n ic --identity fatturavault-staging
```

Se vuoi fare top-up di analytics:

```powershell
icp canister top-up ap74x-uaaaa-aaaaa-qgyra-cai --amount 500b -n ic --identity fatturavault-staging
```

Esempi:

- `500b` = 500 billion cycles
- `1t` = 1 trillion cycles

## 8. Come capire se stai "finendo spazio"

Su ICP non guardi solo i GB come su un hosting classico. Devi guardare:

- `Cycles`
- `Memory size`
- `Idle cycles burned per day`

Il comando chiave e`:

```powershell
icp canister status <CANISTER_ID> -n ic --identity fatturavault-staging
```

Controlla soprattutto:

- `Cycles`
- `Memory size`
- `Idle cycles burned per day`
- `Status`

Se i cycles scendono troppo:
- il canister rischia di fermarsi
- oppure di diventare congelato piu` avanti

## 9. Start / stop canister

### Avviare il backend

```powershell
icp canister start sj5l7-xqaaa-aaaas-qge2q-cai -n ic --identity fatturavault-staging
```

### Fermare il backend

```powershell
icp canister stop sj5l7-xqaaa-aaaas-qge2q-cai -n ic --identity fatturavault-staging
```

### Avviare il frontend

```powershell
icp canister start sa6ad-byaaa-aaaas-qge3a-cai -n ic --identity fatturavault-staging
```

### Fermare il frontend

```powershell
icp canister stop sa6ad-byaaa-aaaas-qge3a-cai -n ic --identity fatturavault-staging
```

Nota:
- fermare il frontend spegne il sito pubblico
- fermare il backend ha senso se non lo stai usando

## 10. Backup chiavi e identita`

La cosa piu` importante da non perdere e` l'identita` `fatturavault-staging`.

Se perdi questa identita`:

- perdi il controllo dei canister che gestisce
- perdi accesso operativo allo staging
- devi intervenire solo se hai gia` un backup o altri controller

### Esportare la chiave in PEM

```powershell
icp identity export fatturavault-staging
```

### Esportare la chiave cifrata

```powershell
icp identity export fatturavault-staging --encrypt
```

Consiglio pratico:

- fai un export cifrato
- salvalo fuori dal progetto
- non committarlo mai nel repo
- non lasciarlo sul desktop in chiaro

Meglio conservarlo in:

- password manager con allegato sicuro
- disco esterno cifrato
- cartella privata sincronizzata e cifrata

## 11. Cosa ti serve davvero per gestire tutto

Per gestire bene il tuo spazio ICP ti servono solo queste cose:

### 1. Nome identita`

```text
fatturavault-staging
```

### 2. Principal dell'identita`

```text
aezgl-frwrm-6d3xq-tb4mq-ulnu5-qkb3a-doa4s-sox3a-om6jw-ohqfg-eae
```

### 3. Account ICP da finanziare

```text
6a735ab09c47a431be8839dfb5fa9b017b546f3cec11de5c477802c076bfdfae
```

### 4. Canister ID del frontend

```text
sa6ad-byaaa-aaaas-qge3a-cai
```

### 5. Canister ID del backend

```text
sj5l7-xqaaa-aaaas-qge2q-cai
```

## 12. Routine minima consigliata

Ogni tanto controlla:

```powershell
icp token balance -n ic --identity fatturavault-staging
icp cycles balance -n ic --identity fatturavault-staging
icp canister status sa6ad-byaaa-aaaas-qge3a-cai -n ic --identity fatturavault-staging
icp canister status sj5l7-xqaaa-aaaas-qge2q-cai -n ic --identity fatturavault-staging
```

Se devi fare deploy frontend:

```powershell
cd "C:\Users\Luigi\Desktop\icp fatture\fatturavault\frontend"
npm run build
npm run deploy:staging
```

## 13. Nota importante sul deploy attuale

Lo staging pubblicato adesso usa il frontend canister:

```text
sa6ad-byaaa-aaaas-qge3a-cai
```

Il backend canister esiste ancora ma in questo momento e` fermo:

```text
sj5l7-xqaaa-aaaas-qge2q-cai
```

Quindi, se stai lavorando solo sulla UI o su pagine statiche della nuova app:

- il frontend ti basta
- il backend puoi anche lasciarlo spento finche` non serve davvero

## 14. Riassunto rapido

Se ti serve ricordare solo il minimo:

- Identita`: `fatturavault-staging`
- Account da finanziare: `6a735ab09c47a431be8839dfb5fa9b017b546f3cec11de5c477802c076bfdfae`
- Saldo ICP: `2.56802852 ICP`
- Saldo cycles identita`: `999_700_004_723 cycles`
- Frontend online: `sa6ad-byaaa-aaaas-qge3a-cai`
- Backend fermo: `sj5l7-xqaaa-aaaas-qge2q-cai`

## 15. Quando il saldo inizia a essere basso

Per non trovarti con il sito giu` all'improvviso, usa questa regola semplice.

### Identita`

Se il saldo ICP dell'identita` scende:

- sotto `1 ICP`: inizia a pianificare un nuovo finanziamento
- sotto `0.5 ICP`: meglio ricaricare presto
- vicino a `0 ICP`: non puoi piu` mintare nuovi cycles

Se il saldo cycles dell'identita` scende:

- sotto `500b`: controlla i canister e pianifica un top-up
- sotto `200b`: inizia a essere stretto per lavorare sereno

### Canister frontend

Il frontend oggi consuma circa:

- `76_513_316 cycles/giorno`

Quindi:

- sopra `1t`: stai tranquillo
- tra `500b` e `1t`: tutto ok, ma monitoralo
- sotto `200b`: meglio fare top-up
- sotto `100b`: non aspettare troppo

### Canister backend

Il backend oggi consuma circa:

- `49_348_946 cycles/giorno`

Se resta fermo, il rischio e` minore. Se lo riattivi e inizi a usarlo davvero, controllalo piu` spesso.

## 16. Cosa fare se i cycles scendono

Ordine pratico:

1. controlla se ti serve davvero tenere tutti i canister accesi
2. se un canister non serve, fermalo
3. se l'identita` ha ancora ICP, minta nuovi cycles
4. fai top-up al canister giusto

Esempio pratico:

```powershell
icp token balance -n ic --identity fatturavault-staging
icp cycles balance -n ic --identity fatturavault-staging
icp canister status sa6ad-byaaa-aaaas-qge3a-cai -n ic --identity fatturavault-staging
```

Se serve top-up frontend:

```powershell
icp canister top-up sa6ad-byaaa-aaaas-qge3a-cai --amount 500b -n ic --identity fatturavault-staging
```

Se prima devi creare cycles:

```powershell
icp cycles mint --icp 0.5 -n ic --identity fatturavault-staging
```

## 17. Strategia semplice che ti consiglio

Per non complicarti la vita:

- tieni sempre almeno `1 ICP` libero sull'identita`
- tieni il frontend sopra `500b` cycles
- lascia il backend spento finche` non ti serve davvero
- controlla i saldi ogni volta che fai deploy importanti

Questa e` una strategia prudente ma semplice, adatta al tuo staging attuale.

## 18. Dominio vero `fatturavault.com`

Il frontend staging pubblica gia` il file richiesto da ICP qui:

- [https://sa6ad-byaaa-aaaas-qge3a-cai.icp0.io/.well-known/ic-domains](https://sa6ad-byaaa-aaaas-qge3a-cai.icp0.io/.well-known/ic-domains)

Contenuto pubblicato:

```text
fatturavault.com
www.fatturavault.com
```

### Stato attuale

Dominio validato e richiesta di registrazione inviata con successo.

Controlli eseguiti:

```powershell
curl https://icp0.io/custom-domains/v1/fatturavault.com/validate
curl -X POST https://icp0.io/custom-domains/v1/fatturavault.com
```

Risultato:

- validazione DNS: `success`
- canister verificato: `sa6ad-byaaa-aaaas-qge3a-cai`
- registrazione dominio: `accepted`

Ora resta solo da attendere il provisioning TLS dei boundary nodes, che puo` richiedere alcuni minuti.

### Record da creare in Cloudflare

Per il frontend canister:

```text
sa6ad-byaaa-aaaas-qge3a-cai
```

Record consigliati:

```text
_canister-id.fatturavault.com      TXT     "sa6ad-byaaa-aaaas-qge3a-cai"
_acme-challenge.fatturavault.com   CNAME   _acme-challenge.fatturavault.com.icp2.io
www.fatturavault.com               CNAME   fatturavault.com.icp1.io
```

Per il dominio root `fatturavault.com`, in Cloudflare conviene puntare il nome root verso:

```text
fatturavault.com.icp1.io
```

Se Cloudflare non permette un `CNAME` classico sull'apice, usa il comportamento equivalente supportato dal provider per il root.

### Dopo la registrazione

Si aspetta il provisioning TLS e poi si prova:

```text
https://fatturavault.com
```
