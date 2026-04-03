// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use tracing::error;

use super::DockerClient;

impl DockerClient {
    pub async fn start_snapflow_node(&self, container_id: &str) {
        let result = self
            .exec_sync(
                container_id,
                vec!["sh", "-c", "/usr/local/bin/snapflow"],
                None,
                true,
                true,
                true,
            )
            .await;

        match result {
            Ok(exec_result) => {
                if exec_result.exit_code != 0 && !exec_result.stderr.is_empty() {
                    error!(
                        container_id = %container_id,
                        exit_code = exec_result.exit_code,
                        stderr = %exec_result.stderr,
                        "Snapflow node exited with error"
                    );
                }
            }
            Err(e) => {
                error!(
                    container_id = %container_id,
                    error = %e,
                    "Failed to start snapflow node"
                );
            }
        }
    }
}
