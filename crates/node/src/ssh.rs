// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

pub mod forward;
pub mod session;
pub mod sftp;

use std::sync::Arc;

use russh::server::Server as _;
use russh_keys::{Algorithm, PrivateKey};

pub const SSH_PORT: u16 = 2222;

pub async fn start(
    port: u16,
    project_dir: String,
    default_project_dir: String,
    auth_token: String,
) -> anyhow::Result<()> {
    let key = PrivateKey::random(&mut rand_core::OsRng, Algorithm::Ed25519)?;

    let config = Arc::new(russh::server::Config {
        auth_rejection_time: std::time::Duration::from_secs(0),
        auth_rejection_time_initial: Some(std::time::Duration::from_secs(0)),
        keys: vec![key],
        ..Default::default()
    });

    let mut server = session::SshServer {
        project_dir,
        default_project_dir,
        auth_token,
    };

    tracing::info!(port, "starting SSH server");
    server.run_on_address(config, ("0.0.0.0", port)).await?;

    Ok(())
}
