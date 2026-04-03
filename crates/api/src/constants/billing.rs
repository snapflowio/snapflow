pub const CPU_PER_SECOND: f64 = 0.0000389;
pub const MEMORY_PER_SECOND: f64 = 0.0000139;
pub const DISK_PER_SECOND: f64 = 0.00000222;
pub const GPU_PER_SECOND: f64 = 0.000694;

pub struct Tier {
    pub id: &'static str,
    pub name: &'static str,
    pub min_wallet_balance: f64,
    pub max_concurrent_sandboxes: i32,
    pub max_sandbox_lifetime_seconds: i64,
    pub max_memory_per_sandbox: i32,
    pub max_cpu_per_sandbox: i32,
    pub max_disk_per_sandbox: i32,
    pub max_storage_total: i32,
    pub bucket_quota: i32,
}

pub const TIER_FREE: Tier = Tier {
    id: "free",
    name: "Free",
    min_wallet_balance: 0.0,
    max_concurrent_sandboxes: 3,
    max_sandbox_lifetime_seconds: 3600,
    max_memory_per_sandbox: 512,
    max_cpu_per_sandbox: 2,
    max_disk_per_sandbox: 2,
    max_storage_total: 6,
    bucket_quota: 3,
};

pub const TIER_PRO: Tier = Tier {
    id: "pro",
    name: "Pro",
    min_wallet_balance: 10.0,
    max_concurrent_sandboxes: 25,
    max_sandbox_lifetime_seconds: 86400,
    max_memory_per_sandbox: 8192,
    max_cpu_per_sandbox: 4,
    max_disk_per_sandbox: 50,
    max_storage_total: 50,
    bucket_quota: 10,
};

pub const TIER_ELITE: Tier = Tier {
    id: "elite",
    name: "Elite",
    min_wallet_balance: 100.0,
    max_concurrent_sandboxes: 100,
    max_sandbox_lifetime_seconds: 259200,
    max_memory_per_sandbox: 32768,
    max_cpu_per_sandbox: 16,
    max_disk_per_sandbox: 500,
    max_storage_total: 500,
    bucket_quota: 50,
};

pub const TIER_MAX: Tier = Tier {
    id: "max",
    name: "Max",
    min_wallet_balance: 500.0,
    max_concurrent_sandboxes: 500,
    max_sandbox_lifetime_seconds: -1,
    max_memory_per_sandbox: 65536,
    max_cpu_per_sandbox: 32,
    max_disk_per_sandbox: 2000,
    max_storage_total: 2000,
    bucket_quota: 200,
};

pub fn get_tier_for_balance(balance: f64) -> &'static Tier {
    if balance >= TIER_MAX.min_wallet_balance {
        &TIER_MAX
    } else if balance >= TIER_ELITE.min_wallet_balance {
        &TIER_ELITE
    } else if balance >= TIER_PRO.min_wallet_balance {
        &TIER_PRO
    } else {
        &TIER_FREE
    }
}

pub fn calculate_period_cost(
    duration_seconds: f64,
    cpu: f64,
    gpu: f64,
    mem: f64,
    disk: f64,
) -> f64 {
    cpu * duration_seconds * CPU_PER_SECOND
        + (mem / 1024.0) * duration_seconds * MEMORY_PER_SECOND
        + disk * duration_seconds * DISK_PER_SECOND
        + gpu * duration_seconds * GPU_PER_SECOND
}
