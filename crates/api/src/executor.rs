// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

mod adapter;
mod client;

pub use adapter::{ExecutorAdapter, ExecutorInfo, ExecutorMetrics, ExecutorSandboxInfo};
pub use client::ExecutorClient;

use crate::models::Executor;
use snapflow_errors::AppError;

pub fn create_adapter(executor: &Executor) -> Result<Box<dyn ExecutorAdapter>, AppError> {
    match executor.version.as_str() {
        "0" => Ok(Box::new(ExecutorClient::new(executor)?)),
        v => Err(AppError::BadRequest(format!(
            "unsupported executor version: {v}"
        ))),
    }
}
