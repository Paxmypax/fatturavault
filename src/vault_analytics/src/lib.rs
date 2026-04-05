use candid::{decode_one, encode_one, CandidType, Principal};
use fatturavault_shared::{
    AnalyticsEventInput, AnalyticsEventMetadata, AnalyticsEventRecord, AnalyticsEventType,
    DailyMetrics, ProductSummary,
};
use ic_cdk::{init, post_upgrade, update};
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, StableBTreeMap,
};
use serde::de::DeserializeOwned;
use sha2::{Digest, Sha256};
use std::cell::RefCell;

type Memory = VirtualMemory<DefaultMemoryImpl>;

const EVENTS_MEMORY_ID: MemoryId = MemoryId::new(0);
const DAILY_METRICS_MEMORY_ID: MemoryId = MemoryId::new(1);
const DAILY_USERS_MEMORY_ID: MemoryId = MemoryId::new(2);
const REGISTERED_USERS_MEMORY_ID: MemoryId = MemoryId::new(3);
const SETTINGS_MEMORY_ID: MemoryId = MemoryId::new(4);
const ADMINS_MEMORY_ID: MemoryId = MemoryId::new(5);
const USER_HASH_SALT: &str = "fatturavault-analytics-v1";
const OWNER_KEY: &str = "owner";

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static EVENTS: RefCell<StableBTreeMap<String, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|manager| manager.borrow().get(EVENTS_MEMORY_ID))
        ));

    static DAILY_METRICS: RefCell<StableBTreeMap<String, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|manager| manager.borrow().get(DAILY_METRICS_MEMORY_ID))
        ));

    static DAILY_USERS: RefCell<StableBTreeMap<String, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|manager| manager.borrow().get(DAILY_USERS_MEMORY_ID))
        ));

    static REGISTERED_USERS: RefCell<StableBTreeMap<String, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|manager| manager.borrow().get(REGISTERED_USERS_MEMORY_ID))
        ));

    static SETTINGS: RefCell<StableBTreeMap<String, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|manager| manager.borrow().get(SETTINGS_MEMORY_ID))
        ));

    static ADMINS: RefCell<StableBTreeMap<String, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|manager| manager.borrow().get(ADMINS_MEMORY_ID))
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

