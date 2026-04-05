use candid::{decode_one, encode_one, CandidType, Principal};
use fatturavault_shared::{
    BlobChunkInput, BlobChunkResult, BlobCreateInput, BlobKind, BlobManifest, BlobManifestResult,
    StorageError, StorageResult,
};
use ic_cdk::{init, post_upgrade, update};
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, StableBTreeMap,
};
use serde::de::DeserializeOwned;
use std::cell::RefCell;

type Memory = VirtualMemory<DefaultMemoryImpl>;

const MANIFESTS_MEMORY_ID: MemoryId = MemoryId::new(0);
const CHUNKS_MEMORY_ID: MemoryId = MemoryId::new(1);

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static MANIFESTS: RefCell<StableBTreeMap<String, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|manager| manager.borrow().get(MANIFESTS_MEMORY_ID))
        ));

    static CHUNKS: RefCell<StableBTreeMap<String, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|manager| manager.borrow().get(CHUNKS_MEMORY_ID))
        ));
}

#[init]
fn init() {}

#[post_upgrade]
fn post_upgrade() {}

fn now_ns() -> u64 {
    ic_cdk::api::time()
}

fn caller() -> Result<Principal, StorageError> {
    let caller = ic_cdk::api::msg_caller();
    if caller == Principal::anonymous() {
        return Err(StorageError::Unauthorized);
    }
    Ok(caller)
}

fn manifest_key(owner: Principal, blob_id: &str) -> String {
    format!("{}::{}", owner.to_text(), blob_id)
}

fn chunk_key(blob_id: &str, chunk_index: u32) -> String {
    format!("{}::{}", blob_id, chunk_index)
}

fn encode<T: CandidType>(value: &T) -> Vec<u8> {
    encode_one(value).expect("failed to encode value")
}

fn decode<T: DeserializeOwned + CandidType>(bytes: &[u8]) -> T {
    decode_one(bytes).expect("failed to decode value")
}

fn load_manifest(owner: Principal, blob_id: &str) -> Option<BlobManifest> {
    MANIFESTS.with(|manifests| {
        manifests
            .borrow()
            .get(&manifest_key(owner, blob_id))
            .map(|bytes| decode(&bytes))
    })
}

fn save_manifest(manifest: &BlobManifest) {
    MANIFESTS.with(|manifests| {
        manifests.borrow_mut().insert(
            manifest_key(manifest.owner, &manifest.blob_id),
            encode(manifest),
        )
    });
}

#[update]
fn create_blob(input: BlobCreateInput) -> BlobManifestResult {
    let owner = caller()?;
    if input.chunk_count == 0 {
        return Err(StorageError::InvalidState);
    }

    let now = now_ns();
    let blob_id = format!("blob_{}_{}", now, input.kind_label());
    let manifest = BlobManifest {
        blob_id,
        owner,
        document_id: input.document_id,
        kind: input.kind,
        mime_type: input.mime_type,
        total_size: input.total_size,
        chunk_count: input.chunk_count,
        sha256_hex: input.sha256_hex,
        created_at_ns: now,
        finalized: false,
    };

    save_manifest(&manifest);
    Ok(manifest)
}

#[update]
fn upload_blob_chunk(input: BlobChunkInput) -> StorageResult {
    let owner = caller()?;
    let manifest = load_manifest(owner, &input.blob_id).ok_or(StorageError::NotFound)?;

    if manifest.finalized {
        return Err(StorageError::InvalidState);
    }

    if input.chunk_index >= manifest.chunk_count {
        return Err(StorageError::InvalidChunkIndex);
    }

    CHUNKS.with(|chunks| {
        chunks
            .borrow_mut()
            .insert(chunk_key(&input.blob_id, input.chunk_index), input.bytes)
    });

    Ok(())
}

#[update]
fn finalize_blob(blob_id: String) -> StorageResult {
    let owner = caller()?;
    let mut manifest = load_manifest(owner, &blob_id).ok_or(StorageError::NotFound)?;

    if manifest.finalized {
        return Ok(());
    }

    let all_present = (0..manifest.chunk_count).all(|index| {
        CHUNKS.with(|chunks| chunks.borrow().contains_key(&chunk_key(&blob_id, index)))
    });

    if !all_present {
        return Err(StorageError::InvalidState);
    }

    manifest.finalized = true;
    save_manifest(&manifest);
    Ok(())
}

#[update]
fn get_blob_manifest(blob_id: String) -> Option<BlobManifest> {
    let owner = caller().ok()?;
    load_manifest(owner, &blob_id)
}

#[update]
fn get_blob_chunk(blob_id: String, chunk_index: u32) -> BlobChunkResult {
    let owner = caller()?;
    let manifest = load_manifest(owner, &blob_id).ok_or(StorageError::NotFound)?;

    if !manifest.finalized {
        return Err(StorageError::InvalidState);
    }

    CHUNKS
        .with(|chunks| chunks.borrow().get(&chunk_key(&blob_id, chunk_index)))
        .ok_or(StorageError::NotFound)
}

#[update]
fn delete_blob(blob_id: String) -> StorageResult {
    let owner = caller()?;
    let manifest = load_manifest(owner, &blob_id).ok_or(StorageError::NotFound)?;

    for index in 0..manifest.chunk_count {
        CHUNKS.with(|chunks| chunks.borrow_mut().remove(&chunk_key(&blob_id, index)));
    }

    MANIFESTS.with(|manifests| {
        manifests
            .borrow_mut()
            .remove(&manifest_key(owner, &blob_id))
    });
    Ok(())
}

trait BlobKindLabel {
    fn kind_label(&self) -> &'static str;
}

impl BlobKindLabel for BlobCreateInput {
    fn kind_label(&self) -> &'static str {
        match self.kind {
            BlobKind::Original => "original",
            BlobKind::Preview => "preview",
        }
    }
}

ic_cdk::export_candid!();
