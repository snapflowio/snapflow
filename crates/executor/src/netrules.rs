// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use tokio::process::Command;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;
use tracing::{error, info};

const CHAIN_PREFIX: &str = "SNAPFLOW-SB-";

pub struct NetRulesManager {
    mu: Arc<Mutex<()>>,
    persistent: bool,
    cancel: CancellationToken,
}

impl NetRulesManager {
    pub fn new(persistent: bool, cancel: CancellationToken) -> Self {
        Self {
            mu: Arc::new(Mutex::new(())),
            persistent,
            cancel,
        }
    }

    pub fn start(&self) {
        if self.persistent {
            let cancel = self.cancel.clone();
            let mu = Arc::clone(&self.mu);
            tokio::spawn(async move {
                persist_rules_loop(cancel, mu).await;
            });
        }
    }

    pub async fn set_network_rules(
        &self,
        name: &str,
        source_ip: &str,
        allow_list: &str,
    ) -> Result<()> {
        let allowed_networks = parse_cidr_networks(allow_list)?;
        let chain_name = format_chain_name(name);
        let _guard = self.mu.lock().await;

        let _ = iptables_cmd(&["--new-chain", &chain_name]).await;

        iptables_cmd(&["--flush", &chain_name]).await?;

        for network in &allowed_networks {
            iptables_cmd(&[
                "-A",
                &chain_name,
                "-j",
                "RETURN",
                "-d",
                network,
                "-p",
                "all",
            ])
            .await?;
        }

        iptables_cmd(&["-A", &chain_name, "-j", "DROP", "-p", "all"]).await?;

        iptables_insert_unique(&[
            "-I",
            "DOCKER-USER",
            "1",
            "-j",
            &chain_name,
            "-s",
            source_ip,
            "-p",
            "all",
        ])
        .await?;

        Ok(())
    }

    pub async fn assign_network_rules(&self, name: &str, source_ip: &str) -> Result<()> {
        let chain_name = format_chain_name(name);
        let _guard = self.mu.lock().await;

        if !chain_exists(&chain_name).await? {
            return Ok(());
        }

        iptables_insert_unique(&[
            "-I",
            "DOCKER-USER",
            "1",
            "-j",
            &chain_name,
            "-s",
            source_ip,
            "-p",
            "all",
        ])
        .await?;

        Ok(())
    }

    pub async fn unassign_network_rules(&self, name: &str) -> Result<()> {
        let chain_name = format_chain_name(name);
        let _guard = self.mu.lock().await;

        let rules = list_rules("filter", "DOCKER-USER").await?;
        for rule in &rules {
            if rule.contains(&chain_name) {
                if let Some(args) = parse_rule_arguments(rule) {
                    let _ = iptables_cmd(
                        &[
                            &["-D", "DOCKER-USER"],
                            args.iter()
                                .map(|s| s.as_str())
                                .collect::<Vec<_>>()
                                .as_slice(),
                        ]
                        .concat(),
                    )
                    .await;
                }
            }
        }

        Ok(())
    }

    pub async fn delete_network_rules(&self, name: &str) -> Result<()> {
        let chain_name = format_chain_name(name);
        let _guard = self.mu.lock().await;

        let rules = list_rules("filter", "DOCKER-USER").await?;
        for rule in &rules {
            if rule.contains(&chain_name) {
                if let Some(args) = parse_rule_arguments(rule) {
                    let _ = iptables_cmd(
                        &[
                            &["-D", "DOCKER-USER"],
                            args.iter()
                                .map(|s| s.as_str())
                                .collect::<Vec<_>>()
                                .as_slice(),
                        ]
                        .concat(),
                    )
                    .await;
                }
            }
        }

        let _ = iptables_cmd(&["--flush", &chain_name]).await;
        let _ = iptables_cmd(&["--delete-chain", &chain_name]).await;

        Ok(())
    }

    pub async fn set_network_limiter(&self, name: &str, source_ip: &str) -> Result<()> {
        let chain_name = format_chain_name(name);
        let _guard = self.mu.lock().await;

        let _ = iptables_cmd_table("mangle", &["--new-chain", &chain_name]).await;
        iptables_cmd_table("mangle", &["--flush", &chain_name]).await?;
        iptables_cmd_table(
            "mangle",
            &["-A", &chain_name, "-j", "MARK", "--set-mark", "999"],
        )
        .await?;
        iptables_cmd_table(
            "mangle",
            &[
                "-A",
                "PREROUTING",
                "-j",
                &chain_name,
                "-s",
                source_ip,
                "-p",
                "all",
            ],
        )
        .await?;

        Ok(())
    }

