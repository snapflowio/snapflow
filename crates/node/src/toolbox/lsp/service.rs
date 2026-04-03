// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::{
    client::LspClient,
    server::{self, LspServerInstance},
};
use crate::common::errors::AppError;
use base64::Engine;
use dashmap::DashMap;
use std::sync::Arc;
use std::time::Duration;

fn generate_key(language_id: &str, path: &str) -> String {
    base64::engine::general_purpose::STANDARD.encode(format!("{language_id}:{path}"))
}

#[derive(Clone)]
pub struct LspServers {
    servers: Arc<DashMap<String, LspServerInstance>>,
}

impl LspServers {
    pub fn default() -> Self {
        Self {
            servers: Arc::new(DashMap::default()),
        }
    }

    pub fn get_server(
        &self,
        language_id: &str,
        path_to_project: &str,
    ) -> Result<Arc<LspClient>, AppError> {
        let key = generate_key(language_id, path_to_project);

        if let Some(entry) = self.servers.get(&key)
            && entry.initialized
        {
            return Ok(Arc::clone(&entry.client));
        }

        Err(AppError::bad_request(format!(
            "no initialized server for language: {language_id}"
        )))
    }

    pub fn start_server(&self, language_id: &str, path_to_project: &str) -> Result<(), AppError> {
        let key = generate_key(language_id, path_to_project);

        let entry = self.servers.entry(key);
        match entry {
            dashmap::Entry::Occupied(e) if e.get().initialized => return Ok(()),
            dashmap::Entry::Occupied(e) => {
                e.remove();
            }
            dashmap::Entry::Vacant(_) => {}
        }

        if language_id != "typescript" {
            return Err(AppError::bad_request(format!(
                "unsupported language: {language_id}"
            )));
        }

        let instance = server::create_typescript_server(path_to_project)?;
        let key = generate_key(language_id, path_to_project);
        self.servers.insert(key, instance);
        Ok(())
    }

    pub async fn stop_all(&self) {
        let keys: Vec<String> = self.servers.iter().map(|e| e.key().clone()).collect();
        for key in keys {
            if let Some((_, mut instance)) = self.servers.remove(&key) {
                let client = Arc::clone(&instance.client);
                let _ = tokio::task::spawn_blocking(move || {
                    let _ = client.send_request("shutdown", serde_json::Value::Null);
                    let _ = client.send_notification("exit", serde_json::Value::Null);
                })
                .await;
                let _ = instance.child.kill();
                let _ = instance.child.wait();
            }
        }
    }

    pub async fn stop_server(
        &self,
        language_id: &str,
        path_to_project: &str,
    ) -> Result<(), AppError> {
        let key = generate_key(language_id, path_to_project);

        if let Some((_, mut instance)) = self.servers.remove(&key) {
            let client = Arc::clone(&instance.client);
            let _ = tokio::task::spawn_blocking(move || {
                let _ = client.send_request("shutdown", serde_json::Value::Null);
                let _ = client.send_notification("exit", serde_json::Value::Null);
            })
            .await;

            tokio::time::sleep(Duration::from_secs(2)).await;
            let _ = instance.child.kill();
            let _ = instance.child.wait();
        } else {
            return Err(AppError::bad_request(format!(
                "no server for language: {language_id}"
            )));
        }

        Ok(())
    }
}
