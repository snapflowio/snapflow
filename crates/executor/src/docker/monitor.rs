// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use bollard::container::ListContainersOptions;
use bollard::system::EventsOptions;
use futures_util::StreamExt;
use tokio::time::interval;
use tokio_util::sync::CancellationToken;
use tracing::{error, info, warn};

use crate::cache::ExecutorCache;
use crate::models::SandboxState;
use crate::netrules::{self, NetRulesManager};

use super::DockerClient;

const RECONCILE_INTERVAL: Duration = Duration::from_secs(60);
const RECONNECT_DELAY: Duration = Duration::from_secs(2);

pub struct DockerMonitor {
    docker: Arc<DockerClient>,
    cache: Arc<ExecutorCache>,
    cancel: CancellationToken,
    net_rules_manager: Arc<NetRulesManager>,
}

impl DockerMonitor {
    pub fn new(
        docker: Arc<DockerClient>,
        cache: Arc<ExecutorCache>,
        cancel: CancellationToken,
        net_rules_manager: Arc<NetRulesManager>,
    ) -> Self {
        Self {
            docker,
            cache,
            cancel,
            net_rules_manager,
        }
    }

    pub async fn start(self: Arc<Self>) {
        let reconciler = Arc::clone(&self);
        let reconciler_cancel = self.cancel.clone();
        tokio::spawn(async move {
            reconciler.reconciler_loop(reconciler_cancel).await;
        });

        loop {
            if self.cancel.is_cancelled() {
                return;
            }

            match self.monitor_events().await {
                Ok(()) => return,
                Err(e) => {
                    if is_connection_error(&e) {
                        warn!("docker event stream connection error, reconnecting: {e}");
                        tokio::select! {
                            _ = tokio::time::sleep(RECONNECT_DELAY) => {}
                            _ = self.cancel.cancelled() => return,
                        }
                    } else {
                        error!("fatal docker event stream error: {e}");
                        return;
                    }
                }
            }
        }
    }

    async fn monitor_events(&self) -> Result<(), anyhow::Error> {
        self.reconcile().await;
        self.reconcile_network_rules("filter", "DOCKER-USER").await;
        self.reconcile_network_rules("mangle", "PREROUTING").await;

        let mut filters = HashMap::new();
        filters.insert("type".to_owned(), vec!["container".to_owned()]);
        filters.insert(
            "event".to_owned(),
            vec![
                "start".to_owned(),
                "stop".to_owned(),
                "kill".to_owned(),
                "destroy".to_owned(),
            ],
        );

        let options = EventsOptions::<String> {
            since: None,
            until: None,
            filters,
        };

        let mut stream = self.docker.api_client.events(Some(options));

        loop {
            tokio::select! {
                _ = self.cancel.cancelled() => return Ok(()),
                event = stream.next() => {
                    match event {
                        Some(Ok(ev)) => self.handle_container_event(ev).await,
                        Some(Err(e)) => return Err(e.into()),
                        None => return Ok(()),
                    }
                }
            }
        }
    }

    async fn handle_container_event(&self, event: bollard::models::EventMessage) {
        let action = match event.action.as_deref() {
            Some(a) => a,
            None => return,
        };

        let attrs = match event.actor.as_ref().and_then(|a| a.attributes.as_ref()) {
            Some(a) => a,
            None => return,
        };

        let is_snapflow = attrs.keys().any(|k| k.starts_with("snapflow."));
        if !is_snapflow {
            return;
        }

        let sandbox_id = match attrs.get("name") {
            Some(name) => name.clone(),
            None => return,
        };

        info!(sandbox_id = %sandbox_id, action = %action, "container event");

        let container_id = event
            .actor
            .as_ref()
            .and_then(|a| a.id.as_deref())
            .unwrap_or("");

        let short_id = if container_id.len() >= 12 {
            &container_id[..12]
        } else {
            container_id
        };

        match action {
            "start" => {
                let cached = self.cache.get_or_default(&sandbox_id).await;
                if matches!(
                    cached.sandbox_state,
                    SandboxState::PullingImage | SandboxState::Creating
                ) {
                    return;
                }
                self.cache
                    .set_sandbox_state(&sandbox_id, SandboxState::Started)
                    .await;

                if let Ok(ct) = self
                    .docker
                    .api_client
                    .inspect_container(container_id, None)
                    .await
                {
                    let ip = netrules::get_container_ip(&ct);
                    if !ip.is_empty() {
                        let nrm = Arc::clone(&self.net_rules_manager);
                        let sid = short_id.to_owned();
                        tokio::spawn(async move {
                            if let Err(e) = nrm.assign_network_rules(&sid, &ip).await {
                                error!("failed to assign network rules on start: {e}");
                            }
                        });
                    }
                }
            }
            "stop" | "kill" => {
                self.cache
                    .set_sandbox_state(&sandbox_id, SandboxState::Stopped)
                    .await;

                let nrm = Arc::clone(&self.net_rules_manager);
                let sid = short_id.to_owned();
                tokio::spawn(async move {
                    if let Err(e) = nrm.unassign_network_rules(&sid).await {
                        error!("failed to unassign network rules on stop/kill: {e}");
                    }
                    if let Err(e) = nrm.remove_network_limiter(&sid).await {
                        error!("failed to remove network limiter on stop/kill: {e}");
                    }
                });
            }
            "destroy" => {
                self.cache
                    .set_sandbox_state(&sandbox_id, SandboxState::Destroyed)
                    .await;

                let nrm = Arc::clone(&self.net_rules_manager);
                let sid = short_id.to_owned();
                tokio::spawn(async move {
                    if let Err(e) = nrm.delete_network_rules(&sid).await {
                        error!("failed to delete network rules on destroy: {e}");
                    }
                });
            }
            _ => {}
        }
    }

