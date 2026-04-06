use candid::{decode_one, encode_one, CandidType, Principal};
use fatturavault_shared::{
    InboxAiUpdateInput, InboxDocumentRecord, InboxDocumentStatus, InboxDocumentUpsertInput,
    InboxLlmInvoiceDataRecord, InboxLlmLineItemRecord, InboxOnchainLlmRequest,
    InboxOnchainLlmResponse, PaymentStatus,
};
use ic_cdk::call::Call;
use ic_cdk::{init, post_upgrade, update};
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, StableBTreeMap,
};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;

type Memory = VirtualMemory<DefaultMemoryImpl>;

const INBOX_DOCUMENTS_MEMORY_ID: MemoryId = MemoryId::new(0);
const LLM_CANISTER_ID: &str = "w36hm-eqaaa-aaaal-qr76a-cai";
const LLM_MODEL_NAME: &str = "llama3.1:8b";
const MAX_DOCUMENT_FILE_BYTES: u64 = 5 * 1024 * 1024;
const MAX_INBOX_TOTAL_BYTES: u64 = 500 * 1024 * 1024;

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static INBOX_DOCUMENTS: RefCell<StableBTreeMap<String, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|manager| manager.borrow().get(INBOX_DOCUMENTS_MEMORY_ID))
        ));
}

#[init]
fn init() {}

#[post_upgrade]
fn post_upgrade() {}

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

fn encode<T: CandidType>(value: &T) -> Vec<u8> {
    encode_one(value).expect("failed to encode value")
}

fn decode<T: DeserializeOwned + CandidType>(bytes: &[u8]) -> T {
    decode_one(bytes).expect("failed to decode value")
}

fn inbox_document_key(owner: Principal, document_id: &str) -> String {
    format!("{}::{}", owner.to_text(), document_id)
}

fn save_inbox_document(document: &InboxDocumentRecord) {
    INBOX_DOCUMENTS.with(|documents| {
        documents
            .borrow_mut()
            .insert(inbox_document_key(document.owner, &document.id), encode(document))
    });
}

fn inbox_documents_for(owner: Principal) -> Vec<InboxDocumentRecord> {
    let prefix = format!("{}::", owner.to_text());
    let mut items: Vec<InboxDocumentRecord> = INBOX_DOCUMENTS.with(|documents| {
        documents
            .borrow()
            .iter()
            .filter_map(|entry| {
                let key = entry.key();
                if key.starts_with(&prefix) {
                    Some(decode::<InboxDocumentRecord>(&entry.value()))
                } else {
                    None
                }
            })
            .collect()
    });

    items.sort_by(|a, b| b.updated_at_ns.cmp(&a.updated_at_ns));
    items
}

fn inbox_document_for(owner: Principal, document_id: &str) -> Option<InboxDocumentRecord> {
    INBOX_DOCUMENTS.with(|documents| {
        documents
            .borrow()
            .get(&inbox_document_key(owner, document_id))
            .map(|bytes| decode::<InboxDocumentRecord>(&bytes))
    })
}

fn active_inbox_total_bytes(owner: Principal, excluding_document_id: Option<&str>) -> u64 {
    inbox_documents_for(owner)
        .into_iter()
        .filter(|document| document.status != InboxDocumentStatus::Archived)
        .filter(|document| excluding_document_id != Some(document.id.as_str()))
        .map(|document| document.size_bytes)
        .sum()
}

