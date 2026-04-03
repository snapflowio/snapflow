// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use askama::Template;
use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

use crate::config::SmtpConfig;

use super::templates::{PasswordResetEmail, VerificationEmail};

pub struct MailClient {
    transport: Option<AsyncSmtpTransport<Tokio1Executor>>,
    from: String,
}

impl MailClient {
    pub fn new(config: &SmtpConfig) -> Self {
        if !config.is_configured() {
            tracing::warn!("smtp not configured, email functionality disabled");
            return Self {
                transport: None,
                from: config.from.clone(),
            };
        }

        let transport = if config.secure {
            match AsyncSmtpTransport::<Tokio1Executor>::relay(&config.host) {
                Ok(b) => {
                    let mut b = b.port(config.port);
                    if !config.user.is_empty() && !config.password.is_empty() {
                        b = b.credentials(Credentials::new(
                            config.user.clone(),
                            config.password.clone(),
                        ));
                    }
                    Some(b.build())
                }
                Err(e) => {
                    tracing::error!(error = %e, "failed to create smtp transport");
                    None
                }
            }
        } else {
            let mut b = AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&config.host)
                .port(config.port);
            if !config.user.is_empty() && !config.password.is_empty() {
                b = b.credentials(Credentials::new(
                    config.user.clone(),
                    config.password.clone(),
                ));
            }
            Some(b.build())
        };

        tracing::info!(host = %config.host, port = config.port, "mail client initialized");

        Self {
            transport,
            from: config.from.clone(),
        }
    }

    pub async fn send_verification_email(
        &self,
        email: &str,
        name: &str,
        verification_url: &str,
    ) -> bool {
        let template = VerificationEmail {
            name,
            verification_url,
            year: chrono::Utc::now()
                .format("%Y")
                .to_string()
                .parse()
                .unwrap_or(2026),
        };

        let html = match template.render() {
            Ok(h) => h,
            Err(e) => {
                tracing::error!(error = %e, "failed to render verification email template");
                return false;
            }
        };

        self.send(email, "Verify your email address - Snapflow", &html)
            .await
    }

    pub async fn send_password_reset_email(
        &self,
        email: &str,
        name: &str,
        reset_url: &str,
    ) -> bool {
        let template = PasswordResetEmail {
            name,
            reset_url,
            year: chrono::Utc::now()
                .format("%Y")
                .to_string()
                .parse()
                .unwrap_or(2026),
        };

        let html = match template.render() {
            Ok(h) => h,
            Err(e) => {
                tracing::error!(error = %e, "failed to render password reset email template");
                return false;
            }
        };

        self.send(email, "Reset your password - Snapflow", &html)
            .await
    }

    pub async fn send(&self, to: &str, subject: &str, html: &str) -> bool {
        let Some(ref transport) = self.transport else {
            tracing::warn!(to, "email not sent, smtp not configured");
            return false;
        };

        let from_addr = match self.from.parse() {
            Ok(addr) => addr,
            Err(e) => {
                tracing::error!(from = %self.from, error = %e, "invalid from address");
                return false;
            }
        };

        let message = match Message::builder()
            .from(from_addr)
            .to(match to.parse() {
                Ok(addr) => addr,
                Err(e) => {
                    tracing::error!(to, error = %e, "invalid recipient address");
                    return false;
                }
            })
            .subject(subject)
            .header(ContentType::TEXT_HTML)
            .body(html.to_string())
        {
            Ok(m) => m,
            Err(e) => {
                tracing::error!(error = %e, "failed to build email message");
                return false;
            }
        };

        match transport.send(message).await {
            Ok(_) => {
                tracing::info!(to, subject, "email sent");
                true
            }
            Err(e) => {
                tracing::error!(to, error = %e, "failed to send email");
                false
            }
        }
    }
}