    async fn reconciler_loop(&self, cancel: CancellationToken) {
        let mut ticker = interval(RECONCILE_INTERVAL);
        loop {
            tokio::select! {
                _ = cancel.cancelled() => return,
                _ = ticker.tick() => {
                    self.reconcile().await;
                    self.reconcile_network_rules("filter", "DOCKER-USER").await;
                    self.reconcile_network_rules("mangle", "PREROUTING").await;
                    self.reconcile_chains("filter").await;
                    self.reconcile_chains("mangle").await;
                }
            }
        }
    }

    async fn reconcile_network_rules(&self, table: &str, chain: &str) {
        let rules = match self
            .net_rules_manager
            .list_snapflow_rules(table, chain)
            .await
        {
            Ok(r) => r,
            Err(e) => {
                error!("failed to list snapflow rules: {e}");
                return;
            }
        };

        for rule in &rules {
            let args = match netrules::parse_rule_arguments(rule) {
                Some(a) => a,
                None => {
                    warn!(rule = %rule, "skipping malformed iptables rule");
                    continue;
                }
            };

            let mut chain_name = String::new();
            let mut source_ip = String::new();
            let mut iter = args.iter();

            while let Some(arg) = iter.next() {
                match arg.as_str() {
                    "-j" => {
                        if let Some(val) = iter.next() {
                            chain_name = val.clone();
                        }
                    }
                    "-s" => {
                        if let Some(val) = iter.next() {
                            source_ip = val.clone();
                        }
                    }
                    _ => {}
                }
            }

            if chain_name.is_empty() || source_ip.is_empty() {
                continue;
            }

            let container_id = match netrules::extract_container_id_from_chain(&chain_name) {
                Some(id) => id,
                None => continue,
            };

            let ct = match self
                .docker
                .api_client
                .inspect_container(container_id, None)
                .await
            {
                Ok(ct) => ct,
                Err(_) => {
                    if let Err(e) = self
                        .net_rules_manager
                        .unassign_network_rules(container_id)
                        .await
                    {
                        error!(
                            "failed to unassign rules for missing container {container_id}: {e}"
                        );
                    }
                    continue;
                }
            };

            let ip_address = netrules::get_container_ip(&ct);
            let rule_ip = source_ip.split('/').next().unwrap_or(&source_ip);

            if ip_address != rule_ip {
                warn!(
                    "IP mismatch for container {container_id}: rule has {rule_ip}, container has {ip_address}"
                );
                if let Err(e) = self
                    .net_rules_manager
                    .delete_chain_rule(table, chain, rule)
                    .await
                {
                    error!("failed to delete mismatched rule for {container_id}: {e}");
                }
            }
        }
    }

    async fn reconcile_chains(&self, table: &str) {
        let chains = match self.net_rules_manager.list_snapflow_chains(table).await {
            Ok(c) => c,
            Err(e) => {
                error!("failed to list snapflow chains: {e}");
                return;
            }
        };

        for chain_name in &chains {
            let container_id = match netrules::extract_container_id_from_chain(chain_name) {
                Some(id) => id,
                None => continue,
            };

            if self
                .docker
                .api_client
                .inspect_container(container_id, None)
                .await
                .is_err()
            {
                info!(
                    "container {container_id} does not exist, deleting orphaned chain {chain_name}"
                );
                if let Err(e) = self
                    .net_rules_manager
                    .clear_and_delete_chain(table, chain_name)
                    .await
                {
                    error!("failed to delete orphaned chain {chain_name}: {e}");
                }
            }
        }
    }

    async fn reconcile(&self) {
        let mut filters = HashMap::new();
        filters.insert(
            "label".to_owned(),
            vec!["snapflow.meta.organizationId".to_owned()],
        );

        let options = ListContainersOptions {
            all: true,
            filters,
            ..Default::default()
        };

        let containers = match self.docker.api_client.list_containers(Some(options)).await {
            Ok(c) => c,
            Err(e) => {
                error!("failed to list containers for reconciliation: {e}");
                return;
            }
        };

        for container in containers {
            let names = match container.names {
                Some(ref n) => n,
                None => continue,
            };

            for name in names {
                let sandbox_id = name.trim_start_matches('/');
                if sandbox_id.is_empty() {
                    continue;
                }

                let state = map_container_status(container.status.as_deref().unwrap_or(""));
                self.cache.set_sandbox_state(sandbox_id, state).await;
            }
        }
    }
}

fn map_container_status(status: &str) -> SandboxState {
    let lower = status.to_lowercase();
    if lower.starts_with("up") {
        SandboxState::Started
    } else if lower.starts_with("exited") || lower.starts_with("stopped") {
        SandboxState::Stopped
    } else if lower.starts_with("created") {
        SandboxState::Creating
    } else if lower.starts_with("restarting") {
        SandboxState::Starting
    } else if lower.starts_with("removing") {
        SandboxState::Destroying
    } else if lower.starts_with("paused") {
        SandboxState::Stopped
    } else if lower.starts_with("dead") {
        SandboxState::Destroyed
    } else {
        SandboxState::Unknown
    }
}

fn is_connection_error(err: &anyhow::Error) -> bool {
    let msg = err.to_string().to_lowercase();
    msg.contains("connection refused")
        || msg.contains("connection reset")
        || msg.contains("broken pipe")
        || msg.contains("eof")
        || msg.contains("unexpected eof")
        || msg.contains("timed out")
        || msg.contains("timeout")
        || msg.contains("context deadline exceeded")
        || msg.contains("connection aborted")
        || msg.contains("no such host")
        || msg.contains("cannot connect to the docker daemon")
}