#[derive(CandidType)]
struct AnalyticsAccessState {
    is_admin: bool,
    has_admins: bool,
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

fn tracking_caller() -> Result<Principal, String> {
    let caller = ic_cdk::api::msg_caller();
    if caller == Principal::anonymous() && !is_admin_principal(caller) {
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

fn admins_count() -> u64 {
    ADMINS.with(|admins| admins.borrow().iter().count() as u64)
}

fn is_admin_principal(principal: Principal) -> bool {
    ADMINS.with(|admins| admins.borrow().contains_key(&principal.to_text()))
}

fn require_admin() -> Result<Principal, String> {
    let principal = ic_cdk::api::msg_caller();
    if !is_admin_principal(principal) {
        return Err("Accesso analytics riservato all'admin.".to_string());
    }
    Ok(principal)
}

fn require_owner() -> Result<Principal, String> {
    let principal = caller()?;
    let Some(owner) = owner_principal() else {
        return Err("Owner analytics non configurato.".to_string());
    };

    if principal != owner {
        return Err("Operazione riservata al controller analytics.".to_string());
    }

    Ok(principal)
}

fn ensure_admin_query() {
    if let Err(error) = require_admin() {
        ic_cdk::trap(&error);
    }
}

fn insert_admin(principal: Principal) {
    ADMINS.with(|admins| {
        admins
            .borrow_mut()
            .insert(principal.to_text(), encode(&true))
    });
}

fn remove_admin_internal(principal: Principal) {
    ADMINS.with(|admins| {
        admins.borrow_mut().remove(&principal.to_text());
    });
}

fn encode<T: CandidType>(value: &T) -> Vec<u8> {
    encode_one(value).expect("failed to encode analytics value")
}

fn decode<T: DeserializeOwned + CandidType>(bytes: &[u8]) -> T {
    decode_one(bytes).expect("failed to decode analytics value")
}

fn hash_user(owner: Principal) -> String {
    let mut hasher = Sha256::new();
    hasher.update(USER_HASH_SALT.as_bytes());
    hasher.update(owner.as_slice());
    hex::encode(hasher.finalize())
}

fn current_day_number() -> i64 {
    (now_ns() / 1_000_000_000 / 86_400) as i64
}

fn day_number_from_ns(timestamp_ns: u64) -> i64 {
    (timestamp_ns / 1_000_000_000 / 86_400) as i64
}

fn civil_from_days(days: i64) -> (i32, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = mp + if mp < 10 { 3 } else { -9 };
    let year = y + if m <= 2 { 1 } else { 0 };
    (year as i32, m as u32, d as u32)
}

fn days_from_civil(year: i32, month: u32, day: u32) -> i64 {
    let year = year as i64 - if month <= 2 { 1 } else { 0 };
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let yoe = year - era * 400;
    let month = month as i64;
    let day = day as i64;
    let doy = (153 * (month + if month > 2 { -3 } else { 9 }) + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

fn day_key_from_day_number(day_number: i64) -> String {
    let (year, month, day) = civil_from_days(day_number);
    format!("{year:04}-{month:02}-{day:02}")
}

fn day_number_from_key(day_key: &str) -> Option<i64> {
    let mut parts = day_key.split('-');
    let year = parts.next()?.parse::<i32>().ok()?;
    let month = parts.next()?.parse::<u32>().ok()?;
    let day = parts.next()?.parse::<u32>().ok()?;
    Some(days_from_civil(year, month, day))
}

fn event_key(occurred_at_ns: u64, event_id: &str) -> String {
    format!("{occurred_at_ns:020}::{event_id}")
}

fn default_metrics(day_key: String) -> DailyMetrics {
    DailyMetrics {
        day_key,
        unique_active_users: 0,
        logins: 0,
        security_onboarding_completed: 0,
        documents_uploaded: 0,
        documents_archived: 0,
        notes_created: 0,
    }
}

fn metrics_for_day(day_key: &str) -> DailyMetrics {
    DAILY_METRICS.with(|metrics| {
        metrics
            .borrow()
            .get(&day_key.to_string())
            .map(|bytes| decode::<DailyMetrics>(&bytes))
            .unwrap_or_else(|| default_metrics(day_key.to_string()))
    })
}

fn save_daily_metrics(metrics: &DailyMetrics) {
    DAILY_METRICS.with(|daily_metrics| {
        daily_metrics
            .borrow_mut()
            .insert(metrics.day_key.clone(), encode(metrics))
    });
}

fn users_for_day(day_key: &str) -> Vec<String> {
    DAILY_USERS.with(|users| {
        users.borrow()
            .get(&day_key.to_string())
            .map(|bytes| decode::<Vec<String>>(&bytes))
            .unwrap_or_default()
    })
}

fn save_users_for_day(day_key: &str, users: &[String]) {
    DAILY_USERS.with(|daily_users| {
        daily_users
            .borrow_mut()
            .insert(day_key.to_string(), encode(&users.to_vec()))
    });
}

fn register_user(user_hash: &str, occurred_at_ns: u64) {
    REGISTERED_USERS.with(|users| {
        let mut users = users.borrow_mut();
        if !users.contains_key(&user_hash.to_string()) {
            users.insert(user_hash.to_string(), encode(&occurred_at_ns));
        }
    });
}

fn save_event(event: &AnalyticsEventRecord) {
    EVENTS.with(|events| {
        events
            .borrow_mut()
            .insert(event_key(event.occurred_at_ns, &event.id), encode(event))
    });
}

fn bump_metric(metrics: &mut DailyMetrics, event_type: &AnalyticsEventType) {
    match event_type {
        AnalyticsEventType::UserLoggedIn => metrics.logins += 1,
        AnalyticsEventType::SecurityOnboardingCompleted => {
            metrics.security_onboarding_completed += 1
        }
        AnalyticsEventType::DocumentUploaded => metrics.documents_uploaded += 1,
        AnalyticsEventType::DocumentArchived => metrics.documents_archived += 1,
        AnalyticsEventType::NoteCreated => metrics.notes_created += 1,
    }
}

fn update_daily_state(user_hash: &str, event_type: &AnalyticsEventType, occurred_at_ns: u64) {
    let day_key = day_key_from_day_number(day_number_from_ns(occurred_at_ns));
    let mut users = users_for_day(&day_key);
    if !users.iter().any(|existing| existing == user_hash) {
        users.push(user_hash.to_string());
        save_users_for_day(&day_key, &users);
    }

    let mut metrics = metrics_for_day(&day_key);
    metrics.unique_active_users = users.len() as u64;
    bump_metric(&mut metrics, event_type);
    save_daily_metrics(&metrics);
}

fn collect_last_n_days_metrics(days: i64) -> Vec<DailyMetrics> {
    let current = current_day_number();
    let start = current.saturating_sub(days - 1);

    let mut metrics = DAILY_METRICS.with(|daily_metrics| {
        daily_metrics
            .borrow()
            .iter()
            .filter_map(|entry| {
                let key = entry.key();
                let day_number = day_number_from_key(&key)?;
                if day_number >= start && day_number <= current {
                    Some(decode::<DailyMetrics>(&entry.value()))
                } else {
                    None
                }
            })
            .collect::<Vec<_>>()
    });

    metrics.sort_by(|a, b| a.day_key.cmp(&b.day_key));
    metrics
}

fn unique_users_in_last_n_days(days: i64) -> u64 {
    let current = current_day_number();
    let start = current.saturating_sub(days - 1);
    let mut users = std::collections::BTreeSet::new();

    DAILY_USERS.with(|daily_users| {
        for entry in daily_users.borrow().iter() {
            let key = entry.key();
            let Some(day_number) = day_number_from_key(&key) else {
                continue;
            };
            if day_number < start || day_number > current {
                continue;
            }

            let hashes = decode::<Vec<String>>(&entry.value());
            for hash in hashes {
                users.insert(hash);
            }
        }
    });

    users.len() as u64
}

fn sum_metric<F>(selector: F) -> u64
where
    F: Fn(&DailyMetrics) -> u64,
{
    DAILY_METRICS.with(|daily_metrics| {
        daily_metrics
            .borrow()
            .iter()
            .map(|entry| decode::<DailyMetrics>(&entry.value()))
            .map(|metrics| selector(&metrics))
            .sum()
    })
}

#[update]
fn track_event(input: AnalyticsEventInput) -> Result<AnalyticsEventRecord, String> {
    let owner = tracking_caller()?;
    let occurred_at_ns = now_ns();
    let user_hash = hash_user(owner);
    let event = AnalyticsEventRecord {
        id: format!("evt_{occurred_at_ns}"),
        user_hash: user_hash.clone(),
        event_type: input.event_type.clone(),
        occurred_at_ns,
        metadata: sanitize_metadata(input.metadata),
    };

    register_user(&user_hash, occurred_at_ns);
    save_event(&event);
    update_daily_state(&user_hash, &event.event_type, occurred_at_ns);

    Ok(event)
}

#[update]
fn grant_admin(principal: Principal) -> Result<bool, String> {
    let _ = require_owner()?;
    insert_admin(principal);
    Ok(true)
}

#[update]
fn revoke_admin(principal: Principal) -> Result<bool, String> {
    let _ = require_owner()?;
    remove_admin_internal(principal);
    Ok(true)
}

fn sanitize_metadata(metadata: Option<AnalyticsEventMetadata>) -> Option<AnalyticsEventMetadata> {
    metadata.map(|metadata| AnalyticsEventMetadata {
        category_id: metadata
            .category_id
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
        document_kind: metadata
            .document_kind
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
        source_screen: metadata
            .source_screen
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
        item_count: metadata.item_count,
    })
}

#[update]
fn get_daily_metrics(day_key: String) -> Option<DailyMetrics> {
    ensure_admin_query();
    DAILY_METRICS.with(|daily_metrics| {
        daily_metrics
            .borrow()
            .get(&day_key)
            .map(|bytes| decode::<DailyMetrics>(&bytes))
    })
}

#[update]
fn get_last_30_days_metrics() -> Vec<DailyMetrics> {
    ensure_admin_query();
    collect_last_n_days_metrics(30)
}

#[update]
fn get_product_summary() -> ProductSummary {
    ensure_admin_query();
    let total_registered_users =
        REGISTERED_USERS.with(|users| users.borrow().iter().count() as u64);

    ProductSummary {
        total_registered_users,
        dau: unique_users_in_last_n_days(1),
        wau: unique_users_in_last_n_days(7),
        mau: unique_users_in_last_n_days(30),
        total_documents_uploaded: sum_metric(|metrics| metrics.documents_uploaded),
        total_documents_archived: sum_metric(|metrics| metrics.documents_archived),
        total_notes_created: sum_metric(|metrics| metrics.notes_created),
    }
}

#[update]
fn get_access_state() -> AnalyticsAccessState {
    let principal = ic_cdk::api::msg_caller();
    AnalyticsAccessState {
        is_admin: is_admin_principal(principal),
        has_admins: admins_count() > 0,
    }
}

ic_cdk::export_candid!();
