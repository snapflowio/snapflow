// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use anyhow::Result;
use std::sync::Arc;
use tokio::process::Command;
use tokio::sync::Mutex;
use tracing::info;

use crate::api::dto::volume::BucketDTO;

use super::DockerClient;

impl DockerClient {
    /// Mounts R2 buckets via mount-s3 and returns Docker bind mount strings.
    pub async fn get_buckets_mount_path_binds(&self, buckets: &[BucketDTO]) -> Result<Vec<String>> {
        let mut binds = Vec::default();

        for bucket in buckets {
            let bucket_id_prefixed = format!("snapflow-bucket-{}", bucket.bucket_id);
            let executor_mount_path =
                self.get_executor_bucket_mount_path(&bucket_id_prefixed, &bucket.sub_path);
            let bucket_key = self.get_bucket_key(&bucket_id_prefixed, &bucket.sub_path);

            let mutex = self
                .bucket_mutexes
                .entry(bucket_key)
                .or_insert_with(|| Arc::new(Mutex::new(())))
                .clone();

            let _guard = mutex.lock().await;

            if self.is_directory_mounted(&executor_mount_path).await {
                info!(
                    bucket = %bucket_id_prefixed,
                    path = %executor_mount_path,
                    "Bucket is already mounted"
                );
                binds.push(format!("{}/:{}/", executor_mount_path, bucket.mount_path));
                continue;
            }

            tokio::fs::create_dir_all(&executor_mount_path)
                .await
                .map_err(|e| {
                    anyhow::anyhow!(
                        "failed to create mount directory {}: {}",
                        executor_mount_path,
                        e
                    )
                })?;

            info!(
                bucket = %bucket_id_prefixed,
                path = %executor_mount_path,
                "Mounting R2 bucket"
            );

            let status = self
                .get_mount_cmd(
                    &bucket_id_prefixed,
                    bucket.sub_path.as_deref(),
                    &executor_mount_path,
                )
                .status()
                .await
                .map_err(|e| {
                    anyhow::anyhow!(
                        "failed to run mount-s3 for bucket {} to {}: {}",
                        bucket_id_prefixed,
                        executor_mount_path,
                        e
                    )
                })?;

            if !status.success() {
                anyhow::bail!(
                    "failed to mount R2 bucket {} to {}: exit code {:?}",
                    bucket_id_prefixed,
                    executor_mount_path,
                    status.code()
                );
            }

            info!(
                bucket = %bucket_id_prefixed,
                path = %executor_mount_path,
                "Mounted R2 bucket"
            );

            binds.push(format!("{}/:{}/", executor_mount_path, bucket.mount_path));
        }

        Ok(binds)
    }

    fn get_executor_bucket_mount_path(&self, bucket_id: &str, sub_path: &Option<String>) -> String {
        let mount_dir = match sub_path {
            Some(sp) if !sp.is_empty() => {
                let digest = md5::compute(sp.as_bytes());
                let hash = format!("{:x}", digest);
                format!("{}-{}", bucket_id, &hash[..8])
            }
            _ => bucket_id.to_string(),
        };

        if self.is_development() {
            format!("/tmp/{}", mount_dir)
        } else {
            format!("/mnt/{}", mount_dir)
        }
    }

    fn get_bucket_key(&self, bucket_id: &str, sub_path: &Option<String>) -> String {
        match sub_path {
            Some(sp) if !sp.is_empty() => format!("{}:{}", bucket_id, sp),
            _ => bucket_id.to_string(),
        }
    }

    async fn is_directory_mounted(&self, path: &str) -> bool {
        Command::new("mountpoint")
            .arg(path)
            .output()
            .await
            .map(|output| output.status.success())
            .unwrap_or(false)
    }

    fn get_mount_cmd(&self, bucket: &str, sub_path: Option<&str>, path: &str) -> Command {
        let mut cmd = Command::new("mount-s3");
        cmd.args([
            "--allow-other",
            "--allow-delete",
            "--allow-overwrite",
            "--file-mode",
            "0666",
            "--dir-mode",
            "0777",
        ]);

        if let Some(sp) = sub_path.filter(|s| !s.is_empty()) {
            let prefix = if sp.ends_with('/') {
                sp.to_string()
            } else {
                format!("{}/", sp)
            };
            cmd.args(["--prefix", &prefix]);
        }

        cmd.args([bucket, path]);

        cmd.env_clear();

        if !self.r2_endpoint_url.is_empty() {
            cmd.env("AWS_ENDPOINT_URL", &self.r2_endpoint_url);
        }
        if !self.r2_access_key_id.is_empty() {
            cmd.env("AWS_ACCESS_KEY_ID", &self.r2_access_key_id);
        }
        if !self.r2_secret_access_key.is_empty() {
            cmd.env("AWS_SECRET_ACCESS_KEY", &self.r2_secret_access_key);
        }
        if !self.r2_region.is_empty() {
            cmd.env("AWS_REGION", &self.r2_region);
        }

        cmd
    }
}
