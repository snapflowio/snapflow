// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use async_trait::async_trait;

use crate::models::{BuildInfo, Registry, Sandbox};
use snapflow_errors::AppError;
use snapflow_models::{BackupState, SandboxState};

#[derive(Debug, Clone, Default)]
pub struct ExecutorMetrics {
    pub current_allocated_cpu: i32,
    pub current_allocated_disk_gib: i32,
    pub current_allocated_memory_gib: i32,
    pub current_cpu_usage_percentage: f64,
    pub current_disk_usage_percentage: f64,
    pub current_memory_usage_percentage: f64,
    pub current_image_count: i32,
}

#[derive(Debug, Clone, Default)]
pub struct ExecutorInfo {
    pub metrics: Option<ExecutorMetrics>,
}

#[derive(Debug, Clone)]
pub struct ExecutorSandboxInfo {
    pub state: SandboxState,
    pub backup_state: BackupState,
    pub backup_error: Option<String>,
}

#[async_trait]
pub trait ExecutorAdapter: Send + Sync {
    async fn health_check(&self) -> Result<(), AppError>;
    async fn executor_info(&self) -> Result<ExecutorInfo, AppError>;

    async fn sandbox_info(&self, sandbox_id: &str) -> Result<ExecutorSandboxInfo, AppError>;
    async fn create_sandbox(
        &self,
        sandbox: &Sandbox,
        registry: Option<&Registry>,
        entrypoint: Option<Vec<String>>,
    ) -> Result<(), AppError>;
    async fn start_sandbox(&self, sandbox_id: &str) -> Result<(), AppError>;
    async fn stop_sandbox(&self, sandbox_id: &str) -> Result<(), AppError>;
    async fn destroy_sandbox(&self, sandbox_id: &str) -> Result<(), AppError>;
    async fn remove_destroyed_sandbox(&self, sandbox_id: &str) -> Result<(), AppError>;

    async fn create_backup(
        &self,
        sandbox_id: &str,
        backup_image: &str,
        registry: Option<&Registry>,
    ) -> Result<(), AppError>;

    async fn remove_image(&self, image_name: &str) -> Result<(), AppError>;
    async fn build_image(
        &self,
        build_info: &BuildInfo,
        organization_id: Option<&str>,
        registry: Option<&Registry>,
        push_to_internal_registry: Option<bool>,
    ) -> Result<(), AppError>;
    async fn pull_image(
        &self,
        image_name: &str,
        registry: Option<&Registry>,
    ) -> Result<(), AppError>;
    async fn image_exists(&self, image_name: &str) -> Result<bool, AppError>;
    async fn get_image_logs(&self, image_ref: &str, follow: bool) -> Result<String, AppError>;

    async fn resize_sandbox(&self, sandbox_id: &str, cpu: i32, memory: i32)
    -> Result<(), AppError>;

    async fn get_sandbox_node_version(&self, sandbox_id: &str) -> Result<String, AppError>;
}