    pub async fn remove_network_limiter(&self, name: &str) -> Result<()> {
        let chain_name = format_chain_name(name);
        let _guard = self.mu.lock().await;

        let rules = list_rules("mangle", "PREROUTING").await?;
        for rule in &rules {
            if rule.contains(&chain_name) {
                if let Some(args) = parse_rule_arguments(rule) {
                    let _ = iptables_cmd_table(
                        "mangle",
                        &[
                            &["-D", "PREROUTING"],
                            args.iter()
                                .map(|s| s.as_str())
                                .collect::<Vec<_>>()
                                .as_slice(),
                        ]
                        .concat(),
                    )
                    .await;
                }
            }
        }

        let _ = iptables_cmd_table("mangle", &["--flush", &chain_name]).await;
        let _ = iptables_cmd_table("mangle", &["--delete-chain", &chain_name]).await;

        Ok(())
    }

    pub async fn list_snapflow_rules(&self, table: &str, chain: &str) -> Result<Vec<String>> {
        let _guard = self.mu.lock().await;
        let rules = list_rules(table, chain).await?;
        Ok(rules
            .into_iter()
            .filter(|r| r.contains(CHAIN_PREFIX))
            .collect())
    }

    pub async fn list_snapflow_chains(&self, table: &str) -> Result<Vec<String>> {
        let _guard = self.mu.lock().await;
        let output = Command::new("iptables")
            .args(["-t", table, "-S"])
            .output()
            .await
            .context("failed to run iptables")?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut chains = Vec::default();
        for line in stdout.lines() {
            if let Some(rest) = line.strip_prefix("-N ") {
                let chain_name = rest.trim();
                if chain_name.starts_with(CHAIN_PREFIX) {
                    chains.push(chain_name.to_owned());
                }
            }
        }
        Ok(chains)
    }

    /// Get current network settings for a container
    pub async fn get_network_settings(&self, name: &str) -> Result<NetworkSettings> {
        let chain_name = format_chain_name(name);
        let _guard = self.mu.lock().await;

        // Check if chain exists in filter table
        let filter_exists = chain_exists(&chain_name).await?;

        let (network_block_all, network_allow_list) = if filter_exists {
            // Get rules from the chain to extract allow list
            let rules = list_chain_rules(&chain_name).await?;
            let mut allow_list = Vec::default();

            for rule in rules {
                // Parse RETURN rules which contain allowed destinations
                if rule.contains("RETURN") && rule.contains("-d") {
                    if let Some(dest) = extract_destination(&rule) {
                        allow_list.push(dest);
                    }
                }
            }

            // If chain exists but no allow list, it's blocking all
            let block_all = allow_list.is_empty();
            let list_str = if allow_list.is_empty() {
                None
            } else {
                Some(allow_list.join(","))
            };

            (Some(block_all), list_str)
        } else {
            (None, None)
        };

        // Check if network limiter exists in mangle table
        let mangle_exists = chain_exists_table("mangle", &chain_name).await?;
        let network_limit_egress = if mangle_exists { Some(true) } else { None };

        Ok(NetworkSettings {
            network_block_all,
            network_allow_list,
            network_limit_egress,
        })
    }
}

#[derive(Debug, Clone)]
pub struct NetworkSettings {
    pub network_block_all: Option<bool>,
    pub network_allow_list: Option<String>,
    pub network_limit_egress: Option<bool>,
}

impl NetRulesManager {
    pub async fn delete_chain_rule(&self, table: &str, chain: &str, rule: &str) -> Result<()> {
        let _guard = self.mu.lock().await;
        if let Some(args) = parse_rule_arguments(rule) {
            iptables_cmd_table(
                table,
                &[
                    &["-D", chain],
                    args.iter()
                        .map(|s| s.as_str())
                        .collect::<Vec<_>>()
                        .as_slice(),
                ]
                .concat(),
            )
            .await?;
        }
        Ok(())
    }

    pub async fn clear_and_delete_chain(&self, table: &str, chain_name: &str) -> Result<()> {
        let _guard = self.mu.lock().await;
        let _ = iptables_cmd_table(table, &["--flush", chain_name]).await;
        let _ = iptables_cmd_table(table, &["--delete-chain", chain_name]).await;
        Ok(())
    }
}

fn format_chain_name(name: &str) -> String {
    if name.starts_with(CHAIN_PREFIX) {
        name.to_owned()
    } else {
        format!("{}{}", CHAIN_PREFIX, name)
    }
}

fn parse_cidr_networks(networks: &str) -> Result<Vec<String>> {
    let mut cidrs = Vec::default();
    for network in networks.split(',') {
        let trimmed = network.trim();
        if trimmed.is_empty() {
            continue;
        }
        let (ip_str, prefix_str) = trimmed
            .split_once('/')
            .ok_or_else(|| anyhow::anyhow!("invalid CIDR network: {}", trimmed))?;
        let ip: std::net::IpAddr = ip_str
            .parse()
            .map_err(|_| anyhow::anyhow!("invalid IP in CIDR network: {}", trimmed))?;
        let prefix: u8 = prefix_str
            .parse()
            .map_err(|_| anyhow::anyhow!("invalid prefix length in CIDR network: {}", trimmed))?;
        let max_prefix = if ip.is_ipv4() { 32 } else { 128 };
        if prefix > max_prefix {
            anyhow::bail!(
                "prefix length {} out of range for {}: {}",
                prefix,
                if ip.is_ipv4() { "IPv4" } else { "IPv6" },
                trimmed
            );
        }
        cidrs.push(trimmed.to_owned());
    }
    Ok(cidrs)
}

