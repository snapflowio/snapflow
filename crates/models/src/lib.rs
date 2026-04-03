// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "sqlx", derive(sqlx::Type))]
#[cfg_attr(feature = "strum", derive(strum::Display))]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
#[cfg_attr(feature = "sqlx", sqlx(type_name = "text", rename_all = "snake_case"))]
#[cfg_attr(feature = "strum", strum(serialize_all = "snake_case"))]
pub enum SystemRole {
    Admin,
    User,
    Proxy,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "strum", derive(strum::Display, strum::EnumString))]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
pub enum OrganizationResourcePermission {
    #[serde(rename = "write:registries")]
    #[cfg_attr(feature = "strum", strum(serialize = "write:registries"))]
    WriteRegistries,
    #[serde(rename = "delete:registries")]
    #[cfg_attr(feature = "strum", strum(serialize = "delete:registries"))]
    DeleteRegistries,
    #[serde(rename = "write:images")]
    #[cfg_attr(feature = "strum", strum(serialize = "write:images"))]
    WriteImages,
    #[serde(rename = "delete:images")]
    #[cfg_attr(feature = "strum", strum(serialize = "delete:images"))]
    DeleteImages,
    #[serde(rename = "write:sandboxes")]
    #[cfg_attr(feature = "strum", strum(serialize = "write:sandboxes"))]
    WriteSandboxes,
    #[serde(rename = "delete:sandboxes")]
    #[cfg_attr(feature = "strum", strum(serialize = "delete:sandboxes"))]
    DeleteSandboxes,
    #[serde(rename = "read:buckets")]
    #[cfg_attr(feature = "strum", strum(serialize = "read:buckets"))]
    ReadBuckets,
    #[serde(rename = "write:buckets")]
    #[cfg_attr(feature = "strum", strum(serialize = "write:buckets"))]
    WriteBuckets,
    #[serde(rename = "delete:buckets")]
    #[cfg_attr(feature = "strum", strum(serialize = "delete:buckets"))]
    DeleteBuckets,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "sqlx", derive(sqlx::Type))]
#[cfg_attr(feature = "strum", derive(strum::Display))]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
#[cfg_attr(feature = "sqlx", sqlx(type_name = "text", rename_all = "snake_case"))]
#[cfg_attr(feature = "strum", strum(serialize_all = "snake_case"))]
pub enum OrganizationMemberRole {
    Owner,
    Member,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "sqlx", derive(sqlx::Type))]
#[cfg_attr(feature = "strum", derive(strum::Display))]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
#[cfg_attr(feature = "sqlx", sqlx(type_name = "text", rename_all = "snake_case"))]
#[cfg_attr(feature = "strum", strum(serialize_all = "snake_case"))]
pub enum OrganizationInvitationStatus {
    Pending,
    Accepted,
    Declined,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "sqlx", derive(sqlx::Type))]
#[cfg_attr(feature = "strum", derive(strum::Display))]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
#[cfg_attr(feature = "sqlx", sqlx(type_name = "text", rename_all = "snake_case"))]
#[cfg_attr(feature = "strum", strum(serialize_all = "snake_case"))]
pub enum RegistryType {
    Internal,
    Organization,
    Public,
    Transient,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "sqlx", derive(sqlx::Type))]
#[cfg_attr(feature = "strum", derive(strum::Display))]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
#[cfg_attr(feature = "sqlx", sqlx(type_name = "text", rename_all = "snake_case"))]
#[cfg_attr(feature = "strum", strum(serialize_all = "snake_case"))]
pub enum ExecutorState {
    Initializing,
    Ready,
    Disabled,
    Decommissioned,
    Unresponsive,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "sqlx", derive(sqlx::Type))]
#[cfg_attr(feature = "strum", derive(strum::Display))]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
#[cfg_attr(feature = "sqlx", sqlx(type_name = "text", rename_all = "snake_case"))]
#[cfg_attr(feature = "strum", strum(serialize_all = "snake_case"))]
pub enum ExecutorRegion {
    Eu,
    Us,
    Asia,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "sqlx", derive(sqlx::Type))]
