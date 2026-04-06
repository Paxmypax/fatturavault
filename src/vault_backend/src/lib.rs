use candid::{decode_one, encode_one, CandidType, Principal};
use fatturavault_shared::{
    default_categories_for, default_security_state, ActivityRecord, ActivityType, CategoryRecord,
    DocumentRecord, DocumentStatus, DocumentUpsertInput, NoteRecord, NotificationBroadcastRecord,
    NotificationReceiptRecord, NotificationViewRecord, OnchainVaultSummaryResponse,
    OnchainVaultChatResponse, PaymentStatus, PostItRecord, SecurityState, UserProfile,
    VetKeyConfigRecord,
};
use ic_cdk::call::Call;
use ic_cdk::management_canister::{
    vetkd_public_key, VetKDCurve as ManagementVetKDCurve, VetKDKeyId as ManagementVetKDKeyId,
    VetKDPublicKeyArgs,
};
use ic_cdk::{init, post_upgrade, query, update};
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, StableBTreeMap,
};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;

type Memory = VirtualMemory<DefaultMemoryImpl>;

const PROFILES_MEMORY_ID: MemoryId = MemoryId::new(0);
const CATEGORIES_MEMORY_ID: MemoryId = MemoryId::new(1);
const NOTES_MEMORY_ID: MemoryId = MemoryId::new(2);
const POSTITS_MEMORY_ID: MemoryId = MemoryId::new(3);
const DOCUMENTS_MEMORY_ID: MemoryId = MemoryId::new(4);
const ACTIVITIES_MEMORY_ID: MemoryId = MemoryId::new(5);
const AI_CHAT_USAGE_MEMORY_ID: MemoryId = MemoryId::new(6);
const NOTIFICATIONS_MEMORY_ID: MemoryId = MemoryId::new(7);
const NOTIFICATION_RECEIPTS_MEMORY_ID: MemoryId = MemoryId::new(8);
const SETTINGS_MEMORY_ID: MemoryId = MemoryId::new(9);
const NOTIFICATION_ADMINS_MEMORY_ID: MemoryId = MemoryId::new(10);
const VETKEY_CONTEXT: &[u8] = b"fatturavault-user-wrap-v1";
const VETKEY_AES_DOMAIN: &str = "fatturavault-document-wrap-aes-v1";
const VETKEY_KEY_NAME: &str = "test_key_1";
const VETKEY_DERIVE_KEY_CYCLES: u128 = 10_000_000_000;
const LLM_CANISTER_ID: &str = "w36hm-eqaaa-aaaal-qr76a-cai";
const LLM_MODEL_NAME: &str = "llama3.1:8b";
const DAY_NS: u64 = 86_400_000_000_000;
const MAX_DAILY_AI_CHAT_QUESTIONS: u32 = 20;
const MAX_DOCUMENT_FILE_BYTES: u64 = 5 * 1024 * 1024;
const MAX_VAULT_TOTAL_BYTES: u64 = 5 * 1024 * 1024 * 1024;
const ORPHAN_PROCESSED_DOCUMENT_GRACE_NS: u64 = 3_600_000_000_000;
const NOTIFICATION_HIDE_AFTER_READ_NS: u64 = 86_400_000_000_000;
const OWNER_KEY: &str = "owner";

#[derive(CandidType, Deserialize)]
enum VetKdCurve {
    #[serde(rename = "bls12_381_g2")]
    Bls12381G2,
}

#[derive(CandidType, Deserialize)]
struct VetKdKeyId {
    curve: VetKdCurve,
    name: String,
}

#[derive(CandidType, Deserialize)]
struct VetKdDeriveKeyRequest {
    input: Vec<u8>,
    context: Vec<u8>,
    transport_public_key: Vec<u8>,
    key_id: VetKdKeyId,
}

#[derive(CandidType, Deserialize)]
struct VetKdDeriveKeyResponse {
    encrypted_key: Vec<u8>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct SummaryCategoryStat {
    category_name: String,
    count: usize,
    total_amount: Option<f64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct SummaryDocumentItem {
    id: String,
    title: String,
    category_name: String,
    amount: Option<f64>,
    payment_status: String,
    document_date: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct VaultSummaryInput {
    display_name: Option<String>,
    processed_documents: usize,
    due_documents: usize,
    paid_documents: usize,
    total_amount: Option<f64>,
    total_due_amount: Option<f64>,
    invoice_documents: usize,
    warranty_documents: usize,
    notes_count: usize,
    postits_count: usize,
    categories: Vec<SummaryCategoryStat>,
    recent_documents: Vec<SummaryDocumentItem>,
    recent_activity_labels: Vec<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
enum LlmChatMessage {
    #[serde(rename = "user")]
    User { content: String },
    #[serde(rename = "system")]
    System { content: String },
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
struct LlmChatRequest {
    model: String,
    messages: Vec<LlmChatMessage>,
    tools: Option<Vec<()>>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
struct LlmAssistantMessage {
    content: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
struct LlmChatResponse {
    message: LlmAssistantMessage,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct LlmVaultSummaryJson {
    summary: String,
    highlights: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct LlmVaultChatJson {
    answer: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
struct DailyAiChatUsageRecord {
    owner: Principal,
    day_bucket: u64,
    question_count: u32,
    updated_at_ns: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
struct VaultCountsResponse {
    processed_documents: u64,
    due_documents: u64,
    paid_documents: u64,
    notes_count: u64,
    postits_count: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
struct NotificationAccessState {
    can_publish: bool,
    has_admins: bool,
}

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static PROFILES: RefCell<StableBTreeMap<String, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|manager| manager.borrow().get(PROFILES_MEMORY_ID))
        ));

    static CATEGORIES: RefCell<StableBTreeMap<String, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|manager| manager.borrow().get(CATEGORIES_MEMORY_ID))
        ));

    static NOTES: RefCell<StableBTreeMap<String, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|manager| manager.borrow().get(NOTES_MEMORY_ID))
        ));

    static POSTITS: RefCell<StableBTreeMap<String, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|manager| manager.borrow().get(POSTITS_MEMORY_ID))
        ));

    static DOCUMENTS: RefCell<StableBTreeMap<String, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|manager| manager.borrow().get(DOCUMENTS_MEMORY_ID))
        ));

    static ACTIVITIES: RefCell<StableBTreeMap<String, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|manager| manager.borrow().get(ACTIVITIES_MEMORY_ID))
        ));

    static AI_CHAT_USAGE: RefCell<StableBTreeMap<String, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|manager| manager.borrow().get(AI_CHAT_USAGE_MEMORY_ID))
        ));

    static NOTIFICATIONS: RefCell<StableBTreeMap<String, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|manager| manager.borrow().get(NOTIFICATIONS_MEMORY_ID))
        ));

    static NOTIFICATION_RECEIPTS: RefCell<StableBTreeMap<String, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|manager| manager.borrow().get(NOTIFICATION_RECEIPTS_MEMORY_ID))
        ));

    static SETTINGS: RefCell<StableBTreeMap<String, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|manager| manager.borrow().get(SETTINGS_MEMORY_ID))
        ));

    static NOTIFICATION_ADMINS: RefCell<StableBTreeMap<String, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|manager| manager.borrow().get(NOTIFICATION_ADMINS_MEMORY_ID))
        ));
}

#[init]
fn init() {
    initialize_owner();
}

#[post_upgrade]
fn post_upgrade() {
    initialize_owner();
}

fn now_ns() -> u64 {
    ic_cdk::api::time()
}

