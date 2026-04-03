// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::models::Executor;
use snapflow_models::{ExecutorState, SandboxClass};

#[derive(Debug, Clone, Serialize, ToSchema)]
#[schema(as = Executor)]
#[serde(rename_all = "camelCase")]
pub struct ExecutorDto {
    pub id: Uuid,
    #[schema(example = "executor-1.example.com")]
    pub domain: String,
    #[schema(example = "https://api.executor1.example.com")]
    pub api_url: String,
    #[schema(example = "https://proxy.executor1.example.com")]
    pub proxy_url: String,
    #[schema(example = "api-key-123")]
    pub api_key: String,
    #[schema(example = 16)]
    pub cpu: i32,
    #[schema(example = 16)]
    pub memory: i32,
    #[schema(example = 200)]
    pub disk: i32,
    #[schema(example = 0)]
    pub gpu: i32,
    pub gpu_type: String,
    pub class: SandboxClass,
    #[schema(example = 5)]
    pub used: i32,
    #[schema(example = 20)]
    pub capacity: i32,
    #[schema(example = 45.6)]
    pub current_cpu_usage_percentage: f32,
    #[schema(example = 68.2)]
    pub current_memory_usage_percentage: f32,
    #[schema(example = 33.8)]
    pub current_disk_usage_percentage: f32,
    #[schema(example = 4000)]
    pub current_allocated_cpu: i32,
    #[schema(example = 8)]
    pub current_allocated_memory_gib: i32,
    #[schema(example = 50)]
    pub current_allocated_disk_gib: i32,
    #[schema(example = 12)]
    pub current_image_count: i32,
    #[schema(example = 85)]
    pub availability_score: i32,
    #[schema(example = "us")]
    pub region: String,
    pub state: ExecutorState,
    pub last_checked: Option<DateTime<Utc>>,
    #[schema(example = false)]
    pub unschedulable: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[schema(example = "0")]
    pub version: String,
}

impl From<&Executor> for ExecutorDto {
    fn from(e: &Executor) -> Self {
        Self {
            id: e.id,
            domain: e.domain.clone(),
            api_url: e.api_url.clone(),
            proxy_url: e.proxy_url.clone(),
            api_key: e.api_key.clone(),
            cpu: e.cpu,
            memory: e.memory_gib,
            disk: e.disk_gib,
            gpu: e.gpu,
            gpu_type: e.gpu_type.clone(),
            class: e.class,
            used: e.used,
            capacity: e.capacity,
            current_cpu_usage_percentage: e.current_cpu_usage_percentage,
            current_memory_usage_percentage: e.current_memory_usage_percentage,
            current_disk_usage_percentage: e.current_disk_usage_percentage,
            current_allocated_cpu: e.current_allocated_cpu,
            current_allocated_memory_gib: e.current_allocated_memory_gib,
            current_allocated_disk_gib: e.current_allocated_disk_gib,
            current_image_count: e.current_image_count,
            availability_score: e.availability_score,
            region: e.region.clone(),
            state: e.state,
            last_checked: e.last_checked,
            unschedulable: e.unschedulable,
            created_at: e.created_at,
            updated_at: e.updated_at,
            version: e.version.clone(),
        }
    }
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[schema(as = CreateExecutor)]
#[serde(rename_all = "camelCase")]
pub struct CreateExecutorDto {
    #[validate(length(min = 1))]
    pub domain: String,
    #[validate(length(min = 1))]
    pub api_url: String,
    #[validate(length(min = 1))]
    pub proxy_url: String,
    #[validate(length(min = 1))]
    pub api_key: String,
    pub cpu: i32,
    pub memory_gib: i32,
    pub disk_gib: i32,
    pub gpu: i32,
    #[validate(length(min = 1))]
    pub gpu_type: String,
    pub class: SandboxClass,
    pub capacity: i32,
    #[validate(length(min = 1))]
    #[schema(example = "us")]
    pub region: String,
    #[validate(length(min = 1))]
    pub version: String,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[schema(as = ExecutorStatus)]
#[serde(rename_all = "camelCase")]
pub struct ExecutorStatusDto {
    #[schema(example = 45.6)]
    pub current_cpu_usage_percentage: f32,
    #[schema(example = 68.2)]
    pub current_memory_usage_percentage: f32,
    #[schema(example = 33.8)]
    pub current_disk_usage_percentage: f32,
    #[schema(example = 4000)]
    pub current_allocated_cpu: i32,
    #[schema(example = 8)]
    pub current_allocated_memory_gib: i32,
    #[schema(example = 50)]
    pub current_allocated_disk_gib: i32,
    #[schema(example = 12)]
    pub current_image_count: i32,
    #[schema(example = "ok")]
    pub status: String,
    #[schema(example = "0.0.1")]
    pub version: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[schema(as = ExecutorImage)]
#[serde(rename_all = "camelCase")]
pub struct ExecutorImageDto {
    #[schema(example = "123e4567-e89b-12d3-a456-426614174000")]
    pub executor_image_id: Uuid,
    #[schema(example = "123e4567-e89b-12d3-a456-426614174000")]
    pub executor_id: String,
    #[schema(example = "executor.example.com")]
    pub executor_domain: String,
}
