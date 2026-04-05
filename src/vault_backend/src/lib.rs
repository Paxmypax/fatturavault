use candid::{decode_one, encode_one, CandidType, Principal};
use fatturavault_shared::{
    default_categories_for, default_security_state, ActivityRecord, ActivityType, CategoryRecord,
    DocumentRecord, DocumentStatus, DocumentUpsertInput, NoteRecord, PostItRecord, SecurityState,
    UserProfile, VetKeyConfigRecord,
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
use serde::Deserialize;
use std::cell::RefCell;

type Memory = VirtualMemory<DefaultMemoryImpl>;

const PROFILES_MEMORY_ID: MemoryId = MemoryId::new(0);
const CATEGORIES_MEMORY_ID: MemoryId = MemoryId::new(1);
const NOTES_MEMORY_ID: MemoryId = MemoryId::new(2);
const POSTITS_MEMORY_ID: MemoryId = MemoryId::new(3);
const DOCUMENTS_MEMORY_ID: MemoryId = MemoryId::new(4);
const ACTIVITIES_MEMORY_ID: MemoryId = MemoryId::new(5);
const VETKEY_CONTEXT: &[u8] = b"fatturavault-user-wrap-v1";
const VETKEY_AES_DOMAIN: &str = "fatturavault-document-wrap-aes-v1";
const VETKEY_KEY_NAME: &str = "test_key_1";
const VETKEY_DERIVE_KEY_CYCLES: u128 = 10_000_000_000;

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

fn encode<T: CandidType>(value: &T) -> Vec<u8> {
    encode_one(value).expect("failed to encode value")
}

fn decode<T: DeserializeOwned + CandidType>(bytes: &[u8]) -> T {
    decode_one(bytes).expect("failed to decode value")
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
