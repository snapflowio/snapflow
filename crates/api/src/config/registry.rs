// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use envconfig::Envconfig;
use validator::Validate;

#[derive(Debug, Clone, Envconfig, Validate)]
pub struct TransientRegistryConfig {
    #[envconfig(from = "TRANSIENT_REGISTRY_URL", default = "")]
    pub url: String,

    #[envconfig(from = "TRANSIENT_REGISTRY_ADMIN", default = "snapflow")]
    pub admin: String,

    #[envconfig(from = "TRANSIENT_REGISTRY_PASSWORD", default = "registry_pass")]
    pub password: String,

    #[envconfig(from = "TRANSIENT_REGISTRY_PROJECT_ID", default = "snapflow")]
    pub project_id: String,
}

#[derive(Debug, Clone, Envconfig, Validate)]
pub struct InternalRegistryConfig {
    #[envconfig(from = "INTERNAL_REGISTRY_URL", default = "")]
    pub url: String,

    #[envconfig(from = "INTERNAL_REGISTRY_ADMIN", default = "snapflow")]
    pub admin: String,

    #[envconfig(from = "INTERNAL_REGISTRY_PASSWORD", default = "registry_pass")]
    pub password: String,

    #[envconfig(from = "INTERNAL_REGISTRY_PROJECT_ID", default = "snapflow")]
    pub project_id: String,
}
