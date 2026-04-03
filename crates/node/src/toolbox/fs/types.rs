// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

use crate::common::errors::AppError;

const DEFAULT_ROOT: &str = "/";

pub fn validate_path(user_path: &str) -> Result<PathBuf, AppError> {
    validate_path_within(user_path, DEFAULT_ROOT)
}

pub fn validate_path_within(user_path: &str, root: &str) -> Result<PathBuf, AppError> {
    let root = PathBuf::from(root);

    let candidate = if Path::new(user_path).is_absolute() {
        PathBuf::from(user_path)
    } else {
        std::env::current_dir()
            .map_err(AppError::from)?
            .join(user_path)
    };

    if let Ok(canonical) = std::fs::canonicalize(&candidate) {
        if canonical.starts_with(&root) {
            return Ok(canonical);
        }
        return Err(AppError::bad_request("path traversal detected"));
    }

    let mut resolved = PathBuf::default();
    for component in candidate.components() {
        match component {
            Component::Prefix(p) => resolved.push(p.as_os_str()),
            Component::RootDir => resolved.push("/"),
            Component::CurDir => {}
            Component::ParentDir => {
                resolved.pop();
            }
            Component::Normal(seg) => resolved.push(seg),
        }
    }

    if resolved.starts_with(&root) {
        Ok(resolved)
    } else {
        Err(AppError::bad_request("path traversal detected"))
    }
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub name: String,
    pub size: i64,
    pub mode: String,
    pub mod_time: String,
    pub is_dir: bool,
    pub owner: String,
    pub group: String,
    pub permissions: String,
}

#[derive(Deserialize, IntoParams)]
pub struct PathQuery {
    pub path: Option<String>,
}

#[derive(Deserialize, IntoParams)]
pub struct FindQuery {
    pub path: Option<String>,
    pub pattern: Option<String>,
}

#[derive(Deserialize, IntoParams)]
pub struct MoveQuery {
    pub source: Option<String>,
    pub destination: Option<String>,
}

#[derive(Deserialize, IntoParams)]
pub struct PermissionsQuery {
    pub path: Option<String>,
    pub owner: Option<String>,
    pub group: Option<String>,
    pub mode: Option<String>,
}

#[derive(Deserialize, IntoParams)]
pub struct FolderQuery {
    pub path: Option<String>,
    pub mode: Option<String>,
}

#[derive(Deserialize, IntoParams)]
pub struct DeleteQuery {
    pub path: Option<String>,
    pub recursive: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct Match {
    pub file: String,
    pub line: usize,
    pub content: String,
}

#[derive(Serialize, ToSchema)]
pub struct SearchFilesResponse {
    pub files: Vec<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct ReplaceRequest {
    pub files: Vec<String>,
    pub pattern: String,
    #[serde(rename = "newValue")]
    pub new_value: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct ReplaceResult {
    pub file: String,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
