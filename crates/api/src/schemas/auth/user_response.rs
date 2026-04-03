// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::models::User;
use snapflow_models::SystemRole;

#[derive(Serialize, ToSchema)]
#[schema(as = User)]
#[serde(rename_all = "camelCase")]
pub struct UserDto {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub email_verified: bool,
    #[schema(inline)]
    pub role: SystemRole,
}

impl From<&User> for UserDto {
    fn from(user: &User) -> Self {
        Self {
            id: user.id,
            name: user.name.clone(),
            email: user.email.clone(),
            email_verified: user.email_verified,
            role: user.role,
        }
    }
}
