// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use envconfig::Envconfig;

#[derive(Debug, Clone, Envconfig)]
pub struct LogConfig {
    #[envconfig(from = "LOG_LEVEL", default = "info")]
    pub level: String,

    #[envconfig(from = "LOG_CONSOLE_DISABLED", default = "false")]
    pub console_disabled: bool,

    #[envconfig(from = "LOG_REQUESTS_ENABLED", default = "false")]
    pub requests_enabled: bool,
}