fn caller() -> Result<Principal, String> {
    let caller = ic_cdk::api::msg_caller();
    if caller == Principal::anonymous() {
        return Err("Utente non autenticato.".to_string());
    }
    Ok(caller)
}

fn initialize_owner() {
    SETTINGS.with(|settings| {
        let mut settings = settings.borrow_mut();
        if !settings.contains_key(&OWNER_KEY.to_string()) {
            settings.insert(OWNER_KEY.to_string(), encode(&ic_cdk::api::msg_caller()));
        }
    });
}

fn owner_principal() -> Option<Principal> {
    SETTINGS.with(|settings| {
        settings
            .borrow()
            .get(&OWNER_KEY.to_string())
            .map(|bytes| decode::<Principal>(&bytes))
    })
}

fn require_owner() -> Result<Principal, String> {
    let principal = caller()?;
    let Some(owner) = owner_principal() else {
        return Err("Owner backend non configurato.".to_string());
    };

    if principal != owner {
        return Err("Operazione riservata al controller backend.".to_string());
    }

    Ok(principal)
}

fn notification_admins_count() -> u64 {
    NOTIFICATION_ADMINS.with(|admins| admins.borrow().iter().count() as u64)
}

fn is_notification_admin(principal: Principal) -> bool {
    NOTIFICATION_ADMINS.with(|admins| admins.borrow().contains_key(&principal.to_text()))
}

fn require_notification_publisher() -> Result<Principal, String> {
    let principal = caller()?;
    if principal == owner_principal().unwrap_or(Principal::anonymous()) || is_notification_admin(principal) {
        return Ok(principal);
    }

    Err("Accesso notifiche riservato all'admin.".to_string())
}

fn insert_notification_admin(principal: Principal) {
    NOTIFICATION_ADMINS.with(|admins| {
        admins
            .borrow_mut()
            .insert(principal.to_text(), encode(&true))
    });
}

fn owner_key(owner: Principal) -> String {
    owner.to_text()
}

fn category_key(owner: Principal, category_id: &str) -> String {
    format!("{}::{}", owner.to_text(), category_id)
}

fn note_key(owner: Principal, note_id: &str) -> String {
    format!("{}::{}", owner.to_text(), note_id)
}

fn postit_key(owner: Principal, postit_id: &str) -> String {
    format!("{}::{}", owner.to_text(), postit_id)
}

fn document_key(owner: Principal, document_id: &str) -> String {
    format!("{}::{}", owner.to_text(), document_id)
}

fn activity_key(owner: Principal, at_ns: u64, activity_id: &str) -> String {
    format!("{}::{:020}::{}", owner.to_text(), at_ns, activity_id)
}

fn ai_chat_usage_key(owner: Principal, day_bucket: u64) -> String {
    format!("{}::{}", owner.to_text(), day_bucket)
}

fn notification_receipt_key(owner: Principal, notification_id: &str) -> String {
    format!("{}::{}", owner.to_text(), notification_id)
}

fn encode<T: CandidType>(value: &T) -> Vec<u8> {
    encode_one(value).expect("failed to encode value")
}

fn decode<T: DeserializeOwned + CandidType>(bytes: &[u8]) -> T {
    decode_one(bytes).expect("failed to decode value")
}

fn parse_json_object_slice(raw: &str) -> Option<&str> {
    let start = raw.find('{')?;
    let end = raw.rfind('}')?;
    (end > start).then_some(&raw[start..=end])
}

fn payment_status_label(status: &PaymentStatus) -> &'static str {
    match status {
        PaymentStatus::Due => "due",
        PaymentStatus::Paid => "paid",
    }
}

fn normalize_question_text(value: &str) -> String {
    value
        .to_lowercase()
        .replace(['à', 'á'], "a")
        .replace(['è', 'é'], "e")
        .replace(['ì', 'í'], "i")
        .replace(['ò', 'ó'], "o")
        .replace(['ù', 'ú'], "u")
        .replace(['?', '!', ',', '.', ':', ';', '(', ')', '"', '\''], " ")
}

fn day_bucket_from_ns(timestamp_ns: u64) -> u64 {
    timestamp_ns / DAY_NS
}

fn documents_total_bytes(owner: Principal, excluding_document_id: Option<&str>) -> u64 {
    documents_for(owner)
        .into_iter()
        .filter(|document| excluding_document_id != Some(document.id.as_str()))
        .map(|document| document.size_bytes)
        .sum()
}

fn increment_daily_ai_chat_usage(owner: Principal) -> Result<(), String> {
    let now = now_ns();
    let day_bucket = day_bucket_from_ns(now);
    let key = ai_chat_usage_key(owner, day_bucket);

    let mut usage = AI_CHAT_USAGE.with(|entries| {
        entries
            .borrow()
            .get(&key)
            .map(|bytes| decode::<DailyAiChatUsageRecord>(&bytes))
    })
    .unwrap_or(DailyAiChatUsageRecord {
        owner,
        day_bucket,
        question_count: 0,
        updated_at_ns: now,
    });

    if usage.question_count >= MAX_DAILY_AI_CHAT_QUESTIONS {
        return Err(format!(
            "Hai raggiunto il limite di {} domande AI oggi. Riprova domani.",
            MAX_DAILY_AI_CHAT_QUESTIONS
        ));
    }

    usage.question_count += 1;
    usage.updated_at_ns = now;

    AI_CHAT_USAGE.with(|entries| {
        entries.borrow_mut().insert(key, encode(&usage));
    });

    Ok(())
}

fn contains_any_term(haystack: &str, terms: &[&str]) -> bool {
    terms.iter().any(|term| haystack.contains(term))
}

fn question_mentions_warranty(question: &str) -> bool {
    let normalized = normalize_question_text(question);
    contains_any_term(&normalized, &["garanzia", "garanzie", "copertura garanzia"])
}

fn question_mentions_due_documents(question: &str) -> bool {
    let normalized = normalize_question_text(question);
    contains_any_term(
        &normalized,
        &[
            "da pagare",
            "pagare",
            "da saldare",
            "non pagati",
            "non pagato",
            "insoluti",
            "insoluto",
            "in sospeso",
            "aperte",
            "aperti",
        ],
    )
}

fn format_amount_eur(amount: f64) -> String {
    format!("{amount:.2} euro").replace('.', ",")
}

fn question_mentions_hosting(question: &str) -> bool {
    let normalized = normalize_question_text(question);
    contains_any_term(
        &normalized,
        &[
            "hosting",
            "web hosting",
            "server",
            "servers",
            "vps",
            "cloud",
            "dominio",
            "domini",
            "domain",
            "domains",
            "provider",
            "hetzner",
            "ovh",
            "aruba",
            "digitalocean",
            "aws",
            "azure",
            "gcp",
            "google cloud",
        ],
    )
}

fn question_mentions_vat(question: &str) -> bool {
    let normalized = normalize_question_text(question);
    contains_any_term(
        &normalized,
        &[
            " iva",
            "iva ",
            "iva",
            "imponibile",
            "imponibili",
            "aliquota",
            "aliquote",
            "fiscale",
            "fiscali",
            "vat",
        ],
    )
}

fn question_mentions_expiry(question: &str) -> bool {
    let normalized = normalize_question_text(question);
    contains_any_term(
        &normalized,
        &[
            "scadenza",
            "scadenze",
            "scade",
            "scadono",
            "in scadenza",
            "in scadenze",
            "rinnovo",
            "rinnovi",
            "entro",
        ],
    )
}

