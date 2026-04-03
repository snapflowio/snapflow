// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use envconfig::Envconfig;

#[derive(Debug, Clone, Envconfig)]
pub struct DefaultOrganizationQuota {
    #[envconfig(from = "DEFAULT_TOTAL_CPU_QUOTA", default = "6")]
    pub total_cpu_quota: i32,

    #[envconfig(from = "DEFAULT_TOTAL_MEMORY_QUOTA", default = "1536")]
    pub total_memory_quota: i32,

    #[envconfig(from = "DEFAULT_TOTAL_DISK_QUOTA", default = "6")]
    pub total_disk_quota: i32,

    #[envconfig(from = "DEFAULT_MAX_CPU_PER_SANDBOX", default = "2")]
    pub max_cpu_per_sandbox: i32,

    #[envconfig(from = "DEFAULT_MAX_MEMORY_PER_SANDBOX", default = "512")]
    pub max_memory_per_sandbox: i32,

    #[envconfig(from = "DEFAULT_MAX_DISK_PER_SANDBOX", default = "2")]
    pub max_disk_per_sandbox: i32,

    #[envconfig(from = "DEFAULT_IMAGE_QUOTA", default = "5")]
    pub image_quota: i32,

    #[envconfig(from = "DEFAULT_MAX_IMAGE_SIZE", default = "10")]
    pub max_image_size: i32,

    #[envconfig(from = "DEFAULT_BUCKET_QUOTA", default = "3")]
    pub bucket_quota: i32,
}
