# Analytics ICP per Fattura Vault

## Obiettivo

Costruire un sistema di analytics utile a capire:

- se gli utenti usano davvero il prodotto
- se tornano nel tempo
- quali funzioni generano valore reale
- se il progetto ha numeri credibili da mostrare un domani a partner, investitori o acquirenti

L'obiettivo non e` tracciare tutto.
L'obiettivo e` misurare bene poche cose importanti, senza tradire la promessa di privacy del prodotto.

---

## Principi

### 1. Niente tracker esterni nel cuore dell'app

Per il prodotto autenticato non usiamo Google Analytics, Meta Pixel o servizi simili come base principale delle metriche.

Possiamo eventualmente usare analytics tradizionali solo per il sito pubblico, ma non per il core del vault.

### 2. Nessun contenuto documento nei log analytics

Non registriamo:

- nome reale del documento
- importi completi in chiaro
- tag sensibili
- testo delle note
- immagini o file

Gli analytics devono descrivere il comportamento del prodotto, non il contenuto dei dati dell'utente.

### 3. Eventi piccoli, aggregabili, utili

Registriamo solo eventi applicativi minimi:

- login
- upload
- archiviazione
- apertura documento
- creazione nota

### 4. Separazione tra prodotto e analytics

Gli analytics non devono appesantire il backend principale.

Architettura consigliata:

- `vault_backend`: dati utente e logica app
- `vault_storage`: blob file
- `vault_analytics`: eventi e aggregazioni

---

## Cosa vogliamo misurare

## Metriche principali

### Attivazione

- utenti registrati
- utenti che completano onboarding sicurezza
- utenti che caricano almeno un file
- utenti che archiviano almeno un documento

### Utilizzo

- documenti caricati
- documenti archiviati
- documenti aperti
- note create
- post-it creati
- categorie custom create

### Attivita`

- `DAU`: utenti attivi giornalieri
- `WAU`: utenti attivi settimanali
- `MAU`: utenti attivi mensili

Definizione consigliata di utente attivo:

- almeno un evento significativo nella finestra temporale

Eventi significativi:

- `document_uploaded`
- `document_archived`
- `document_opened`
- `note_created`
- `note_updated`

### Retention

- ritorno a 7 giorni
- ritorno a 30 giorni
- utenti che tornano dopo il primo archivio documento

### Salute del prodotto

- percentuale utenti che caricano ma non archiviano nulla
- percentuale utenti che archiviano almeno 3 documenti
- media documenti per utente
- media note per utente

---

## Eventi da tracciare

## Eventi minimi della v1

```text
user_logged_in
security_onboarding_completed
document_uploaded
document_archived
document_deleted
document_opened
note_created
note_updated
note_deleted
postit_created
postit_completed
postit_deleted
category_created
category_updated
category_deleted
```

## Eventi utili della v1.1

```text
document_marked_payable
document_marked_paid
vault_bulk_delete
vault_bulk_export
vault_bulk_change_category
search_used
filter_used
view_switched_table_grid
```

---

## Dati minimi di ogni evento

Ogni evento dovrebbe contenere:

```rust
pub struct AnalyticsEvent {
    pub id: String,
    pub user_hash: String,
    pub event_type: String,
    pub occurred_at_ns: u64,
    pub metadata: Option<EventMetadata>,
}
```

### `user_hash`

Non serve salvare il principal in chiaro per il reporting.
Meglio usare un identificatore pseudonimo stabile, per esempio:

- hash del principal
- oppure hash del principal + salt applicativo

Questo permette di:

- contare utenti attivi
- fare retention
- ridurre l'esposizione diretta dell'identita`

### `metadata`

Solo metadati minimi e non sensibili, per esempio:

```rust
pub struct EventMetadata {
    pub category_id: Option<String>,
    pub document_kind: Option<String>,   // invoice, warranty, receipt, generic
    pub source_screen: Option<String>,   // inbox, vault, categorie, dashboard
    pub item_count: Option<u32>,         // per bulk actions
}
```

Non salvare:

- titolo documento
- merchant
- importo esatto
- testo note

---

## Architettura consigliata

## Opzione consigliata

Canister separato:

- `vault_analytics`

Responsabilita`:

