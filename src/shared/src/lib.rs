use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct SecurityState {
    pub ack_recovery_phrase: bool,
    pub ack_backup_device: bool,
    pub ack_risk_understood: bool,
    pub completed_at_ns: Option<u64>,
    pub last_reviewed_at_ns: Option<u64>,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct UserProfile {
    pub owner: Principal,
    pub display_name: Option<String>,
    pub created_at_ns: u64,
    pub updated_at_ns: u64,
    pub security: SecurityState,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct CategoryRecord {
    pub id: String,
    pub owner: Principal,
    pub is_default: bool,
    pub name: String,
    pub color: String,
    pub icon: String,
    pub sort_order: u32,
    pub doc_count: u64,
    pub created_at_ns: u64,
    pub updated_at_ns: u64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct NoteRecord {
    pub id: String,
    pub owner: Principal,
    pub title: String,
    pub encrypted_content: Vec<u8>,
    pub pinned: bool,
    pub created_at_ns: u64,
    pub updated_at_ns: u64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct PostItRecord {
    pub id: String,
    pub owner: Principal,
    pub encrypted_text: Vec<u8>,
    pub completed: bool,
    pub color: String,
    pub created_at_ns: u64,
    pub updated_at_ns: u64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub enum DocumentStatus {
    Inbox,
    Processed,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub enum PaymentStatus {
    Due,
    Paid,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq)]
pub struct InvoiceLineItemRecord {
    pub description: String,
    pub amount: f64,
    pub vat_rate: f64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq)]
pub struct InvoiceDataRecord {
    pub invoice_type: String,
    pub invoice_number: Option<String>,
    pub supplier: Option<String>,
    pub vat_number: Option<String>,
    pub net_amount: Option<f64>,
    pub vat_rate: Option<f64>,
    pub vat_amount: Option<f64>,
    pub total_amount: Option<f64>,
    pub line_items: Vec<InvoiceLineItemRecord>,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct WarrantyDataRecord {
    pub product: Option<String>,
    pub brand: Option<String>,
    pub store: Option<String>,
    pub purchase_date: Option<String>,
    pub duration_months: Option<u32>,
    pub serial_number: Option<String>,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct BlobEncryptionMetadataRecord {
    pub version: u8,
    pub algorithm: String,
    pub iv_base64: String,
    pub plaintext_sha256_hex: String,
    pub ciphertext_sha256_hex: String,
    pub plaintext_size: u64,
    pub ciphertext_size: u64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct DocumentCryptoStateRecord {
    pub scheme: String,
    pub wrapped_document_key_base64: Option<String>,
    pub wrapping_iv_base64: Option<String>,
    pub key_wrapping: Option<String>,
    pub original: Option<BlobEncryptionMetadataRecord>,
    pub preview: Option<BlobEncryptionMetadataRecord>,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct VetKeyConfigRecord {
    pub key_name: String,
    pub derivation_context: Vec<u8>,
    pub aes_domain_separator: String,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq)]
pub struct DocumentRecord {
    pub id: String,
    pub owner: Principal,
    pub name: String,
    pub size_bytes: u64,
    pub mime_type: String,
    pub original_blob_id: Option<String>,
    pub preview_blob_id: Option<String>,
    pub category_id: Option<String>,
    pub category_name: String,
    pub title: String,
    pub status: DocumentStatus,
    pub document_date: Option<String>,
    pub tags: Vec<String>,
    pub notes: Option<String>,
    pub merchant_name: Option<String>,
    pub amount: Option<f64>,
    pub payment_status: PaymentStatus,
    pub has_expiry: bool,
    pub expiry_date: Option<String>,
    pub expiry_type: Option<String>,
    pub expiry_duration: Option<String>,
    pub crypto_state: Option<DocumentCryptoStateRecord>,
    pub invoice_data: Option<InvoiceDataRecord>,
    pub warranty_data: Option<WarrantyDataRecord>,
    pub created_at_ns: u64,
    pub updated_at_ns: u64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq)]
pub struct DocumentUpsertInput {
    pub id: Option<String>,
    pub name: String,
    pub size_bytes: u64,
    pub mime_type: String,
    pub original_blob_id: Option<String>,
    pub preview_blob_id: Option<String>,
    pub category_id: Option<String>,
    pub category_name: String,
    pub title: String,
    pub status: DocumentStatus,
    pub document_date: Option<String>,
    pub tags: Vec<String>,
    pub notes: Option<String>,
    pub merchant_name: Option<String>,
    pub amount: Option<f64>,
    pub payment_status: PaymentStatus,
    pub has_expiry: bool,
    pub expiry_date: Option<String>,
    pub expiry_type: Option<String>,
    pub expiry_duration: Option<String>,
    pub crypto_state: Option<DocumentCryptoStateRecord>,
    pub invoice_data: Option<InvoiceDataRecord>,
    pub warranty_data: Option<WarrantyDataRecord>,
    pub created_at_ns: Option<u64>,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub enum ActivityType {
    Uploaded,
    Processed,
    Updated,
    Deleted,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct ActivityRecord {
    pub id: String,
    pub owner: Principal,
    pub activity_type: ActivityType,
    pub document_id: String,
    pub document_name: String,
    pub document_title: Option<String>,
    pub category_name: Option<String>,
    pub at_ns: u64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct NotificationBroadcastRecord {
    pub id: String,
    pub title: String,
    pub body: String,
    pub created_at_ns: u64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct NotificationReceiptRecord {
    pub id: String,
    pub owner: Principal,
    pub notification_id: String,
    pub read_at_ns: u64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct NotificationViewRecord {
    pub id: String,
    pub title: String,
    pub body: String,
    pub created_at_ns: u64,
    pub read_at_ns: Option<u64>,
    pub is_unread: bool,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub enum AnalyticsEventType {
    UserLoggedIn,
    SecurityOnboardingCompleted,
    DocumentUploaded,
    DocumentArchived,
    NoteCreated,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct AnalyticsEventMetadata {
    pub category_id: Option<String>,
    pub document_kind: Option<String>,
    pub source_screen: Option<String>,
    pub item_count: Option<u32>,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct AnalyticsEventInput {
    pub event_type: AnalyticsEventType,
    pub metadata: Option<AnalyticsEventMetadata>,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct AnalyticsEventRecord {
    pub id: String,
    pub user_hash: String,
    pub event_type: AnalyticsEventType,
    pub occurred_at_ns: u64,
    pub metadata: Option<AnalyticsEventMetadata>,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct DailyMetrics {
    pub day_key: String,
    pub unique_active_users: u64,
    pub logins: u64,
    pub security_onboarding_completed: u64,
    pub documents_uploaded: u64,
    pub documents_archived: u64,
    pub notes_created: u64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct ProductSummary {
    pub total_registered_users: u64,
    pub dau: u64,
    pub wau: u64,
    pub mau: u64,
    pub total_documents_uploaded: u64,
    pub total_documents_archived: u64,
    pub total_notes_created: u64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub enum InboxDocumentStatus {
    Uploaded,
    Processing,
    ReadyForReview,
    Archived,
    Error,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub enum InboxAnalysisStatus {
    Idle,
    Queued,
    Processing,
    Completed,
    Error,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq)]
pub struct InboxDocumentRecord {
    pub id: String,
    pub owner: Principal,
    pub name: String,
    pub size_bytes: u64,
    pub mime_type: String,
    pub source_blob_id: Option<String>,
    pub preview_blob_id: Option<String>,
    pub status: InboxDocumentStatus,
    pub analysis_status: Option<InboxAnalysisStatus>,
    pub ocr_text: Option<String>,
    pub suggested_title: Option<String>,
    pub suggested_category_id: Option<String>,
    pub suggested_category_name: Option<String>,
    pub suggested_tags: Vec<String>,
    pub extracted_payload_json: Option<String>,
    pub extracted_document_date: Option<String>,
    pub extracted_merchant_name: Option<String>,
    pub extracted_amount: Option<f64>,
    pub extracted_payment_status: Option<PaymentStatus>,
    pub error_message: Option<String>,
    pub analysis_updated_at_ns: Option<u64>,
    pub created_at_ns: u64,
    pub updated_at_ns: u64,
    pub expires_at_ns: Option<u64>,
    pub archived_at_ns: Option<u64>,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct InboxDocumentUpsertInput {
    pub id: Option<String>,
    pub name: String,
    pub size_bytes: u64,
    pub mime_type: String,
    pub source_blob_id: Option<String>,
    pub preview_blob_id: Option<String>,
    pub status: Option<InboxDocumentStatus>,
    pub expires_at_ns: Option<u64>,
    pub created_at_ns: Option<u64>,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq)]
pub struct InboxAiUpdateInput {
    pub document_id: String,
    pub status: InboxDocumentStatus,
    pub analysis_status: Option<InboxAnalysisStatus>,
    pub ocr_text: Option<String>,
    pub suggested_title: Option<String>,
    pub suggested_category_id: Option<String>,
    pub suggested_category_name: Option<String>,
    pub suggested_tags: Vec<String>,
    pub extracted_payload_json: Option<String>,
    pub extracted_document_date: Option<String>,
    pub extracted_merchant_name: Option<String>,
    pub extracted_amount: Option<f64>,
    pub extracted_payment_status: Option<PaymentStatus>,
    pub error_message: Option<String>,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq)]
pub struct InboxLlmLineItemRecord {
    pub description: String,
    pub amount: Option<f64>,
    pub vat_rate: Option<f64>,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq)]
pub struct InboxLlmInvoiceDataRecord {
    pub invoice_type: Option<String>,
    pub invoice_number: Option<String>,
    pub supplier: Option<String>,
    pub vat_number: Option<String>,
    pub net_amount: Option<f64>,
    pub vat_rate: Option<f64>,
    pub vat_amount: Option<f64>,
    pub total_amount: Option<f64>,
    pub line_items: Vec<InboxLlmLineItemRecord>,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq)]
pub struct InboxOnchainLlmRequest {
    pub file_name: String,
    pub mime_type: String,
    pub extracted_text: String,
    pub heuristic_category_name: Option<String>,
    pub heuristic_merchant_name: Option<String>,
    pub heuristic_document_date: Option<String>,
    pub heuristic_amount: Option<f64>,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq)]
pub struct InboxOnchainLlmResponse {
    pub provider: String,
    pub model: String,
    pub title: Option<String>,
    pub category_name: Option<String>,
    pub tags: Vec<String>,
    pub document_date: Option<String>,
    pub merchant_name: Option<String>,
    pub amount: Option<f64>,
    pub payment_status: Option<PaymentStatus>,
    pub document_text_excerpt: Option<String>,
    pub invoice_data: Option<InboxLlmInvoiceDataRecord>,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct OnchainVaultSummaryResponse {
    pub provider: String,
    pub model: String,
    pub summary: String,
    pub highlights: Vec<String>,
    pub generated_at_ns: u64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct OnchainVaultChatResponse {
    pub provider: String,
    pub model: String,
    pub answer: String,
    pub generated_at_ns: u64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct DashboardSuggestionRecord {
    pub id: String,
    pub title: String,
    pub body: String,
    pub tone: String,
    pub cta_label: Option<String>,
    pub cta_href: Option<String>,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub enum BlobKind {
    Original,
    Preview,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct BlobManifest {
    pub blob_id: String,
    pub owner: Principal,
    pub document_id: String,
    pub kind: BlobKind,
    pub mime_type: String,
    pub total_size: u64,
    pub chunk_count: u32,
    pub sha256_hex: String,
    pub created_at_ns: u64,
    pub finalized: bool,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct BlobCreateInput {
    pub document_id: String,
    pub kind: BlobKind,
    pub mime_type: String,
    pub total_size: u64,
    pub chunk_count: u32,
    pub sha256_hex: String,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct BlobChunkInput {
    pub blob_id: String,
    pub chunk_index: u32,
    pub bytes: Vec<u8>,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub enum StorageError {
    NotFound,
    Unauthorized,
    AlreadyExists,
    InvalidChunkIndex,
    InvalidState,
    InvalidChecksum,
    TooLarge,
    Message(String),
}

pub type StorageResult = Result<(), StorageError>;
pub type BlobManifestResult = Result<BlobManifest, StorageError>;
pub type BlobChunkResult = Result<Vec<u8>, StorageError>;

pub fn default_security_state() -> SecurityState {
    SecurityState {
        ack_recovery_phrase: false,
        ack_backup_device: false,
        ack_risk_understood: false,
        completed_at_ns: None,
        last_reviewed_at_ns: None,
    }
}

pub fn default_categories_for(owner: Principal) -> Vec<CategoryRecord> {
    let now = 0;
    [
        ("invoice", "Fattura", "#3B82F6", "invoice"),
        ("warranty", "Garanzia", "#10B981", "shield"),
        ("receipt", "Ricevuta", "#8B5CF6", "receipt"),
        ("contract", "Contratto", "#F59E0B", "contract"),
        ("identity", "Identità", "#EF4444", "id-card"),
        ("health", "Salute", "#EC4899", "health"),
        ("home", "Casa", "#14B8A6", "home"),
        ("car", "Auto", "#F97316", "car"),
        ("education", "Formazione", "#A855F7", "graduation"),
        ("work", "Lavoro", "#6366F1", "briefcase"),
        ("finance", "Finanza", "#059669", "coins"),
        ("insurance", "Assicurazione", "#1D4ED8", "lock"),
        ("subscription", "Abbonamento", "#06B6D4", "refresh"),
        ("tax", "Fiscale", "#DC2626", "government"),
        ("other", "Altro", "#6B7280", "paperclip"),
    ]
    .iter()
    .enumerate()
    .map(|(index, (id, name, color, icon))| CategoryRecord {
        id: (*id).to_string(),
        owner,
        is_default: true,
        name: (*name).to_string(),
        color: (*color).to_string(),
        icon: (*icon).to_string(),
        sort_order: index as u32,
        doc_count: 0,
        created_at_ns: now,
        updated_at_ns: now,
    })
    .collect()
}