#[cfg_attr(feature = "strum", derive(strum::Display))]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
#[cfg_attr(feature = "sqlx", sqlx(type_name = "text", rename_all = "snake_case"))]
#[cfg_attr(feature = "strum", strum(serialize_all = "snake_case"))]
pub enum SandboxClass {
    Small,
    Medium,
    Large,
}

#[derive(Debug, Clone, Copy)]
pub struct SandboxClassResources {
    pub cpu: i32,
    pub memory: i32,
    pub disk: i32,
}

impl SandboxClass {
    pub const fn resources(self) -> SandboxClassResources {
        match self {
            Self::Small => SandboxClassResources {
                cpu: 4,
                memory: 8,
                disk: 30,
            },
            Self::Medium => SandboxClassResources {
                cpu: 8,
                memory: 16,
                disk: 60,
            },
            Self::Large => SandboxClassResources {
                cpu: 12,
                memory: 24,
                disk: 90,
            },
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "sqlx", derive(sqlx::Type))]
#[cfg_attr(feature = "strum", derive(strum::Display))]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
#[cfg_attr(feature = "sqlx", sqlx(type_name = "text", rename_all = "snake_case"))]
#[cfg_attr(feature = "strum", strum(serialize_all = "snake_case"))]
pub enum SandboxState {
    Creating,
    Restoring,
    Destroyed,
    Destroying,
    Started,
    Stopped,
    Starting,
    Stopping,
    Resizing,
    Error,
    BuildFailed,
    PendingBuild,
    BuildingImage,
    Unknown,
    PullingImage,
    Archiving,
    Archived,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "sqlx", derive(sqlx::Type))]
#[cfg_attr(feature = "strum", derive(strum::Display))]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
#[cfg_attr(feature = "sqlx", sqlx(type_name = "text", rename_all = "snake_case"))]
#[cfg_attr(feature = "strum", strum(serialize_all = "snake_case"))]
pub enum SandboxDesiredState {
    Destroyed,
    Started,
    Stopped,
    Resized,
    Archived,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "sqlx", derive(sqlx::Type))]
#[cfg_attr(feature = "strum", derive(strum::Display))]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
#[cfg_attr(feature = "sqlx", sqlx(type_name = "text", rename_all = "snake_case"))]
#[cfg_attr(feature = "strum", strum(serialize_all = "snake_case"))]
pub enum ImageState {
    BuildPending,
    Building,
    Pending,
    Pulling,
    PendingValidation,
    Validating,
    Active,
    Inactive,
    Error,
    BuildFailed,
    Removing,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "sqlx", derive(sqlx::Type))]
#[cfg_attr(feature = "strum", derive(strum::Display))]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
#[cfg_attr(feature = "sqlx", sqlx(type_name = "text", rename_all = "snake_case"))]
#[cfg_attr(feature = "strum", strum(serialize_all = "snake_case"))]
pub enum ImageExecutorState {
    PullingImage,
    BuildingImage,
    Ready,
    Error,
    Removing,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "sqlx", derive(sqlx::Type))]
#[cfg_attr(feature = "strum", derive(strum::Display))]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
#[cfg_attr(feature = "sqlx", sqlx(type_name = "text", rename_all = "snake_case"))]
#[cfg_attr(feature = "strum", strum(serialize_all = "snake_case"))]
pub enum BucketState {
    Creating,
    Ready,
    PendingCreate,
    PendingDelete,
    Deleting,
    Deleted,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "sqlx", derive(sqlx::Type))]
#[cfg_attr(feature = "strum", derive(strum::Display))]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
#[cfg_attr(feature = "sqlx", sqlx(type_name = "text", rename_all = "snake_case"))]
#[cfg_attr(feature = "strum", strum(serialize_all = "snake_case"))]
pub enum BackupState {
    #[default]
    None,
    Pending,
    InProgress,
    Completed,
    Failed,
}