- ricevere eventi
- salvare eventi minimi
- mantenere aggregati giornalieri e mensili
- esporre query di riepilogo per dashboard admin

### Perche` separato

- non sporca `vault_backend`
- isola il traffico analytics
- si puo` cambiare strategia senza rompere il prodotto
- rende piu` semplice mostrare numeri a terzi

---

## Tipi di storage consigliati

### Raw events

Per debugging leggero e aggregazioni successive.

Da mantenere con retention controllata.

Esempio:

- ultimi 90 giorni di eventi grezzi

### Aggregati giornalieri

Per dashboard e metriche storiche:

```rust
pub struct DailyMetrics {
    pub day_key: String, // es. 2026-04-02
    pub unique_active_users: u64,
    pub logins: u64,
    pub documents_uploaded: u64,
    pub documents_archived: u64,
    pub documents_opened: u64,
    pub notes_created: u64,
    pub categories_created: u64,
}
```

### Aggregati mensili

Per MAU, crescita e vendibilita` del progetto.

---

## Query utili per dashboard admin

## Query minime

```rust
#[query]
fn get_daily_metrics(day_key: String) -> Option<DailyMetrics>;

#[query]
fn get_last_30_days_metrics() -> Vec<DailyMetrics>;

#[query]
fn get_product_summary() -> ProductSummary;

#[query]
fn get_retention_snapshot() -> RetentionSnapshot;
```

## `ProductSummary`

```rust
pub struct ProductSummary {
    pub total_registered_users: u64,
    pub dau: u64,
    pub wau: u64,
    pub mau: u64,
    pub total_documents_uploaded: u64,
    pub total_documents_archived: u64,
    pub total_notes_created: u64,
}
```

## `RetentionSnapshot`

```rust
pub struct RetentionSnapshot {
    pub day_7_retention: f64,
    pub day_30_retention: f64,
}
```

---

## Metriche piu` utili per vendere il progetto

Se un domani vogliamo dire che il prodotto ha valore, le metriche piu` importanti non sono solo i login.

Sono queste:

- quanti utenti archiviano almeno un documento
- quanti tornano dopo 7 giorni
- quanti tornano dopo 30 giorni
- quanti documenti in media salva un utente attivo
- quanti utenti passano da semplice upload a archivio organizzato

In pratica il funnel minimo da monitorare e`:

```text
login
-> security_onboarding_completed
-> document_uploaded
-> document_archived
-> return_visit
```

Se questo funnel regge, il progetto ha una base narrativa molto piu` forte.

---

## Privacy e messaggio prodotto

Il sistema analytics deve essere coerente con il messaggio di Fattura Vault.

Quindi:

- niente sorveglianza dettagliata
- niente tracciamento del contenuto documentale
- niente analytics invadenti di terze parti nel core app
- solo eventi minimi e aggregati

Messaggio corretto:

> Misuriamo l'uso del prodotto per migliorarlo, non il contenuto dei tuoi documenti.

---

## Fase consigliata di implementazione

## Fase 1

Tracciare solo:

- `user_logged_in`
- `security_onboarding_completed`
- `document_uploaded`
- `document_archived`
- `note_created`

Obiettivo:

- DAU
- WAU
- MAU
- primi funnel

## Fase 2

Aggiungere:

- document open
- delete
- bulk actions
- filtri usati
- cambio vista

Obiettivo:

- capire davvero come viene usato `Vault`

## Fase 3

Dashboard admin interna con:

- attivi giornalieri
- crescita utenti
- documenti medi per utente
- retention 7/30 giorni

---

## Decisione consigliata

Per Fattura Vault la scelta migliore e`:

- analytics proprietari minimi
- canister separato `vault_analytics`
- pseudonimo utente via hash
- zero contenuti sensibili nei log
- metriche focalizzate su attivazione, uso e retention

Questo permette di avere:

- numeri credibili
- architettura pulita
- coerenza col posizionamento privacy
- materiale utile se il progetto cresce o va presentato/venduto
