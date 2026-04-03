// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use envconfig::Envconfig;
use validator::Validate;

#[derive(Debug, Clone, Envconfig, Validate)]
pub struct DatabaseConfig {
    #[envconfig(
        from = "DATABASE_URL",
        default = "postgres://snapflow:snapflow@localhost:5432/snapflow"
    )]
    #[validate(length(min = 1))]
    pub url: String,

    #[envconfig(from = "DB_LOGGING", default = "false")]
    pub logging: bool,
}
