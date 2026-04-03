// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use redis::AsyncCommands;
use uuid::Uuid;

use crate::constants::infra::PENDING_TTL_SECONDS;

fn cpu_key(org_id: Uuid) -> String {
    format!("org:{org_id}:pending_cpu")
}

fn mem_key(org_id: Uuid) -> String {
    format!("org:{org_id}:pending_mem")
}

fn disk_key(org_id: Uuid) -> String {
    format!("org:{org_id}:pending_disk")
}

pub struct PendingIncrement {
    pub cpu_incremented: bool,
    pub mem_incremented: bool,
    pub disk_incremented: bool,
}

pub async fn increment(
    conn: &mut redis::aio::ConnectionManager,
    org_id: Uuid,
    cpu: i32,
    mem: i32,
    disk: i32,
) -> redis::RedisResult<PendingIncrement> {
    let script = redis::Script::new(
        r"
        local cpuKey = KEYS[1]
        local memKey = KEYS[2]
        local diskKey = KEYS[3]
        local cpuVal = tonumber(ARGV[1])
        local memVal = tonumber(ARGV[2])
        local diskVal = tonumber(ARGV[3])
        local ttl = tonumber(ARGV[4])

        redis.call('INCRBY', cpuKey, cpuVal)
        redis.call('EXPIRE', cpuKey, ttl)
        redis.call('INCRBY', memKey, memVal)
        redis.call('EXPIRE', memKey, ttl)
        redis.call('INCRBY', diskKey, diskVal)
        redis.call('EXPIRE', diskKey, ttl)
        return 1
        ",
    );

    script
        .key(cpu_key(org_id))
        .key(mem_key(org_id))
        .key(disk_key(org_id))
        .arg(cpu)
        .arg(mem)
        .arg(disk)
        .arg(PENDING_TTL_SECONDS)
        .invoke_async::<i32>(conn)
        .await?;

    Ok(PendingIncrement {
        cpu_incremented: true,
        mem_incremented: true,
        disk_incremented: true,
    })
}

pub async fn decrement(
    conn: &mut redis::aio::ConnectionManager,
    org_id: Uuid,
    cpu: Option<i32>,
    mem: Option<i32>,
    disk: Option<i32>,
) -> redis::RedisResult<()> {
    if let Some(v) = cpu {
        let _: () = conn.decr(cpu_key(org_id), v).await?;
    }
    if let Some(v) = mem {
        let _: () = conn.decr(mem_key(org_id), v).await?;
    }
    if let Some(v) = disk {
        let _: () = conn.decr(disk_key(org_id), v).await?;
    }
    Ok(())
}

pub async fn get_pending(
    conn: &mut redis::aio::ConnectionManager,
    org_id: Uuid,
) -> redis::RedisResult<(i64, i64, i64)> {
    let cpu: i64 = conn.get(cpu_key(org_id)).await.unwrap_or(0);
    let mem: i64 = conn.get(mem_key(org_id)).await.unwrap_or(0);
    let disk: i64 = conn.get(disk_key(org_id)).await.unwrap_or(0);
    Ok((cpu.max(0), mem.max(0), disk.max(0)))
}
