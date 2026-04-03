// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Arc;

use anyhow::Result;
use bollard::image::ListImagesOptions;
use chrono::Utc;
use nix::sys::statvfs::statvfs;
use tokio::time;

use crate::cache::ExecutorCache;
use crate::docker::DockerClient;
use crate::models::SystemMetrics;

pub struct MetricsService {
    docker: Arc<DockerClient>,
    cache: Arc<ExecutorCache>,
}

impl MetricsService {
    pub fn new(docker: Arc<DockerClient>, cache: Arc<ExecutorCache>) -> Self {
        Self { docker, cache }
    }

    pub async fn get_cached_system_metrics(&self) -> SystemMetrics {
        self.cache
            .get_system_metrics()
            .await
            .unwrap_or_else(|| SystemMetrics {
                cpu_usage: -1.0,
                ram_usage: -1.0,
                disk_usage: -1.0,
                allocated_cpu: -1,
                allocated_memory: -1,
                allocated_disk: -1,
                image_count: -1,
                last_updated: Utc::now(),
            })
    }

    pub async fn collect_and_cache_metrics(&self) {
        let cached = self.cache.get_system_metrics().await;

        let mut cpu_usage = cached.as_ref().map(|m| m.cpu_usage).unwrap_or(-1.0);
        let mut ram_usage = cached.as_ref().map(|m| m.ram_usage).unwrap_or(-1.0);
        let mut disk_usage = cached.as_ref().map(|m| m.disk_usage).unwrap_or(-1.0);
        let mut allocated_cpu = cached.as_ref().map(|m| m.allocated_cpu).unwrap_or(-1);
        let mut allocated_memory = cached.as_ref().map(|m| m.allocated_memory).unwrap_or(-1);
        let mut allocated_disk = cached.as_ref().map(|m| m.allocated_disk).unwrap_or(-1);
        let mut image_count = cached.as_ref().map(|m| m.image_count).unwrap_or(-1);

        if let Ok(cpu) = get_cpu_usage().await
            && cpu > 0.0
        {
            cpu_usage = cpu;
        }
        if let Ok(Ok(ram)) = tokio::task::spawn_blocking(get_ram_usage).await
            && ram > 0.0
        {
            ram_usage = ram;
        }
        if let Ok(Ok(disk)) = tokio::task::spawn_blocking(get_disk_usage).await
            && disk > 0.0
        {
            disk_usage = disk;
        }

        if let Ok((ac, am, ad)) = self.get_allocated_resources().await {
            if ac != -1 {
                allocated_cpu = ac;
            }
            if am != -1 {
                allocated_memory = am;
            }
            if ad != -1 {
                allocated_disk = ad;
            }
        }

        if let Ok(count) = self.get_image_count().await
            && count != -1
        {
            image_count = count;
        }

        self.cache
            .set_system_metrics(SystemMetrics {
                cpu_usage,
                ram_usage,
                disk_usage,
                allocated_cpu,
                allocated_memory,
                allocated_disk,
                image_count,
                last_updated: Utc::now(),
            })
            .await;
    }

    async fn get_allocated_resources(&self) -> Result<(i32, i32, i32)> {
        let containers = self.docker.list_snapflow_containers().await?;

        let mut total_cpu: i64 = 0;
        let mut total_memory: i64 = 0;
        let mut total_disk: i64 = 0;

        for container in &containers {
            let id = match &container.id {
                Some(id) => id,
                None => continue,
            };

            let inspect = match self.docker.api_client().inspect_container(&id, None).await {
                Ok(c) => c,
                Err(_) => continue,
            };

            let is_running = container.state.as_deref() == Some("running");

            if let Some(ref host_config) = inspect.host_config {
                if is_running {
                    if let Some(cpu_quota) = host_config.cpu_quota
                        && cpu_quota > 0
                    {
                        total_cpu += cpu_quota;
                    }
                    if let Some(memory) = host_config.memory
                        && memory > 0
                    {
                        total_memory += memory;
                    }
                }

                if let Some(ref storage_opt) = host_config.storage_opt
                    && let Some(size_str) = storage_opt.get("size")
                    && let Some(gb) = parse_storage_quota_gb(size_str)
                {
                    total_disk += gb;
                }
            }
        }

        let cpu_vcpus = (total_cpu / 100_000) as i32;
        let memory_gb = (total_memory / (1024 * 1024 * 1024)) as i32;
        let disk_gb = total_disk as i32;

        Ok((cpu_vcpus, memory_gb, disk_gb))
    }

    async fn get_image_count(&self) -> Result<i32> {
        let images = self
            .docker
            .api_client()
            .list_images(Some(ListImagesOptions::<String> {
                all: false,
                ..Default::default()
            }))
            .await
            .map_err(|e| anyhow::anyhow!("failed to list images: {}", e))?;

        Ok(images.len() as i32)
    }

