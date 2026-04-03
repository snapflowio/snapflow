// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::Deserialize;
use utoipa::ToSchema;
use validator::Validate;

use snapflow_models::RegistryType;

#[derive(Deserialize, Validate, ToSchema)]
#[schema(as = CreateRegistry)]
#[serde(rename_all = "camelCase")]
pub struct CreateRegistryDto {
    #[validate(length(min = 1))]
    pub name: String,
    #[validate(url)]
    pub url: String,
    #[validate(length(min = 1))]
    pub username: String,
    #[validate(length(min = 1))]
    pub password: String,
    pub project: Option<String>,
    #[schema(inline)]
    pub registry_type: RegistryType,
    pub is_default: Option<bool>,
}
