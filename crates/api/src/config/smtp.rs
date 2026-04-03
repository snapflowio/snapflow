// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use envconfig::Envconfig;

#[derive(Debug, Clone, Envconfig)]
pub struct SmtpConfig {
    #[envconfig(from = "SMTP_HOST", default = "")]
    pub host: String,

    #[envconfig(from = "SMTP_PORT", default = "587")]
    pub port: u16,

    #[envconfig(from = "SMTP_USER", default = "")]
    pub user: String,

    #[envconfig(from = "SMTP_PASSWORD", default = "")]
    pub password: String,

    #[envconfig(from = "SMTP_SECURE", default = "false")]
    pub secure: bool,

    #[envconfig(from = "SMTP_EMAIL_FROM", default = "noreply@snapflow.local")]
    pub from: String,
}

impl SmtpConfig {
    pub fn is_configured(&self) -> bool {
        !self.host.is_empty()
    }
}
