// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use utoipa::OpenApi;

use crate::api::controllers::{health, image, info, sandbox};
use crate::api::dto;
use crate::api::errors::ErrorResponse;
use crate::models::{BackupState, SandboxState};

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Snapflow Executor API",
        version = "0.1.0",
        description = "Snapflow Executor API"
    ),
    paths(
        health::health_check,
        sandbox::create,
        sandbox::info,
        sandbox::destroy,
        sandbox::start,
        sandbox::stop,
        sandbox::resize,
        sandbox::remove_destroyed,
        sandbox::create_backup,
        image::pull_image,
        image::build_image,
        image::image_exists,
        image::remove_image,
        image::get_build_logs,
        info::executor_info,
    ),
    components(schemas(
        dto::sandbox::CreateSandboxDTO,
        dto::sandbox::ResizeSandboxDTO,
        dto::sandbox::SandboxInfoResponse,
        dto::image::PullImageRequestDTO,
        dto::image::BuildImageRequestDTO,
        dto::image::ImageExistsResponse,
        dto::registry::RegistryDTO,
        dto::volume::BucketDTO,
        dto::info::ExecutorInfoResponseDTO,
        dto::info::ExecutorMetrics,
        dto::backup::CreateBackupDTO,
        ErrorResponse,
        SandboxState,
        BackupState,
    )),
    security(
        ("bearer" = [])
    ),
    modifiers()
)]
pub struct ApiDoc;
