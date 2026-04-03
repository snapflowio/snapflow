// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

pub use snapflow_errors::{AppError, ErrorResponse};

pub fn docker_error_to_app_error(err: anyhow::Error) -> AppError {
    let msg = err.to_string();
    let lower = msg.to_lowercase();

    if lower.contains("unauthorized") {
        return AppError::unauthorized(msg);
    }

    if lower.contains("conflict") || lower.contains("already exists") {
        return AppError::conflict(msg);
    }

    if lower.contains("not found")
        || lower.contains("no such container")
        || lower.contains("no such image")
    {
        return AppError::not_found(msg);
    }

    if lower.contains("bad request")
        || lower.contains("invalid")
        || lower.contains("unable to find user")
    {
        return AppError::bad_request(msg);
    }

    if lower.contains("timeout") || lower.contains("timed out") {
        return AppError::timeout(msg);
    }

    if let Some(docker_err) = err.downcast_ref::<bollard::errors::Error>() {
        return match docker_err {
            bollard::errors::Error::DockerResponseServerError {
                status_code: 401, ..
            } => AppError::unauthorized(msg),
            bollard::errors::Error::DockerResponseServerError {
                status_code: 404, ..
            } => AppError::not_found(msg),
            bollard::errors::Error::DockerResponseServerError {
                status_code: 409, ..
            } => AppError::conflict(msg),
            bollard::errors::Error::DockerResponseServerError {
                status_code: 400, ..
            } => AppError::bad_request(msg),
            _ => AppError::internal(msg),
        };
    }

    AppError::from(err)
}
