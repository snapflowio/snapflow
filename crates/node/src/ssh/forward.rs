// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use russh::CryptoVec;
use russh::server::Handle;
use std::collections::HashMap;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::Mutex;

pub struct StreamlocalForwarder {
    forwards: Mutex<HashMap<String, tokio::task::JoinHandle<()>>>,
}

impl StreamlocalForwarder {
    pub fn default() -> Self {
        Self {
            forwards: Mutex::new(HashMap::default()),
        }
    }

    pub async fn start(&self, socket_path: &str, handle: Handle) -> anyhow::Result<()> {
        let mut forwards = self.forwards.lock().await;

        if forwards.contains_key(socket_path) {
            return Ok(());
        }

        if let Some(parent) = std::path::Path::new(socket_path).parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        let _ = tokio::fs::remove_file(socket_path).await;

        let listener = tokio::net::UnixListener::bind(socket_path)?;
        tracing::debug!(path = socket_path, "streamlocal forward listening");

        let path = socket_path.to_string();
        let task = tokio::spawn(async move {
            loop {
                match listener.accept().await {
                    Ok((unix_stream, _)) => {
                        tracing::debug!("accepted streamlocal forward connection");
                        let h = handle.clone();
                        let p = path.clone();

                        tokio::spawn(async move {
                            match h.channel_open_forwarded_streamlocal(&p).await {
                                Ok(channel) => {
                                    let channel_id = channel.id();
                                    let (mut unix_read, mut unix_write) = unix_stream.into_split();

                                    let h2 = h.clone();
                                    let unix_to_ssh = tokio::spawn(async move {
                                        let mut buf = [0u8; 8192];
                                        loop {
                                            match unix_read.read(&mut buf).await {
                                                Ok(0) | Err(_) => break,
                                                Ok(n) => {
                                                    let _ = h2
                                                        .data(
                                                            channel_id,
                                                            CryptoVec::from_slice(&buf[..n]),
                                                        )
                                                        .await;
                                                }
                                            }
                                        }
                                    });

                                    let mut channel_reader = channel.into_stream();
                                    let ssh_to_unix = tokio::spawn(async move {
                                        let mut buf = [0u8; 8192];
                                        loop {
                                            match channel_reader.read(&mut buf).await {
                                                Ok(0) | Err(_) => break,
                                                Ok(n) => {
                                                    if unix_write
                                                        .write_all(&buf[..n])
                                                        .await
                                                        .is_err()
                                                    {
                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                    });

                                    let _ = tokio::join!(unix_to_ssh, ssh_to_unix);
                                    let _ = h.close(channel_id).await;
                                }
                                Err(e) => {
                                    tracing::warn!(error = %e, "failed to open forwarded-streamlocal channel");
                                }
                            }
                        });
                    }
                    Err(e) => {
                        tracing::debug!(error = %e, "streamlocal listener closed");
                        break;
                    }
                }
            }
        });

        forwards.insert(socket_path.to_string(), task);
        Ok(())
    }

    pub async fn cancel(&self, socket_path: &str) {
        let mut forwards = self.forwards.lock().await;
        if let Some(task) = forwards.remove(socket_path) {
            task.abort();
            let _ = tokio::fs::remove_file(socket_path).await;
            tracing::debug!(path = socket_path, "streamlocal forward cancelled");
        }
    }
}