fn document_effective_amount(document: &DocumentRecord) -> Option<f64> {
    if let Some(amount) = document.amount {
        return Some(amount);
    }

    let invoice = document.invoice_data.as_ref()?;
    if let Some(total) = invoice.total_amount {
        return Some(total);
    }

    match (invoice.net_amount, invoice.vat_amount) {
        (Some(net), Some(vat)) => Some(net + vat),
        _ => invoice.net_amount,
    }
}

fn document_matches_hosting(document: &DocumentRecord) -> bool {
    let haystack = normalize_question_text(&format!(
        "{} {} {} {} {}",
        document.title,
        document.name,
        document.category_name,
        document.merchant_name.clone().unwrap_or_default(),
        document.tags.join(" ")
    ));

    contains_any_term(
        &haystack,
        &[
            "hosting",
            "web hosting",
            "server",
            "vps",
            "cloud",
            "domain",
            "dominio",
            "domini",
            "hetzner",
            "ovh",
            "aruba",
            "digitalocean",
            "aws",
            "azure",
            "gcp",
            "google cloud",
        ],
    )
}

fn is_countable_processed_document(document: &DocumentRecord) -> bool {
    document.status == DocumentStatus::Processed && document.original_blob_id.is_some()
}

fn is_orphan_processed_document(document: &DocumentRecord, now: u64) -> bool {
    document.status == DocumentStatus::Processed
        && document.original_blob_id.is_none()
        && document.preview_blob_id.is_none()
        && document
            .updated_at_ns
            .saturating_add(ORPHAN_PROCESSED_DOCUMENT_GRACE_NS)
            <= now
}

fn build_vault_summary_input(owner: Principal) -> VaultSummaryInput {
    let profile = profile_for(owner);
    let documents = documents_for(owner);
    let notes = notes_for(owner);
    let postits = postits_for(owner);
    let activities = activities_for(owner, Some(8));

    let processed_documents: Vec<DocumentRecord> = documents
        .into_iter()
        .filter(is_countable_processed_document)
        .collect();

    let processed_count = processed_documents.len();
    let due_documents = processed_documents
        .iter()
        .filter(|document| document.payment_status == PaymentStatus::Due)
        .count();
    let paid_documents = processed_documents
        .iter()
        .filter(|document| document.payment_status == PaymentStatus::Paid)
        .count();
    let total_amount = processed_documents
        .iter()
        .filter_map(document_effective_amount)
        .sum::<f64>();
    let has_any_amount = processed_documents
        .iter()
        .any(|document| document_effective_amount(document).is_some());
    let total_due_amount = processed_documents
        .iter()
        .filter(|document| document.payment_status == PaymentStatus::Due)
        .filter_map(document_effective_amount)
        .sum::<f64>();
    let has_due_amount = processed_documents.iter().any(|document| {
        document.payment_status == PaymentStatus::Due && document_effective_amount(document).is_some()
    });

    let invoice_documents = processed_documents
        .iter()
        .filter(|document| {
            document.invoice_data.is_some()
                || matches!(
                    document.category_name.to_lowercase().as_str(),
                    "fattura" | "ricevuta" | "fiscale"
                )
        })
        .count();
    let warranty_documents = processed_documents
        .iter()
        .filter(|document| {
            document.warranty_data.is_some()
                || matches!(document.category_name.to_lowercase().as_str(), "garanzia")
        })
        .count();

    let mut category_stats = std::collections::BTreeMap::<String, (usize, f64, bool)>::new();
    for document in &processed_documents {
        let entry = category_stats
            .entry(document.category_name.clone())
            .or_insert((0, 0.0, false));
        entry.0 += 1;
        if let Some(amount) = document_effective_amount(document) {
            entry.1 += amount;
            entry.2 = true;
        }
    }

    let mut categories: Vec<SummaryCategoryStat> = category_stats
        .into_iter()
        .map(|(category_name, (count, total_amount, has_amount))| SummaryCategoryStat {
            category_name,
            count,
            total_amount: has_amount.then_some(total_amount),
        })
        .collect();
    categories.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.category_name.cmp(&b.category_name)));
    categories.truncate(6);

    let recent_documents = processed_documents
        .iter()
        .take(8)
        .map(|document| SummaryDocumentItem {
            id: document.id.clone(),
            title: if document.title.trim().is_empty() {
                document.name.clone()
            } else {
                document.title.clone()
            },
            category_name: document.category_name.clone(),
            amount: document_effective_amount(document),
            payment_status: payment_status_label(&document.payment_status).to_string(),
            document_date: document.document_date.clone(),
        })
        .collect();

    let recent_activity_labels = activities
        .into_iter()
        .map(|activity| {
            let label = match activity.activity_type {
                ActivityType::Uploaded => "caricato",
                ActivityType::Processed => "archiviato",
                ActivityType::Updated => "aggiornato",
                ActivityType::Deleted => "eliminato",
            };
            let document_name = activity.document_title.unwrap_or(activity.document_name);
            format!("{label}: {document_name}")
        })
        .collect();

    VaultSummaryInput {
        display_name: profile.and_then(|item| item.display_name),
        processed_documents: processed_count,
        due_documents,
        paid_documents,
        total_amount: has_any_amount.then_some(total_amount),
        total_due_amount: has_due_amount.then_some(total_due_amount),
        invoice_documents,
        warranty_documents,
        notes_count: notes.len(),
        postits_count: postits.len(),
        categories,
        recent_documents,
        recent_activity_labels,
    }
}

fn profile_for(owner: Principal) -> Option<UserProfile> {
    PROFILES.with(|profiles| {
        profiles
            .borrow()
            .get(&owner_key(owner))
            .map(|bytes| decode(&bytes))
    })
}

fn save_profile(profile: &UserProfile) {
    PROFILES.with(|profiles| {
        profiles
            .borrow_mut()
            .insert(owner_key(profile.owner), encode(profile))
    });
}

fn stored_categories_for(owner: Principal) -> Vec<CategoryRecord> {
    let prefix = format!("{}::", owner.to_text());
    CATEGORIES.with(|categories| {
        categories
            .borrow()
            .iter()
            .filter_map(|entry| {
                let key = entry.key();
                if key.starts_with(&prefix) {
                    Some(decode::<CategoryRecord>(&entry.value()))
                } else {
                    None
                }
            })
            .collect()
    })
}

fn save_category(category: &CategoryRecord) {
    CATEGORIES.with(|categories| {
        categories
            .borrow_mut()
            .insert(category_key(category.owner, &category.id), encode(category))
    });
}

fn find_custom_category(owner: Principal, category_id: &str) -> Option<CategoryRecord> {
    CATEGORIES.with(|categories| {
        categories
            .borrow()
            .get(&category_key(owner, category_id))
            .map(|bytes| decode(&bytes))
    })
}

fn save_note(note: &NoteRecord) {
    NOTES.with(|notes| {
        notes
            .borrow_mut()
            .insert(note_key(note.owner, &note.id), encode(note))
    });
}

fn save_postit(postit: &PostItRecord) {
    POSTITS.with(|postits| {
        postits
            .borrow_mut()
            .insert(postit_key(postit.owner, &postit.id), encode(postit))
    });
}

fn save_document(document: &DocumentRecord) {
    DOCUMENTS.with(|documents| {
        documents
            .borrow_mut()
            .insert(document_key(document.owner, &document.id), encode(document))
    });
}

fn save_activity(activity: &ActivityRecord) {
    ACTIVITIES.with(|activities| {
        activities
            .borrow_mut()
            .insert(
                activity_key(activity.owner, activity.at_ns, &activity.id),
                encode(activity),
            )
    });
}