fn normalize_option_text(value: Option<String>) -> Option<String> {
    value.and_then(|text| {
        let trimmed = text.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn limit_text(value: &str, max_len: usize) -> String {
    value.chars().take(max_len).collect::<String>()
}

fn sanitize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|text| {
        let trimmed = text.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct LlmLineItem {
    description: String,
    amount: Option<f64>,
    vat_rate: Option<f64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct LlmInvoiceData {
    invoice_type: Option<String>,
    invoice_number: Option<String>,
    supplier: Option<String>,
    vat_number: Option<String>,
    net_amount: Option<f64>,
    vat_rate: Option<f64>,
    vat_amount: Option<f64>,
    total_amount: Option<f64>,
    line_items: Vec<LlmLineItem>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct LlmAnalysisResponse {
    title: Option<String>,
    category_name: Option<String>,
    tags: Vec<String>,
    document_date: Option<String>,
    merchant_name: Option<String>,
    amount: Option<f64>,
    payment_status: Option<String>,
    document_text_excerpt: Option<String>,
    invoice_data: Option<LlmInvoiceData>,
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

fn parse_json_object_slice(raw: &str) -> Option<&str> {
    let start = raw.find('{')?;
    let end = raw.rfind('}')?;
    (end > start).then_some(&raw[start..=end])
}

fn parse_payment_status(value: Option<String>) -> Option<PaymentStatus> {
    match value.as_deref().map(|v| v.trim().to_lowercase()) {
        Some(value) if value == "due" => Some(PaymentStatus::Due),
        Some(value) if value == "paid" => Some(PaymentStatus::Paid),
        _ => None,
    }
}

#[update]
async fn analyze_inbox_with_onchain_llm(
    input: InboxOnchainLlmRequest,
) -> Result<InboxOnchainLlmResponse, String> {
    let _original_caller = caller()?;

    let extracted_text = input.extracted_text.trim().to_string();
    if extracted_text.is_empty() {
        return Err("Il testo del documento è vuoto.".to_string());
    }

    let system_prompt = "Sei un assistente che analizza documenti amministrativi e fiscali italiani. Restituisci solo JSON valido. Non inventare dati: se un campo non è chiaro usa null o array vuoto. Usa solo queste categorie: Fattura, Ricevuta, Garanzia, Assicurazione, Auto, Abbonamento, Casa, Fiscale, Altro. Se riconosci una fattura o una ricevuta fiscale, compila anche invoice_data con invoice_type, invoice_number, supplier, vat_number, net_amount, vat_rate, vat_amount, total_amount e line_items.";
    let user_prompt = format!(
        "Analizza questo documento e restituisci solo un JSON con questa forma: {{\"title\":string|null,\"category_name\":string|null,\"tags\":string[],\"document_date\":string|null,\"merchant_name\":string|null,\"amount\":number|null,\"payment_status\":\"due\"|\"paid\"|null,\"document_text_excerpt\":string|null,\"invoice_data\":{{\"invoice_type\":\"ricevuta\"|\"emessa\"|null,\"invoice_number\":string|null,\"supplier\":string|null,\"vat_number\":string|null,\"net_amount\":number|null,\"vat_rate\":number|null,\"vat_amount\":number|null,\"total_amount\":number|null,\"line_items\":[{{\"description\":string,\"amount\":number|null,\"vat_rate\":number|null}}]}}|null }}.\nNome file: {}\nMime type: {}\nCategoria euristica: {}\nMerchant euristico: {}\nData euristica: {}\nImporto euristico: {}\nTesto documento:\n{}",
        input.file_name,
        input.mime_type,
        input.heuristic_category_name.clone().unwrap_or_default(),
        input.heuristic_merchant_name.clone().unwrap_or_default(),
        input.heuristic_document_date.clone().unwrap_or_default(),
        input.heuristic_amount.map(|v| v.to_string()).unwrap_or_default(),
        limit_text(&extracted_text, 9_000)
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
    let parsed: LlmAnalysisResponse =
        serde_json::from_str(json_slice).map_err(|_| "JSON LLM on-chain non valido.".to_string())?;

    Ok(InboxOnchainLlmResponse {
        provider: "ic-onchain".to_string(),
        model: LLM_MODEL_NAME.to_string(),
        title: sanitize_optional_text(parsed.title),
        category_name: sanitize_optional_text(parsed.category_name),
        tags: parsed
            .tags
            .into_iter()
            .map(|tag| tag.trim().to_lowercase())
            .filter(|tag| !tag.is_empty())
            .take(8)
            .collect(),
        document_date: sanitize_optional_text(parsed.document_date),
        merchant_name: sanitize_optional_text(parsed.merchant_name),
        amount: parsed.amount,
        payment_status: parse_payment_status(parsed.payment_status),
        document_text_excerpt: sanitize_optional_text(parsed.document_text_excerpt),
        invoice_data: parsed.invoice_data.map(|invoice| InboxLlmInvoiceDataRecord {
            invoice_type: sanitize_optional_text(invoice.invoice_type),
            invoice_number: sanitize_optional_text(invoice.invoice_number),
            supplier: sanitize_optional_text(invoice.supplier),
            vat_number: sanitize_optional_text(invoice.vat_number),
            net_amount: invoice.net_amount,
            vat_rate: invoice.vat_rate,
            vat_amount: invoice.vat_amount,
            total_amount: invoice.total_amount,
            line_items: invoice
                .line_items
                .into_iter()
                .filter(|item| !item.description.trim().is_empty())
                .map(|item| InboxLlmLineItemRecord {
                    description: item.description.trim().to_string(),
                    amount: item.amount,
                    vat_rate: item.vat_rate,
                })
                .collect(),
        }),
    })
}

#[update]
fn list_my_inbox_documents() -> Vec<InboxDocumentRecord> {
    let owner = match caller() {
        Ok(owner) => owner,
        Err(_) => return vec![],
    };

    inbox_documents_for(owner)
}

#[update]
fn get_my_inbox_document(document_id: String) -> Option<InboxDocumentRecord> {
    let owner = caller().ok()?;
    inbox_document_for(owner, &document_id)
}

#[update]
fn upsert_inbox_document(input: InboxDocumentUpsertInput) -> Result<InboxDocumentRecord, String> {
    let owner = caller()?;
    let now = now_ns();
    let document_id = input
        .id
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| format!("inbox_{}", now));

    let existing = inbox_document_for(owner, &document_id);
    let created_at_ns = existing
        .as_ref()
        .map(|record| record.created_at_ns)
        .or(input.created_at_ns)
        .unwrap_or(now);

    let document = InboxDocumentRecord {
        id: document_id,
        owner,
        name: input.name.trim().to_string(),
        size_bytes: input.size_bytes,
        mime_type: input.mime_type.trim().to_string(),
        source_blob_id: normalize_option_text(input.source_blob_id),
        preview_blob_id: normalize_option_text(input.preview_blob_id),
        status: input.status.unwrap_or(InboxDocumentStatus::Uploaded),
        analysis_status: existing
            .as_ref()
            .and_then(|record| record.analysis_status.clone()),
        ocr_text: existing.as_ref().and_then(|record| record.ocr_text.clone()),
        suggested_title: existing
            .as_ref()
            .and_then(|record| record.suggested_title.clone()),
        suggested_category_id: existing
            .as_ref()
            .and_then(|record| record.suggested_category_id.clone()),
        suggested_category_name: existing
            .as_ref()
            .and_then(|record| record.suggested_category_name.clone()),
        suggested_tags: existing
            .as_ref()
            .map(|record| record.suggested_tags.clone())
            .unwrap_or_default(),
        extracted_payload_json: existing
            .as_ref()
            .and_then(|record| record.extracted_payload_json.clone()),
        extracted_document_date: existing
            .as_ref()
            .and_then(|record| record.extracted_document_date.clone()),
        extracted_merchant_name: existing
            .as_ref()
            .and_then(|record| record.extracted_merchant_name.clone()),
        extracted_amount: existing
            .as_ref()
            .and_then(|record| record.extracted_amount),
        extracted_payment_status: existing
            .as_ref()
            .and_then(|record| record.extracted_payment_status.clone()),
        error_message: existing
            .as_ref()
            .and_then(|record| record.error_message.clone()),
        analysis_updated_at_ns: existing
            .as_ref()
            .and_then(|record| record.analysis_updated_at_ns),
        created_at_ns,
        updated_at_ns: now,
        expires_at_ns: input
            .expires_at_ns
            .or(existing.as_ref().and_then(|record| record.expires_at_ns)),
        archived_at_ns: existing.and_then(|record| record.archived_at_ns),
    };

    if document.name.is_empty() {
        return Err("Il nome del documento inbox non può essere vuoto.".to_string());
    }

    if document.mime_type.is_empty() {
        return Err("Il mime type del documento inbox non può essere vuoto.".to_string());
    }

    if document.size_bytes == 0 {
        return Err("Il file inbox non puÃ² essere vuoto.".to_string());
    }

    if document.size_bytes > MAX_DOCUMENT_FILE_BYTES {
        return Err("Ogni file puÃ² pesare al massimo 5 MB.".to_string());
    }

    let next_total_bytes =
        active_inbox_total_bytes(owner, Some(&document.id)).saturating_add(document.size_bytes);
    if next_total_bytes > MAX_INBOX_TOTAL_BYTES {
        return Err(
            "Hai raggiunto il limite della inbox temporanea di 500 MB. Elimina o archivia qualche file prima di continuare."
                .to_string(),
        );
    }

    save_inbox_document(&document);
    Ok(document)
}

#[update]
fn update_inbox_ai_state(input: InboxAiUpdateInput) -> Result<InboxDocumentRecord, String> {
    let owner = caller()?;
    let now = now_ns();
    let mut document = inbox_document_for(owner, &input.document_id)
        .ok_or_else(|| "Documento inbox non trovato.".to_string())?;

    document.status = input.status;
    document.analysis_status = input.analysis_status;
    document.ocr_text = normalize_option_text(input.ocr_text);
    document.suggested_title = normalize_option_text(input.suggested_title);
    document.suggested_category_id = normalize_option_text(input.suggested_category_id);
    document.suggested_category_name = normalize_option_text(input.suggested_category_name);
    document.suggested_tags = input
        .suggested_tags
        .into_iter()
        .map(|tag| tag.trim().to_string())
        .filter(|tag| !tag.is_empty())
        .collect();
    document.extracted_payload_json = normalize_option_text(input.extracted_payload_json);
    document.extracted_document_date = normalize_option_text(input.extracted_document_date);
    document.extracted_merchant_name = normalize_option_text(input.extracted_merchant_name);
    document.extracted_amount = input.extracted_amount;
    document.extracted_payment_status = input.extracted_payment_status;
    document.error_message = normalize_option_text(input.error_message);
    document.analysis_updated_at_ns = Some(now);
    document.updated_at_ns = now;

    save_inbox_document(&document);
    Ok(document)
}

#[update]
fn mark_inbox_document_archived(
    document_id: String,
    archived_at_ns: Option<u64>,
) -> Result<InboxDocumentRecord, String> {
    let owner = caller()?;
    let mut document = inbox_document_for(owner, &document_id)
        .ok_or_else(|| "Documento inbox non trovato.".to_string())?;

    document.status = InboxDocumentStatus::Archived;
    document.archived_at_ns = Some(archived_at_ns.unwrap_or_else(now_ns));
    document.updated_at_ns = now_ns();

    save_inbox_document(&document);
    Ok(document)
}

#[update]
fn delete_inbox_document(document_id: String) -> Result<(), String> {
    let owner = caller()?;

    INBOX_DOCUMENTS.with(|documents| {
        documents
            .borrow_mut()
            .remove(&inbox_document_key(owner, &document_id))
    });

    Ok(())
}

#[update]
fn purge_my_expired_inbox_documents(limit: Option<u32>) -> u32 {
    let owner = match caller() {
        Ok(owner) => owner,
        Err(_) => return 0,
    };

    let now = now_ns();
    let max_items = limit.unwrap_or(100) as usize;
    let candidates = inbox_documents_for(owner);
    let mut removed = 0u32;

    for document in candidates.into_iter().take(max_items) {
        if document
            .expires_at_ns
            .map(|expires_at| expires_at <= now)
            .unwrap_or(false)
        {
            INBOX_DOCUMENTS.with(|documents| {
                documents
                    .borrow_mut()
                    .remove(&inbox_document_key(owner, &document.id))
            });
            removed += 1;
        }
    }

    removed
}

ic_cdk::export_candid!();
