use candid::{decode_one, encode_one, CandidType, Principal};
use fatturavault_shared::{
    InboxAiUpdateInput, InboxDocumentRecord, InboxDocumentStatus, InboxDocumentUpsertInput,
};
use ic_cdk::{init, post_upgrade, update};
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, StableBTreeMap,
};
use serde::de::DeserializeOwned;
use std::cell::RefCell;

type Memory = VirtualMemory<DefaultMemoryImpl>;

const INBOX_DOCUMENTS_MEMORY_ID: MemoryId = MemoryId::new(0);

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
        error_message: existing
            .as_ref()
            .and_then(|record| record.error_message.clone()),
        created_at_ns,
        updated_at_ns: now,
        expires_at_ns: input.expires_at_ns.or(existing.as_ref().and_then(|record| record.expires_at_ns)),
        archived_at_ns: existing.and_then(|record| record.archived_at_ns),
    };

    if document.name.is_empty() {
        return Err("Il nome del documento inbox non può essere vuoto.".to_string());
    }

    if document.mime_type.is_empty() {
        return Err("Il mime type del documento inbox non può essere vuoto.".to_string());
    }

    save_inbox_document(&document);
    Ok(document)
}

#[update]
fn update_inbox_ai_state(input: InboxAiUpdateInput) -> Result<InboxDocumentRecord, String> {
    let owner = caller()?;
    let mut document = inbox_document_for(owner, &input.document_id)
        .ok_or_else(|| "Documento inbox non trovato.".to_string())?;

    document.status = input.status;
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
    document.error_message = normalize_option_text(input.error_message);
    document.updated_at_ns = now_ns();

    save_inbox_document(&document);
    Ok(document)
}

#[update]
fn mark_inbox_document_archived(document_id: String, archived_at_ns: Option<u64>) -> Result<InboxDocumentRecord, String> {
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