fn notes_for(owner: Principal) -> Vec<NoteRecord> {
    let prefix = format!("{}::", owner.to_text());
    let mut items: Vec<NoteRecord> = NOTES.with(|notes| {
        notes
            .borrow()
            .iter()
            .filter_map(|entry| {
                let key = entry.key();
                if key.starts_with(&prefix) {
                    Some(decode::<NoteRecord>(&entry.value()))
                } else {
                    None
                }
            })
            .collect()
    });
    items.sort_by(|a, b| {
        b.pinned
            .cmp(&a.pinned)
            .then_with(|| b.updated_at_ns.cmp(&a.updated_at_ns))
    });
    items
}

fn postits_for(owner: Principal) -> Vec<PostItRecord> {
    let prefix = format!("{}::", owner.to_text());
    let mut items: Vec<PostItRecord> = POSTITS.with(|postits| {
        postits
            .borrow()
            .iter()
            .filter_map(|entry| {
                let key = entry.key();
                if key.starts_with(&prefix) {
                    Some(decode::<PostItRecord>(&entry.value()))
                } else {
                    None
                }
            })
            .collect()
    });
    items.sort_by(|a, b| b.created_at_ns.cmp(&a.created_at_ns));
    items
}

fn documents_for(owner: Principal) -> Vec<DocumentRecord> {
    let prefix = format!("{}::", owner.to_text());
    let mut items: Vec<DocumentRecord> = DOCUMENTS.with(|documents| {
        documents
            .borrow()
            .iter()
            .filter_map(|entry| {
                let key = entry.key();
                if key.starts_with(&prefix) {
                    Some(decode::<DocumentRecord>(&entry.value()))
                } else {
                    None
                }
            })
            .collect()
    });
    items.sort_by(|a, b| b.updated_at_ns.cmp(&a.updated_at_ns));
    items
}

fn activities_for(owner: Principal, limit: Option<u32>) -> Vec<ActivityRecord> {
    let prefix = format!("{}::", owner.to_text());
    let mut items: Vec<ActivityRecord> = ACTIVITIES.with(|activities| {
        activities
            .borrow()
            .iter()
            .filter_map(|entry| {
                let key = entry.key();
                if key.starts_with(&prefix) {
                    Some(decode::<ActivityRecord>(&entry.value()))
                } else {
                    None
                }
            })
            .collect()
    });
    items.sort_by(|a, b| b.at_ns.cmp(&a.at_ns));
    if let Some(max) = limit {
        items.truncate(max as usize);
    }
    items
}

fn notification_broadcasts() -> Vec<NotificationBroadcastRecord> {
    let mut items: Vec<NotificationBroadcastRecord> = NOTIFICATIONS.with(|notifications| {
        notifications
            .borrow()
            .iter()
            .map(|entry| decode::<NotificationBroadcastRecord>(&entry.value()))
            .collect()
    });
    items.sort_by(|a, b| b.created_at_ns.cmp(&a.created_at_ns));
    items
}

fn notification_receipt_for(
    owner: Principal,
    notification_id: &str,
) -> Option<NotificationReceiptRecord> {
    NOTIFICATION_RECEIPTS.with(|receipts| {
        receipts
            .borrow()
            .get(&notification_receipt_key(owner, notification_id))
            .map(|bytes| decode::<NotificationReceiptRecord>(&bytes))
    })
}

fn save_notification_receipt(receipt: &NotificationReceiptRecord) {
    NOTIFICATION_RECEIPTS.with(|receipts| {
        receipts.borrow_mut().insert(
            notification_receipt_key(receipt.owner, &receipt.notification_id),
            encode(receipt),
        );
    });
}

fn visible_notifications_for(owner: Principal, now: u64) -> Vec<NotificationViewRecord> {
    notification_broadcasts()
        .into_iter()
        .filter_map(|notification| {
            let receipt = notification_receipt_for(owner, &notification.id);
            let read_at_ns = receipt.as_ref().map(|item| item.read_at_ns);

            if let Some(read_at) = read_at_ns {
                if read_at.saturating_add(NOTIFICATION_HIDE_AFTER_READ_NS) <= now {
                    return None;
                }
            }

            Some(NotificationViewRecord {
                id: notification.id,
                title: notification.title,
                body: notification.body,
                created_at_ns: notification.created_at_ns,
                read_at_ns,
                is_unread: read_at_ns.is_none(),
            })
        })
        .collect()
}

fn append_activity(owner: Principal, activity_type: ActivityType, document: &DocumentRecord) {
    let at_ns = now_ns();
    let activity = ActivityRecord {
        id: format!("activity_{}_{}", at_ns, document.id),
        owner,
        activity_type,
        document_id: document.id.clone(),
        document_name: document.name.clone(),
        document_title: Some(document.title.clone()),
        category_name: Some(document.category_name.clone()),
        at_ns,
    };
    save_activity(&activity);
}

fn normalize_name(name: &str) -> String {
    name.trim().to_lowercase()
}