    pub fn start_metrics_collection(
        self: &Arc<Self>,
        mut cancel: tokio::sync::watch::Receiver<()>,
    ) {
        let service = Arc::clone(self);
        tokio::spawn(async move {
            service.collect_and_cache_metrics().await;

            let mut interval = time::interval(time::Duration::from_secs(20));
            loop {
                tokio::select! {
                    _ = interval.tick() => {
                        service.collect_and_cache_metrics().await;
                    }
                    _ = cancel.changed() => {
                        return;
                    }
                }
            }
        });
    }
}

fn parse_storage_quota_gb(size_str: &str) -> Option<i64> {
    let trimmed = size_str.trim();
    if let Some(num_str) = trimmed.strip_suffix('G') {
        num_str.parse::<i64>().ok()
    } else {
        None
    }
}

async fn get_cpu_usage() -> Result<f64> {
    let stats1 = tokio::task::spawn_blocking(read_cpu_stats).await??;
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    let stats2 = tokio::task::spawn_blocking(read_cpu_stats).await??;

    let total1: u64 = stats1.iter().sum();
    let total2: u64 = stats2.iter().sum();
    let idle1 = stats1[3] + stats1[4];
    let idle2 = stats2[3] + stats2[4];

    let total_diff = (total2 - total1) as f64;
    let idle_diff = (idle2 - idle1) as f64;

    if total_diff == 0.0 {
        anyhow::bail!("no CPU time difference detected");
    }

    let usage = (1.0 - idle_diff / total_diff) * 100.0;
    if !(0.0..=100.0).contains(&usage) {
        anyhow::bail!("invalid CPU usage calculated: {}", usage);
    }

    Ok(usage)
}

fn read_cpu_stats() -> Result<Vec<u64>> {
    let content = std::fs::read_to_string("/proc/stat")?;
    let line = content
        .lines()
        .next()
        .ok_or_else(|| anyhow::anyhow!("failed to read CPU line from /proc/stat"))?;

    let fields: Vec<&str> = line.split_whitespace().collect();
    if fields.len() < 8 || fields[0] != "cpu" {
        anyhow::bail!("invalid CPU line format");
    }

    let stats: Vec<u64> = fields[1..]
        .iter()
        .filter_map(|f| f.parse::<u64>().ok())
        .collect();

    if stats.len() < 7 {
        anyhow::bail!("not enough CPU stat fields");
    }

    Ok(stats)
}

fn get_ram_usage() -> Result<f64> {
    let content = std::fs::read_to_string("/proc/meminfo")?;
    let mut mem_total: u64 = 0;
    let mut mem_available: u64 = 0;

    for line in content.lines() {
        let fields: Vec<&str> = line.split_whitespace().collect();
        if fields.len() >= 2 {
            match fields[0] {
                "MemTotal:" => mem_total = fields[1].parse().unwrap_or(0),
                "MemAvailable:" => mem_available = fields[1].parse().unwrap_or(0),
                _ => {}
            }
        }
    }

    if mem_total == 0 {
        anyhow::bail!("could not read memory total");
    }
    if mem_available > mem_total {
        anyhow::bail!("invalid memory values: available > total");
    }

    let used = mem_total - mem_available;
    let usage = (used as f64 / mem_total as f64) * 100.0;

    if !(0.0..=100.0).contains(&usage) {
        anyhow::bail!("invalid RAM usage calculated: {}", usage);
    }

    Ok(usage)
}

fn get_disk_usage() -> Result<f64> {
    match statvfs("/") {
        Ok(stat) => {
            let total = stat.blocks() * stat.fragment_size();
            let available = stat.blocks_available() * stat.fragment_size();

            if total == 0 {
                anyhow::bail!("total disk space is zero");
            }
            if available > total {
                anyhow::bail!("invalid disk values: available > total");
            }

            let used = total - available;
            let usage = (used as f64 / total as f64) * 100.0;

            if !(0.0..=100.0).contains(&usage) {
                anyhow::bail!("invalid disk usage calculated: {}", usage);
            }

            Ok(usage)
        }
        Err(_) => get_disk_usage_command(),
    }
}

fn get_disk_usage_command() -> Result<f64> {
    let output = std::process::Command::new("df").arg("/").output()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let lines: Vec<&str> = stdout.lines().collect();

    if lines.len() < 2 {
        anyhow::bail!("unexpected df output");
    }

    let fields: Vec<&str> = lines[1].split_whitespace().collect();
    if fields.len() < 5 {
        anyhow::bail!("unexpected df output format");
    }

    let usage_str = fields[4].trim_end_matches('%');
    let usage: f64 = usage_str.parse()?;

    if !(0.0..=100.0).contains(&usage) {
        anyhow::bail!("invalid disk usage from df: {}", usage);
    }

    Ok(usage)
}
