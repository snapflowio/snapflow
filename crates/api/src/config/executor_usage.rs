// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use envconfig::Envconfig;

#[derive(Envconfig, Clone, Debug)]
pub struct ExecutorUsageConfig {
    #[envconfig(from = "EXECUTOR_AVAILABILITY_SCORE_THRESHOLD", default = "60")]
    pub availability_score_threshold: i32,

    #[envconfig(from = "EXECUTOR_CPU_USAGE_WEIGHT", default = "0.25")]
    pub cpu_usage_weight: f64,

    #[envconfig(from = "EXECUTOR_MEMORY_USAGE_WEIGHT", default = "0.4")]
    pub memory_usage_weight: f64,

    #[envconfig(from = "EXECUTOR_DISK_USAGE_WEIGHT", default = "0.4")]
    pub disk_usage_weight: f64,

    #[envconfig(from = "EXECUTOR_ALLOCATED_CPU_WEIGHT", default = "0.03")]
    pub allocated_cpu_weight: f64,

    #[envconfig(from = "EXECUTOR_ALLOCATED_MEMORY_WEIGHT", default = "0.03")]
    pub allocated_memory_weight: f64,

    #[envconfig(from = "EXECUTOR_ALLOCATED_DISK_WEIGHT", default = "0.03")]
    pub allocated_disk_weight: f64,

    #[envconfig(from = "EXECUTOR_CPU_PENALTY_EXPONENT", default = "0.15")]
    pub cpu_penalty_exponent: f64,

    #[envconfig(from = "EXECUTOR_MEMORY_PENALTY_EXPONENT", default = "0.15")]
    pub memory_penalty_exponent: f64,

    #[envconfig(from = "EXECUTOR_DISK_PENALTY_EXPONENT", default = "0.15")]
    pub disk_penalty_exponent: f64,

    #[envconfig(from = "EXECUTOR_CPU_PENALTY_THRESHOLD", default = "90")]
    pub cpu_penalty_threshold: f64,

    #[envconfig(from = "EXECUTOR_MEMORY_PENALTY_THRESHOLD", default = "75")]
    pub memory_penalty_threshold: f64,

    #[envconfig(from = "EXECUTOR_DISK_PENALTY_THRESHOLD", default = "75")]
    pub disk_penalty_threshold: f64,
}
