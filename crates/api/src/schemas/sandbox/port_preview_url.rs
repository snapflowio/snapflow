// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Serialize, ToSchema)]
#[schema(as = PortPreviewUrl)]
#[serde(rename_all = "camelCase")]
pub struct PortPreviewUrlDto {
    #[schema(example = "https://123456-mysandbox.executor.com")]
    pub url: String,
    #[schema(example = "ul67qtv-jl6wb9z5o3eii-ljqt9qed6l")]
    pub token: String,
    #[schema(example = "https://3000-mysandbox.executor.com")]
    pub legacy_proxy_url: Option<String>,
}