fn normalize_option_text(value: Option<String>) -> Option<String> {
    value.and_then(|inner| {
        let trimmed = inner.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn vetkey_config() -> VetKeyConfigRecord {
    VetKeyConfigRecord {
        key_name: VETKEY_KEY_NAME.to_string(),
        derivation_context: VETKEY_CONTEXT.to_vec(),
        aes_domain_separator: VETKEY_AES_DOMAIN.to_string(),
    }
}

fn sanitize_tags(tags: Vec<String>) -> Vec<String> {
    let mut unique = Vec::<String>::new();
    for tag in tags {
        let trimmed = tag.trim().to_lowercase();
        if !trimmed.is_empty() && !unique.iter().any(|existing| existing == &trimmed) {
            unique.push(trimmed);
        }
    }
    unique
}

fn category_matches_document(category: &CategoryRecord, document: &DocumentRecord) -> bool {
    if let Some(category_id) = &document.category_id {
        if category_id == &category.id {
            return true;
        }
    }

    normalize_name(&document.category_name) == normalize_name(&category.name)
}

fn ensure_unique_category_name(
    owner: Principal,
    next_name: &str,
    skip_id: Option<&str>,
) -> Result<(), String> {
    let lowered = normalize_name(next_name);
    if lowered.is_empty() {
        return Err("Il nome categoria non può essere vuoto.".to_string());
    }

    let exists_in_defaults = default_categories_for(owner).into_iter().any(|category| {
        category.id.as_str() != skip_id.unwrap_or_default()
            && normalize_name(&category.name) == lowered
    });
    if exists_in_defaults {
        return Err("Esiste già una categoria con questo nome.".to_string());
    }

    let exists_in_custom = stored_categories_for(owner).into_iter().any(|category| {
        category.id.as_str() != skip_id.unwrap_or_default()
            && normalize_name(&category.name) == lowered
    });
    if exists_in_custom {
        return Err("Esiste già una categoria con questo nome.".to_string());
    }

    Ok(())
}

#[query]
fn get_my_profile() -> Option<UserProfile> {
    let owner = caller().ok()?;
    profile_for(owner)
}

#[query]
fn get_user_vetkey_config() -> VetKeyConfigRecord {
    vetkey_config()
}

#[update]
async fn get_user_vetkey_public_key() -> Result<Vec<u8>, String> {
    let _owner = caller()?;

    let result = vetkd_public_key(&VetKDPublicKeyArgs {
        canister_id: None,
        context: VETKEY_CONTEXT.to_vec(),
        key_id: ManagementVetKDKeyId {
            curve: ManagementVetKDCurve::Bls12_381_G2,
            name: VETKEY_KEY_NAME.to_string(),
        },
    })
    .await
    .map_err(|error| format!("Errore vetKD public key: {error}"))?;

    Ok(result.public_key)
}

#[update]
async fn get_encrypted_user_vetkey(transport_public_key: Vec<u8>) -> Result<Vec<u8>, String> {
    let owner = caller()?;
    if transport_public_key.is_empty() {
        return Err("Chiave di trasporto non valida.".to_string());
    }

    let request = VetKdDeriveKeyRequest {
        input: owner.as_slice().to_vec(),
        context: VETKEY_CONTEXT.to_vec(),
        transport_public_key,
        key_id: VetKdKeyId {
            curve: VetKdCurve::Bls12381G2,
            name: VETKEY_KEY_NAME.to_string(),
        },
    };

    let management_canister =
        Principal::from_text("aaaaa-aa").map_err(|_| "Management canister non valido.".to_string())?;

    let response = Call::unbounded_wait(management_canister, "vetkd_derive_key")
        .with_arg(request)
        .with_cycles(VETKEY_DERIVE_KEY_CYCLES)
        .await
        .map_err(|error| format!("Errore vetKD: {error}"))?;

    let (response,): (VetKdDeriveKeyResponse,) = response
        .candid_tuple()
        .map_err(|error| format!("Risposta vetKD non valida: {error}"))?;

    Ok(response.encrypted_key)
}

#[update]
fn upsert_my_profile(
    display_name: Option<String>,
    security: Option<SecurityState>,
) -> Result<UserProfile, String> {
    let owner = caller()?;
    let now = now_ns();

    let existing = profile_for(owner);
    let mut profile = existing.unwrap_or(UserProfile {
        owner,
        display_name: None,
        created_at_ns: now,
        updated_at_ns: now,
        security: default_security_state(),
    });

    if let Some(name) = display_name {
        let trimmed = name.trim();
        profile.display_name = if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        };
    }

    if let Some(next_security) = security {
        profile.security = next_security;
    }

    profile.updated_at_ns = now;
    save_profile(&profile);
    Ok(profile)
}

#[update]
fn get_my_categories() -> Vec<CategoryRecord> {
    let owner = match caller() {
        Ok(owner) => owner,
        Err(_) => return vec![],
    };

    let stored = stored_categories_for(owner);
    let documents = documents_for(owner);

    let mut categories = default_categories_for(owner)
        .into_iter()
        .map(|default_category| {
            stored
                .iter()
                .find(|candidate| candidate.id == default_category.id)
                .cloned()
                .unwrap_or(default_category)
        })
        .collect::<Vec<_>>();
    categories.extend(stored.into_iter().filter(|category| !category.is_default));

    for category in &mut categories {
        category.doc_count = documents
            .iter()
            .filter(|document| {
                document.status == DocumentStatus::Processed
                    && category_matches_document(category, document)
            })
            .count() as u64;
    }

    categories.sort_by(|a, b| {
        a.sort_order
            .cmp(&b.sort_order)
            .then_with(|| a.name.cmp(&b.name))
    });
    categories
}

#[update]
fn add_custom_category(
    name: String,
    color: String,
    icon: String,
) -> Result<CategoryRecord, String> {
    let owner = caller()?;
    let next_name = name.trim();
    ensure_unique_category_name(owner, next_name, None)?;

    let now = now_ns();
    let next_index = stored_categories_for(owner)
        .into_iter()
        .filter(|category| !category.is_default)
        .count() as u32;
    let category = CategoryRecord {
        id: format!("cat_{}_{}", now, next_index),
        owner,
        is_default: false,
        name: next_name.to_string(),
        color: color.trim().to_string(),
        icon: icon.trim().to_string(),
        sort_order: 100 + next_index,
        doc_count: 0,
        created_at_ns: now,
        updated_at_ns: now,
    };

    save_category(&category);
    Ok(category)
}

#[update]
fn update_category(
    category_id: String,
    name: String,
    color: String,
    icon: String,
) -> Result<CategoryRecord, String> {
    let owner = caller()?;
    let mut category = find_custom_category(owner, &category_id)
        .or_else(|| {
            default_categories_for(owner)
                .into_iter()
                .find(|candidate| candidate.id == category_id)
        })
        .ok_or_else(|| "Categoria non trovata.".to_string())?;

    ensure_unique_category_name(owner, &name, Some(&category_id))?;

    category.name = name.trim().to_string();
    category.color = color.trim().to_string();
    category.icon = icon.trim().to_string();
    category.updated_at_ns = now_ns();

    save_category(&category);
    Ok(category)
}

#[update]
fn delete_custom_category(category_id: String) -> Result<(), String> {
    let owner = caller()?;
    let category = find_custom_category(owner, &category_id)
        .ok_or_else(|| "Categoria custom non trovata.".to_string())?;
    if category.is_default {
        return Err("Categoria custom non trovata.".to_string());
    }

    let replacement = default_categories_for(owner)
        .into_iter()
        .find(|candidate| candidate.id == "other")
        .ok_or_else(|| "Categoria Altro non disponibile.".to_string())?;

    let affected_documents = documents_for(owner)
        .into_iter()
        .filter(|document| {
            document.status == DocumentStatus::Processed
                && category_matches_document(&category, document)
        })
        .collect::<Vec<_>>();

    for mut document in affected_documents {
        document.category_id = Some(replacement.id.clone());
        document.category_name = replacement.name.clone();
        document.updated_at_ns = now_ns();
        save_document(&document);
    }

    CATEGORIES.with(|categories| {
        categories
            .borrow_mut()
            .remove(&category_key(owner, &category_id))
    });

    Ok(())
}

#[query]
fn list_my_notes() -> Vec<NoteRecord> {
    let owner = match caller() {
        Ok(owner) => owner,
        Err(_) => return vec![],
    };
    notes_for(owner)
}

#[update]
fn upsert_note(
    id: Option<String>,
    title: String,
    encrypted_content: Vec<u8>,
    pinned: bool,
) -> Result<NoteRecord, String> {
    let owner = caller()?;
    let now = now_ns();
    let trimmed_title = title.trim();
    if trimmed_title.is_empty() {
        return Err("Il titolo della nota non può essere vuoto.".to_string());
    }

    let note = if let Some(existing_id) = id.filter(|value| !value.trim().is_empty()) {
        let key = note_key(owner, &existing_id);
        if let Some(mut record) = NOTES.with(|notes| {
            notes
                .borrow()
                .get(&key)
                .map(|bytes| decode::<NoteRecord>(&bytes))
        }) {
            record.title = trimmed_title.to_string();
            record.encrypted_content = encrypted_content;
            record.pinned = pinned;
            record.updated_at_ns = now;
            record
        } else {
            NoteRecord {
                id: existing_id,
                owner,
                title: trimmed_title.to_string(),
                encrypted_content,
                pinned,
                created_at_ns: now,
                updated_at_ns: now,
            }
        }
    } else {
        NoteRecord {
            id: format!("note_{}", now),
            owner,
            title: trimmed_title.to_string(),
            encrypted_content,
            pinned,
            created_at_ns: now,
            updated_at_ns: now,
        }
    };

    save_note(&note);
    Ok(note)
}

#[update]
fn delete_note(note_id: String) -> Result<(), String> {
    let owner = caller()?;
    let key = note_key(owner, &note_id);
    let existed = NOTES.with(|notes| notes.borrow().contains_key(&key));
    if !existed {
        return Ok(());
    }

    NOTES.with(|notes| notes.borrow_mut().remove(&key));
    Ok(())
}

#[query]
fn list_my_postits() -> Vec<PostItRecord> {
    let owner = match caller() {
        Ok(owner) => owner,
        Err(_) => return vec![],
    };
    postits_for(owner)
}

#[update]
fn upsert_postit(
    id: Option<String>,
    encrypted_text: Vec<u8>,
    completed: bool,
    color: String,
) -> Result<PostItRecord, String> {
    let owner = caller()?;
    let now = now_ns();
    let trimmed_color = color.trim();
    if trimmed_color.is_empty() {
        return Err("Il colore del post-it non può essere vuoto.".to_string());
    }

    let postit = if let Some(existing_id) = id.filter(|value| !value.trim().is_empty()) {
        let key = postit_key(owner, &existing_id);
        if let Some(mut record) = POSTITS.with(|postits| {
            postits
                .borrow()
                .get(&key)
                .map(|bytes| decode::<PostItRecord>(&bytes))
        }) {
            record.encrypted_text = encrypted_text;
            record.completed = completed;
            record.color = trimmed_color.to_string();
            record.updated_at_ns = now;
            record
        } else {
            PostItRecord {
                id: existing_id,
                owner,
                encrypted_text,
                completed,
                color: trimmed_color.to_string(),
                created_at_ns: now,
                updated_at_ns: now,
            }
        }
    } else {
        PostItRecord {
            id: format!("postit_{}", now),
            owner,
            encrypted_text,
            completed,
            color: trimmed_color.to_string(),
            created_at_ns: now,
            updated_at_ns: now,
        }
    };

    save_postit(&postit);
    Ok(postit)
}

#[update]
fn delete_postit(postit_id: String) -> Result<(), String> {
    let owner = caller()?;
    let key = postit_key(owner, &postit_id);
    let existed = POSTITS.with(|postits| postits.borrow().contains_key(&key));
    if !existed {
        return Ok(());
    }

    POSTITS.with(|postits| postits.borrow_mut().remove(&key));
    Ok(())
}

#[update]
fn list_my_documents() -> Vec<DocumentRecord> {
    let owner = match caller() {
        Ok(owner) => owner,
        Err(_) => return vec![],
    };
    documents_for(owner)
}

#[update]
fn list_my_activities(limit: Option<u32>) -> Vec<ActivityRecord> {
    let owner = match caller() {
        Ok(owner) => owner,
        Err(_) => return vec![],
    };
    activities_for(owner, limit)
}

#[update]
fn get_my_vault_counts() -> VaultCountsResponse {
    let owner = match caller() {
        Ok(owner) => owner,
        Err(_) => {
            return VaultCountsResponse {
                processed_documents: 0,
                due_documents: 0,
                paid_documents: 0,
                notes_count: 0,
                postits_count: 0,
            };
        }
    };

    let summary_input = build_vault_summary_input(owner);
    VaultCountsResponse {
        processed_documents: summary_input.processed_documents as u64,
        due_documents: summary_input.due_documents as u64,
        paid_documents: summary_input.paid_documents as u64,
        notes_count: summary_input.notes_count as u64,
        postits_count: summary_input.postits_count as u64,
    }
}

#[update]
fn cleanup_my_orphan_documents() -> u64 {
    let owner = match caller() {
        Ok(owner) => owner,
        Err(_) => return 0,
    };

    let now = now_ns();
    let orphan_ids: Vec<String> = documents_for(owner)
        .into_iter()
        .filter(|document| is_orphan_processed_document(document, now))
        .map(|document| document.id)
        .collect();

    if orphan_ids.is_empty() {
        return 0;
    }

    DOCUMENTS.with(|documents| {
        let mut documents = documents.borrow_mut();
        for document_id in &orphan_ids {
            documents.remove(&document_key(owner, document_id));
        }
    });

    orphan_ids.len() as u64
}

#[update]
fn list_my_notifications() -> Vec<NotificationViewRecord> {
    let owner = match caller() {
        Ok(owner) => owner,
        Err(_) => return vec![],
    };

    visible_notifications_for(owner, now_ns())
}

#[update]
fn get_my_notification_access_state() -> NotificationAccessState {
    let principal = match caller() {
        Ok(principal) => principal,
        Err(_) => {
            return NotificationAccessState {
                can_publish: false,
                has_admins: notification_admins_count() > 0,
            }
        }
    };

    NotificationAccessState {
        can_publish: principal == owner_principal().unwrap_or(Principal::anonymous())
            || is_notification_admin(principal),
        has_admins: notification_admins_count() > 0,
    }
}

#[update]
fn mark_my_notifications_seen() -> Vec<NotificationViewRecord> {
    let owner = match caller() {
        Ok(owner) => owner,
        Err(_) => return vec![],
    };

    let now = now_ns();
    for notification in notification_broadcasts() {
        let Some(receipt) = notification_receipt_for(owner, &notification.id) else {
            save_notification_receipt(&NotificationReceiptRecord {
                id: format!("receipt_{}_{}", owner.to_text(), notification.id),
                owner,
                notification_id: notification.id,
                read_at_ns: now,
            });
            continue;
        };

        if receipt.read_at_ns.saturating_add(NOTIFICATION_HIDE_AFTER_READ_NS) <= now {
            NOTIFICATION_RECEIPTS.with(|receipts| {
                receipts
                    .borrow_mut()
                    .remove(&notification_receipt_key(owner, &notification.id));
            });
        }
    }

    visible_notifications_for(owner, now)
}

#[update]
fn publish_broadcast_notification(title: String, body: String) -> Result<NotificationBroadcastRecord, String> {
    let _publisher = require_notification_publisher()?;
    let title = title.trim().to_string();
    let body = body.trim().to_string();

    if title.is_empty() {
        return Err("Titolo notifica obbligatorio.".to_string());
    }

    if body.is_empty() {
        return Err("Testo notifica obbligatorio.".to_string());
    }

    let created_at_ns = now_ns();
    let notification = NotificationBroadcastRecord {
        id: format!("notification_{created_at_ns}"),
        title,
        body,
        created_at_ns,
    };

    NOTIFICATIONS.with(|notifications| {
        notifications
            .borrow_mut()
            .insert(notification.id.clone(), encode(&notification));
    });

    Ok(notification)
}

#[update]
fn add_notification_admin(principal: Principal) -> Result<(), String> {
    let _owner = require_owner()?;
    insert_notification_admin(principal);
    Ok(())
}

#[update]
fn upsert_document(input: DocumentUpsertInput) -> Result<DocumentRecord, String> {
    let owner = caller()?;
    let now = now_ns();

    let next_id = input
        .id
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| format!("doc_{}", now));
    let key = document_key(owner, &next_id);
    let existing = DOCUMENTS.with(|documents| {
        documents
            .borrow()
            .get(&key)
            .map(|bytes| decode::<DocumentRecord>(&bytes))
    });

    let created_at_ns = existing
        .as_ref()
        .map(|document| document.created_at_ns)
        .or(input.created_at_ns)
        .unwrap_or(now);

    let mut document = DocumentRecord {
        id: next_id.clone(),
        owner,
        name: input.name.trim().to_string(),
        size_bytes: input.size_bytes,
        mime_type: input.mime_type.trim().to_string(),
        original_blob_id: normalize_option_text(input.original_blob_id),
        preview_blob_id: normalize_option_text(input.preview_blob_id),
        category_id: normalize_option_text(input.category_id),
        category_name: {
            let trimmed = input.category_name.trim();
            if trimmed.is_empty() {
                "Altro".to_string()
            } else {
                trimmed.to_string()
            }
        },
        title: {
            let trimmed = input.title.trim();
            if trimmed.is_empty() {
                input.name.trim().to_string()
            } else {
                trimmed.to_string()
            }
        },
        status: input.status,
        document_date: normalize_option_text(input.document_date),
        tags: sanitize_tags(input.tags),
        notes: normalize_option_text(input.notes),
        merchant_name: normalize_option_text(input.merchant_name),
        amount: input.amount,
        payment_status: input.payment_status,
        has_expiry: input.has_expiry,
        expiry_date: normalize_option_text(input.expiry_date),
        expiry_type: normalize_option_text(input.expiry_type),
        expiry_duration: normalize_option_text(input.expiry_duration),
        crypto_state: input.crypto_state,
        invoice_data: input.invoice_data,
        warranty_data: input.warranty_data,
        created_at_ns,
        updated_at_ns: now,
    };

    if document.name.is_empty() {
        return Err("Il nome del documento non può essere vuoto.".to_string());
    }

    if document.size_bytes == 0 {
        return Err("Il documento non puÃ² essere vuoto.".to_string());
    }

    if document.size_bytes > MAX_DOCUMENT_FILE_BYTES {
        return Err("Ogni file puÃ² pesare al massimo 5 MB.".to_string());
    }

    let next_total_bytes =
        documents_total_bytes(owner, Some(&next_id)).saturating_add(document.size_bytes);
    if next_total_bytes > MAX_VAULT_TOTAL_BYTES {
        return Err(
            "Hai raggiunto il limite del vault personale di 5 GB. Elimina qualche file prima di continuare."
                .to_string(),
        );
    }

    let activity_type = match (&existing, &document.status) {
        (None, DocumentStatus::Inbox) => ActivityType::Uploaded,
        (None, DocumentStatus::Processed) => ActivityType::Processed,
        (Some(previous), DocumentStatus::Processed) if previous.status != DocumentStatus::Processed => {
            ActivityType::Processed
        }
        _ => ActivityType::Updated,
    };

    if document.category_id.is_none() {
        document.category_name = document.category_name.trim().to_string();
    }

    save_document(&document);
    append_activity(owner, activity_type, &document);

    Ok(document)
}

#[update]
async fn generate_my_ai_summary() -> Result<OnchainVaultSummaryResponse, String> {
    let owner = caller()?;
    let summary_input = build_vault_summary_input(owner);

    if summary_input.processed_documents == 0
        && summary_input.notes_count == 0
        && summary_input.postits_count == 0
    {
        return Err("Non ci sono ancora dati sufficienti nel vault per generare un riepilogo.".to_string());
    }

    let compact_json = serde_json::to_string(&summary_input)
        .map_err(|_| "Impossibile preparare il contesto del riepilogo AI.".to_string())?;

    let system_prompt = "Sei un assistente amministrativo per un archivio documentale italiano. Riceverai solo dati strutturati del vault di un utente. Restituisci solo JSON valido con questa forma: {\"summary\": string, \"highlights\": string[]}. Il summary deve essere breve, in italiano, utile e concreto. Gli highlights devono essere massimo 4 punti, ciascuno molto breve. Non inventare dati. Se un importo non è presente, non citarlo.";
    let user_prompt = format!(
        "Genera un riepilogo operativo del vault dell'utente. Evidenzia solo elementi utili come volumi documenti, categorie prevalenti, importi totali quando presenti, documenti da pagare, fatture, garanzie e attività recenti. Dati strutturati:\n{}",
        compact_json
    );

    let llm_canister =
        Principal::from_text(LLM_CANISTER_ID).map_err(|_| "Canister LLM non valido.".to_string())?;
    let request = LlmChatRequest {
        model: LLM_MODEL_NAME.to_string(),
        messages: vec![
            LlmChatMessage::System {
                content: system_prompt.to_string(),
            },
            LlmChatMessage::User {
                content: user_prompt,
            },
        ],
        tools: None,
    };

    let response: LlmChatResponse = Call::unbounded_wait(llm_canister, "v1_chat")
        .with_arg(request)
        .await
        .map_err(|error| format!("Chiamata LLM on-chain fallita: {error}"))?
        .candid()
        .map_err(|error| format!("Risposta LLM on-chain non decodificabile: {error}"))?;

    let raw_content = response.message.content.unwrap_or_default();
    let json_slice = parse_json_object_slice(&raw_content)
        .ok_or_else(|| "Risposta LLM on-chain non valida.".to_string())?;
    let parsed: LlmVaultSummaryJson =
        serde_json::from_str(json_slice).map_err(|_| "JSON riepilogo AI non valido.".to_string())?;

    let summary = parsed.summary.trim().to_string();
    if summary.is_empty() {
        return Err("Il riepilogo AI non contiene testo utile.".to_string());
    }

    Ok(OnchainVaultSummaryResponse {
        provider: "ic-onchain".to_string(),
        model: LLM_MODEL_NAME.to_string(),
        summary,
        highlights: parsed
            .highlights
            .into_iter()
            .map(|item| item.trim().to_string())
            .filter(|item| !item.is_empty())
            .take(4)
            .collect(),
        generated_at_ns: now_ns(),
    })
}

#[update]
async fn ask_my_ai_vault(question: String) -> Result<OnchainVaultChatResponse, String> {
    let owner = caller()?;
    let trimmed_question = question.trim().to_string();
    if trimmed_question.is_empty() {
        return Err("Scrivi una domanda per la chat AI.".to_string());
    }

    let summary_input = build_vault_summary_input(owner);
    if summary_input.processed_documents == 0
        && summary_input.notes_count == 0
        && summary_input.postits_count == 0
    {
        return Err("Non ci sono ancora dati sufficienti nel vault per rispondere.".to_string());
    }

    increment_daily_ai_chat_usage(owner)?;

    let processed_documents: Vec<DocumentRecord> = documents_for(owner)
        .into_iter()
        .filter(|document| document.status == DocumentStatus::Processed)
        .collect();

    if question_mentions_warranty(&trimmed_question) {
        let warranty_docs: Vec<&SummaryDocumentItem> = summary_input
            .recent_documents
            .iter()
            .filter(|document| document.category_name.eq_ignore_ascii_case("garanzia"))
            .collect();

        let answer = if summary_input.warranty_documents == 0 || warranty_docs.is_empty() {
            "Non risultano garanzie archiviate nel vault in questo momento.".to_string()
        } else {
            let titles = warranty_docs
                .iter()
                .map(|document| document.title.clone())
                .collect::<Vec<_>>()
                .join(", ");
            format!(
                "Risultano {} garanzie archiviate nel vault. Le più recenti sono: {}.",
                summary_input.warranty_documents, titles
            )
        };

        return Ok(OnchainVaultChatResponse {
            provider: "ic-onchain".to_string(),
            model: LLM_MODEL_NAME.to_string(),
            answer,
            generated_at_ns: now_ns(),
        });
    }

    if question_mentions_hosting(&trimmed_question) {
        let hosting_docs: Vec<&DocumentRecord> = processed_documents
            .iter()
            .filter(|document| document_matches_hosting(document))
            .collect();

        let answer = if hosting_docs.is_empty() {
            "Non risultano documenti riconducibili a hosting, server o domini nel vault.".to_string()
        } else {
            let total = hosting_docs
                .iter()
                .filter_map(|document| document_effective_amount(document))
                .sum::<f64>();
            let has_total = hosting_docs
                .iter()
                .any(|document| document_effective_amount(document).is_some());
            let titles = hosting_docs
                .iter()
                .take(4)
                .map(|document| {
                    let base = if document.title.trim().is_empty() {
                        document.name.clone()
                    } else {
                        document.title.clone()
                    };
                    match document_effective_amount(document) {
                        Some(amount) => format!("{base} ({})", format_amount_eur(amount)),
                        None => base,
                    }
                })
                .collect::<Vec<_>>()
                .join(", ");

            if has_total {
                format!(
                    "Risultano {} documenti collegati a hosting o server, per un totale di {}. I principali sono: {}.",
                    hosting_docs.len(),
                    format_amount_eur(total),
                    titles
                )
            } else {
                format!(
                    "Risultano {} documenti collegati a hosting o server. I principali sono: {}.",
                    hosting_docs.len(),
                    titles
                )
            }
        };

        return Ok(OnchainVaultChatResponse {
            provider: "ic-onchain".to_string(),
            model: LLM_MODEL_NAME.to_string(),
            answer,
            generated_at_ns: now_ns(),
        });
    }

    if question_mentions_vat(&trimmed_question) {
        let vat_docs: Vec<&DocumentRecord> = processed_documents
            .iter()
            .filter(|document| {
                document
                    .invoice_data
                    .as_ref()
                    .and_then(|invoice| invoice.vat_amount)
                    .is_some()
            })
            .collect();

        let total_vat = vat_docs
            .iter()
            .filter_map(|document| document.invoice_data.as_ref().and_then(|invoice| invoice.vat_amount))
            .sum::<f64>();
        let total_net = vat_docs
            .iter()
            .filter_map(|document| document.invoice_data.as_ref().and_then(|invoice| invoice.net_amount))
            .sum::<f64>();

        let answer = if vat_docs.is_empty() {
            "Non risultano ancora fatture con IVA valorizzata nel vault.".to_string()
        } else {
            format!(
                "Sulle fatture con IVA valorizzata risultano {} documenti, con imponibile totale di {} e IVA totale di {}.",
                vat_docs.len(),
                format_amount_eur(total_net),
                format_amount_eur(total_vat)
            )
        };

        return Ok(OnchainVaultChatResponse {
            provider: "ic-onchain".to_string(),
            model: LLM_MODEL_NAME.to_string(),
            answer,
            generated_at_ns: now_ns(),
        });
    }

    if question_mentions_expiry(&trimmed_question) {
        let expiring_docs: Vec<&DocumentRecord> = processed_documents
            .iter()
            .filter(|document| document.has_expiry && document.expiry_date.is_some())
            .collect();

        let answer = if expiring_docs.is_empty() {
            "Non risultano documenti con scadenza valorizzata nel vault.".to_string()
        } else {
            let titles = expiring_docs
                .iter()
                .take(4)
                .map(|document| {
                    let base = if document.title.trim().is_empty() {
                        document.name.clone()
                    } else {
                        document.title.clone()
                    };
                    match document.expiry_date.as_deref() {
                        Some(expiry_date) => format!("{base} (scadenza {expiry_date})"),
                        None => base,
                    }
                })
                .collect::<Vec<_>>()
                .join(", ");

            format!(
                "Risultano {} documenti con scadenza valorizzata. I principali sono: {}.",
                expiring_docs.len(),
                titles
            )
        };

        return Ok(OnchainVaultChatResponse {
            provider: "ic-onchain".to_string(),
            model: LLM_MODEL_NAME.to_string(),
            answer,
            generated_at_ns: now_ns(),
        });
    }

    if question_mentions_due_documents(&trimmed_question) {
        let due_docs: Vec<&SummaryDocumentItem> = summary_input
            .recent_documents
            .iter()
            .filter(|document| document.payment_status == "due")
            .collect();

        let answer = if summary_input.due_documents == 0 {
            "Non risultano documenti da pagare nel vault in questo momento.".to_string()
        } else if due_docs.is_empty() {
            match summary_input.total_due_amount {
                Some(total_due) => format!(
                    "Risultano {} documenti da pagare, per un totale di {}.",
                    summary_input.due_documents,
                    format_amount_eur(total_due)
                ),
                None => format!(
                    "Risultano {} documenti da pagare nel vault.",
                    summary_input.due_documents
                ),
            }
        } else {
            let titles = due_docs
                .iter()
                .map(|document| match document.amount {
                    Some(amount) => format!("{} ({})", document.title, format_amount_eur(amount)),
                    None => document.title.clone(),
                })
                .collect::<Vec<_>>()
                .join(", ");

            match summary_input.total_due_amount {
                Some(total_due) => format!(
                    "Risultano {} documenti da pagare, per un totale di {}. I principali sono: {}.",
                    summary_input.due_documents,
                    format_amount_eur(total_due),
                    titles
                ),
                None => format!(
                    "Risultano {} documenti da pagare. I principali sono: {}.",
                    summary_input.due_documents, titles
                ),
            }
        };

        return Ok(OnchainVaultChatResponse {
            provider: "ic-onchain".to_string(),
            model: LLM_MODEL_NAME.to_string(),
            answer,
            generated_at_ns: now_ns(),
        });
    }

    let compact_json = serde_json::to_string(&summary_input)
        .map_err(|_| "Impossibile preparare il contesto della chat AI.".to_string())?;

    let system_prompt = "Sei un assistente amministrativo per un archivio documentale italiano. Riceverai solo dati strutturati del vault di un utente e una domanda. Rispondi in italiano, in modo breve e concreto, usando solo i dati disponibili. Se l'informazione non è disponibile, dillo chiaramente. Restituisci solo JSON valido con questa forma: {\"answer\": string}.";
    let user_prompt = format!(
        "Dati strutturati del vault:\n{}\n\nDomanda utente:\n{}",
        compact_json, trimmed_question
    );

    let llm_canister =
        Principal::from_text(LLM_CANISTER_ID).map_err(|_| "Canister LLM non valido.".to_string())?;
    let request = LlmChatRequest {
        model: LLM_MODEL_NAME.to_string(),
        messages: vec![
            LlmChatMessage::System {
                content: system_prompt.to_string(),
            },
            LlmChatMessage::User {
                content: user_prompt,
            },
        ],
        tools: None,
    };

    let response: LlmChatResponse = Call::unbounded_wait(llm_canister, "v1_chat")
        .with_arg(request)
        .await
        .map_err(|error| format!("Chiamata LLM on-chain fallita: {error}"))?
        .candid()
        .map_err(|error| format!("Risposta LLM on-chain non decodificabile: {error}"))?;

    let raw_content = response.message.content.unwrap_or_default();
    let json_slice =
        parse_json_object_slice(&raw_content).ok_or_else(|| "Risposta chat AI non valida.".to_string())?;
    let parsed: LlmVaultChatJson =
        serde_json::from_str(json_slice).map_err(|_| "JSON chat AI non valido.".to_string())?;

    let answer = parsed.answer.trim().to_string();
    if answer.is_empty() {
        return Err("La chat AI non ha restituito una risposta utile.".to_string());
    }

    Ok(OnchainVaultChatResponse {
        provider: "ic-onchain".to_string(),
        model: LLM_MODEL_NAME.to_string(),
        answer,
        generated_at_ns: now_ns(),
    })
}

#[update]
fn delete_document(document_id: String) -> Result<(), String> {
    let owner = caller()?;
    let key = document_key(owner, &document_id);
    let document = DOCUMENTS.with(|documents| {
        documents
            .borrow()
            .get(&key)
            .map(|bytes| decode::<DocumentRecord>(&bytes))
    });

    let document = document.ok_or_else(|| "Documento non trovato.".to_string())?;

    DOCUMENTS.with(|documents| documents.borrow_mut().remove(&key));
    append_activity(owner, ActivityType::Deleted, &document);
    Ok(())
}

ic_cdk::export_candid!();
