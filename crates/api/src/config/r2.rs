// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use envconfig::Envconfig;
use validator::Validate;

#[derive(Debug, Clone, Envconfig, Validate)]
pub struct R2Config {
    #[envconfig(from = "R2_ENDPOINT", default = "")]
    pub endpoint: String,

    #[envconfig(from = "R2_REGION", default = "auto")]
    pub region: String,

    #[envconfig(from = "R2_ACCESS_KEY", default = "")]
    pub access_key: String,

    #[envconfig(from = "R2_SECRET_KEY", default = "")]
    pub secret_key: String,

    #[envconfig(from = "R2_DEFAULT_BUCKET", default = "snapflow")]
    #[validate(length(min = 1))]
    pub default_bucket: String,

    #[envconfig(from = "R2_PRESIGNED_URL_EXPIRY", default = "3600")]
    pub presigned_url_expiry: u64,
}

impl R2Config {
    pub fn is_configured(&self) -> bool {
        !self.endpoint.is_empty() && !self.access_key.is_empty() && !self.secret_key.is_empty()
    }
}