pub fn parse_rule_arguments(rule: &str) -> Option<Vec<String>> {
    if rule.starts_with("-A ") {
        let parts: Vec<&str> = rule.splitn(3, ' ').collect();
        if parts.len() >= 3 {
            return Some(parts[2].split_whitespace().map(|s| s.to_owned()).collect());
        }
    }
    None
}

pub fn extract_container_id_from_chain(chain_name: &str) -> Option<&str> {
    chain_name.strip_prefix(CHAIN_PREFIX)
}

async fn iptables_cmd(args: &[&str]) -> Result<()> {
    iptables_cmd_table("filter", args).await
}

async fn iptables_cmd_table(table: &str, args: &[&str]) -> Result<()> {
    let mut cmd_args = vec!["-t", table];
    cmd_args.extend(args);

    let output = Command::new("iptables")
        .args(&cmd_args)
        .output()
        .await
        .context("failed to run iptables")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("iptables command failed: {}", stderr.trim());
    }

    Ok(())
}

async fn iptables_insert_unique(args: &[&str]) -> Result<()> {
    let check_args: Vec<&str> = args
        .iter()
        .map(|a| match *a {
            "-I" => "-C",
            _ => a,
        })
        .filter(|a| a.parse::<u32>().is_err() || *a == "1")
        .collect();

    let filtered: Vec<&str> = check_args
        .into_iter()
        .filter(|a| a.parse::<u32>().is_err())
        .collect();

    if iptables_cmd(&filtered).await.is_ok() {
        return Ok(());
    }

    iptables_cmd(args).await
}

async fn list_rules(table: &str, chain: &str) -> Result<Vec<String>> {
    let output = Command::new("iptables")
        .args(["-t", table, "-S", chain])
        .output()
        .await
        .context("failed to run iptables")?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.lines().map(|l| l.to_owned()).collect())
}

async fn chain_exists(chain_name: &str) -> Result<bool> {
    chain_exists_table("filter", chain_name).await
}

async fn chain_exists_table(table: &str, chain_name: &str) -> Result<bool> {
    let output = Command::new("iptables")
        .args(["-t", table, "-L", chain_name])
        .output()
        .await
        .context("failed to run iptables")?;

    Ok(output.status.success())
}

async fn list_chain_rules(chain_name: &str) -> Result<Vec<String>> {
    let output = Command::new("iptables")
        .args(["-S", chain_name])
        .output()
        .await
        .context("failed to list chain rules")?;

    if !output.status.success() {
        return Ok(Vec::default());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout
        .lines()
        .filter(|line| line.starts_with("-A"))
        .map(|s| s.to_owned())
        .collect())
}

fn extract_destination(rule: &str) -> Option<String> {
    // Parse rule like: "-A SNAPFLOW-SB-abc123 -d 10.0.0.0/8 -p all -j RETURN"
    let parts: Vec<&str> = rule.split_whitespace().collect();
    for (i, part) in parts.iter().enumerate() {
        if *part == "-d" && i + 1 < parts.len() {
            return Some(parts[i + 1].to_owned());
        }
    }
    None
}

async fn save_iptables_rules() -> Result<()> {
    let output = Command::new("sh")
        .args(["-c", "iptables-save > /etc/iptables/rules.v4"])
        .output()
        .await
        .context("failed to save iptables rules")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("iptables-save failed: {}", stderr.trim());
    }

    Ok(())
}

async fn persist_rules_loop(cancel: CancellationToken, _mu: Arc<Mutex<()>>) {
    info!("starting iptables persistence loop");
    let mut ticker = tokio::time::interval(Duration::from_secs(60));
    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                info!("stopping iptables persistence loop");
                return;
            }
            _ = ticker.tick() => {
                if let Err(e) = save_iptables_rules().await {
                    error!("failed to save iptables rules: {e}");
                }
            }
        }
    }
}

pub fn get_container_ip(inspect: &bollard::models::ContainerInspectResponse) -> String {
    let networks = match inspect
        .network_settings
        .as_ref()
        .and_then(|ns| ns.networks.as_ref())
    {
        Some(n) => n,
        None => return String::default(),
    };

    if let Some(bridge) = networks.get("bridge") {
        if let Some(ref ip) = bridge.ip_address {
            if !ip.is_empty() {
                return ip.clone();
            }
        }
    }

    for network in networks.values() {
        if let Some(ref ip) = network.ip_address {
            if !ip.is_empty() {
                return ip.clone();
            }
        }
    }

    String::default()
}
