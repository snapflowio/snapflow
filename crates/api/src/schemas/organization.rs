// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

mod create_organization;
mod organization_invitation;
mod organization_response;
mod organization_role;
mod organization_suspension;
mod organization_user;
mod overview;
mod update_quota;

pub use create_organization::*;
pub use organization_invitation::*;
pub use organization_response::*;
pub use organization_role::*;
pub use organization_suspension::*;
pub use organization_user::*;
pub use overview::*;
pub use update_quota::*;

use snapflow_models::OrganizationResourcePermission;

pub(crate) fn parse_permissions(perms: &[String]) -> Vec<OrganizationResourcePermission> {
    perms.iter().filter_map(|p| p.parse().ok()).collect()
}
