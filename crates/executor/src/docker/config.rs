// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use anyhow::Result;
use bollard::container::NetworkingConfig;
use bollard::models::{EndpointSettings, HostConfig};
use std::collections::HashMap;

use crate::api::dto::sandbox::CreateSandboxDTO;

use super::DockerClient;

impl DockerClient {
    pub fn build_container_config(
        &self,
        sandbox_dto: &CreateSandboxDTO,
    ) -> bollard::container::Config<String> {
        let mut env_vars = vec![
            format!("SNAPFLOW_SANDBOX_ID={}", sandbox_dto.id),
            format!("SNAPFLOW_SANDBOX_IMAGE={}", sandbox_dto.image),
            format!("SNAPFLOW_SANDBOX_USER={}", sandbox_dto.os_user),
        ];

        let home = format!("/home/{}", sandbox_dto.os_user);
        let ca_bundle = format!("{home}/.snapflow/certs/ca-bundle.crt");
        env_vars.push("SNAPFLOW_DNS_UPSTREAM=8.8.8.8".to_string());
        env_vars.push("HTTP_PROXY=http://127.0.0.1:8080".to_string());
        env_vars.push("HTTPS_PROXY=http://127.0.0.1:8080".to_string());
        env_vars.push("NO_PROXY=127.0.0.1,localhost".to_string());
        env_vars.push(format!("SSL_CERT_FILE={ca_bundle}"));
        env_vars.push(format!("CURL_CA_BUNDLE={ca_bundle}"));
        env_vars.push(format!("REQUESTS_CA_BUNDLE={ca_bundle}"));
        env_vars.push(format!(
            "NODE_EXTRA_CA_CERTS={home}/.snapflow/certs/snapflow-ca.crt"
        ));

        if let Some(ref env) = sandbox_dto.env {
            for (key, value) in env {
                env_vars.push(format!("{}={}", key, value));
            }
        }

        let entrypoint = sandbox_dto
            .entrypoint
            .as_ref()
            .map(|e| e.iter().map(|s| s.to_string()).collect::<Vec<_>>());

        let mut labels: HashMap<String, String> = HashMap::default();

        if let Some(ref metadata) = sandbox_dto.metadata {
            if let Some(org_id) = metadata.get("organizationId").filter(|v| !v.is_empty()) {
                labels.insert("snapflow.organization_id".to_string(), org_id.clone());
            }
            if let Some(org_name) = metadata.get("organizationName").filter(|v| !v.is_empty()) {
                labels.insert("snapflow.organization_name".to_string(), org_name.clone());
            }
            for (key, value) in metadata {
                labels.insert(format!("snapflow.meta.{}", key), value.clone());
            }
        }

        if let Some(ref extra_labels) = sandbox_dto.labels {
            for (key, value) in extra_labels {
                labels.insert(format!("snapflow.{}", key), value.clone());
            }
        }

        bollard::container::Config {
            hostname: Some(sandbox_dto.id.clone()),
            image: Some(sandbox_dto.image.clone()),
            env: Some(env_vars),
            entrypoint,
            labels: Some(labels),
            attach_stdout: Some(true),
            attach_stderr: Some(true),
            ..Default::default()
        }
    }

    pub async fn build_host_config(
        &self,
        sandbox_dto: &CreateSandboxDTO,
        bucket_binds: Vec<String>,
    ) -> Result<HostConfig> {
        let mut binds = vec![format!(
            "{}:/usr/local/bin/snapflow:ro",
            self.node_path.display()
        )];
        binds.extend(bucket_binds);

        let mut host_config = HostConfig {
            privileged: Some(true),
            dns: Some(vec!["127.0.0.1".to_string()]),
            extra_hosts: Some(vec!["host.docker.internal:host-gateway".to_string()]),
            binds: Some(binds),
            ..Default::default()
        };

        if !self.resource_limits_disabled {
            let cpu_quota = i64::from(sandbox_dto.cpu_quota)
                .checked_mul(100_000)
                .ok_or_else(|| anyhow::anyhow!("cpu_quota overflow"))?;
            let memory_bytes = i64::from(sandbox_dto.memory_quota)
                .checked_mul(1024 * 1024 * 1024)
                .ok_or_else(|| anyhow::anyhow!("memory_quota overflow"))?;

            host_config.cpu_period = Some(100_000);
            host_config.cpu_quota = Some(cpu_quota);
            host_config.memory = Some(memory_bytes);
            host_config.memory_swap = Some(memory_bytes);
        }

        if let Some(ref runtime) = self.container_runtime {
            host_config.runtime = Some(runtime.clone());
        }

        let filesystem = self.cached_filesystem().await?;
        if filesystem.as_deref() == Some("xfs") {
            let mut storage_opt = HashMap::default();
            storage_opt.insert(
                "size".to_string(),
                format!("{}G", sandbox_dto.storage_quota),
            );
            host_config.storage_opt = Some(storage_opt);
        }

        Ok(host_config)
    }

    pub fn build_networking_config(&self) -> Option<NetworkingConfig<String>> {
        self.container_network.as_ref().map(|network| {
            let mut endpoints = HashMap::default();
            endpoints.insert(network.clone(), EndpointSettings::default());
            NetworkingConfig {
                endpoints_config: endpoints,
            }
        })
    }
}
