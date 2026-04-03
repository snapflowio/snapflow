// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::collections::HashMap;
use std::net::Ipv4Addr;

use serde::Deserialize;
#[allow(unused_imports)]
use serde_json::json;
use utoipa::ToSchema;
use validator::Validate;

use snapflow_models::SandboxClass;

use crate::constants::sandbox::MAX_NETWORK_ALLOW_LIST_ENTRIES;

use super::build_info::CreateBuildInfoDto;
use super::sandbox_response::SandboxBucketRef;

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[schema(as = CreateSandbox)]
#[serde(rename_all = "camelCase")]
pub struct CreateSandboxDto {
    #[schema(example = "ubuntu-4vcpu-8ram-100gb")]
    pub image: Option<String>,
    #[schema(example = "snapflow")]
    pub user: Option<String>,
    #[schema(example = json!({"NODE_ENV": "production"}))]
    pub env: Option<HashMap<String, String>>,
    #[schema(example = json!({"snapflow.io/public": "true"}))]
    pub labels: Option<HashMap<String, String>>,
    #[schema(example = false)]
    pub public: Option<bool>,
    pub class: Option<SandboxClass>,
    #[schema(example = "us")]
    pub target: Option<String>,
    #[schema(example = 2)]
    pub cpu: Option<i32>,
    #[schema(example = 1)]
    pub gpu: Option<i32>,
    #[schema(example = 1)]
    pub memory: Option<i32>,
    #[schema(example = 3)]
    pub disk: Option<i32>,
    #[schema(example = 30)]
    pub auto_stop_interval: Option<i32>,
    #[schema(example = 0)]
    pub auto_archive_interval: Option<i32>,
    #[schema(example = 30)]
    pub auto_delete_interval: Option<i32>,
    pub buckets: Option<Vec<SandboxBucketRef>>,
    pub build_info: Option<CreateBuildInfoDto>,
    #[schema(example = false)]
    pub network_block_all: Option<bool>,
    #[schema(example = "10.0.0.0/8,172.16.0.0/12")]
    #[validate(custom(function = "validate_network_allow_list"))]
    pub network_allow_list: Option<String>,
}

fn validate_network_allow_list(value: &str) -> std::result::Result<(), validator::ValidationError> {
    let networks: Vec<&str> = value.split(',').map(|s| s.trim()).collect();

    let non_empty: Vec<&str> = networks.into_iter().filter(|s| !s.is_empty()).collect();

    if non_empty.len() > MAX_NETWORK_ALLOW_LIST_ENTRIES {
        let mut err = validator::ValidationError::new("network_allow_list");
        err.message = Some(
            format!(
                "network allow list cannot contain more than {MAX_NETWORK_ALLOW_LIST_ENTRIES} entries"
            )
            .into(),
        );
        return Err(err);
    }

    for network in &non_empty {
        let Some((ip_str, prefix_str)) = network.split_once('/') else {
            let mut err = validator::ValidationError::new("network_allow_list");
            err.message = Some(
                format!(
                    "invalid network format: \"{network}\". Missing CIDR prefix length (e.g., /24)"
                )
                .into(),
            );
            return Err(err);
        };

        if ip_str.parse::<Ipv4Addr>().is_err() {
            let mut err = validator::ValidationError::new("network_allow_list");
            err.message =
                Some(format!("invalid IPv4 address: \"{ip_str}\" in network \"{network}\"").into());
            return Err(err);
        }

        let prefix: u8 = prefix_str.parse().map_err(|_| {
            let mut err = validator::ValidationError::new("network_allow_list");
            err.message = Some(
                format!("invalid CIDR prefix length: \"{prefix_str}\" in network \"{network}\"")
                    .into(),
            );
            err
        })?;

        if prefix > 32 {
            let mut err = validator::ValidationError::new("network_allow_list");
            err.message = Some(
                format!("CIDR prefix must be between 0 and 32, got {prefix} in \"{network}\"")
                    .into(),
            );
            return Err(err);
        }
    }

    Ok(())
}
