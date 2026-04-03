// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use aws_config::Region;
use aws_credential_types::Credentials;
use aws_sdk_s3::Client as S3Client;
use aws_sdk_s3::config::Builder as S3ConfigBuilder;
use aws_sdk_s3::presigning::PresigningConfig;
use std::time::Duration;
use uuid::Uuid;

use crate::config::R2Config;
use crate::constants::bucket as bucket_constants;
use crate::schemas::storage::StorageAccessDto;
use snapflow_errors::{AppError, Result};

pub struct StorageClient {
    client: S3Client,
    bucket: String,
    presigned_url_expiry: u64,
}

impl StorageClient {
    pub fn new(config: &R2Config) -> Option<Self> {
        if !config.is_configured() {
            tracing::warn!("r2 not configured, storage functionality disabled");
            return None;
        }

        let credentials = Credentials::new(
            &config.access_key,
            &config.secret_key,
            None,
            None,
            "snapflow-r2",
        );

        let s3_config = S3ConfigBuilder::default()
            .behavior_version_latest()
            .region(Region::new(config.region.clone()))
            .endpoint_url(&config.endpoint)
            .credentials_provider(credentials)
            .force_path_style(true)
            .build();

        let client = S3Client::from_conf(s3_config);

        tracing::info!(
            bucket = %config.default_bucket,
            "storage client initialized"
        );

        Some(Self {
            client,
            bucket: config.default_bucket.clone(),
            presigned_url_expiry: config.presigned_url_expiry,
        })
    }

    pub async fn get_push_access(&self, organization_id: Uuid) -> Result<StorageAccessDto> {
        let file_path = format!("{organization_id}/context.tar");

        let presigning = PresigningConfig::builder()
            .expires_in(Duration::from_secs(self.presigned_url_expiry))
            .build()
            .map_err(|e| AppError::Internal(format!("failed to build presigning config: {e}")))?;

        let upload_url = self
            .client
            .put_object()
            .bucket(&self.bucket)
            .key(&file_path)
            .presigned(presigning)
            .await
            .map(|output| output.uri().to_string())
            .map_err(|e| {
                tracing::error!(
                    organization_id = %organization_id,
                    error = %e,
                    "failed to generate pre-signed URL"
                );
                AppError::BadRequest(format!("failed to generate upload URL: {e}"))
            })?;

        let expires_at =
            chrono::Utc::now() + chrono::Duration::seconds(self.presigned_url_expiry as i64);

        Ok(StorageAccessDto {
            upload_url,
            expires_at: expires_at.to_rfc3339(),
            organization_id: organization_id.to_string(),
            bucket: self.bucket.clone(),
            file_path,
        })
    }

    pub fn r2_bucket_name(bucket_id: Uuid) -> String {
        bucket_constants::r2_bucket_name(&bucket_id)
    }

    pub async fn test_connection(&self) -> Result<()> {
        self.client
            .list_buckets()
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("failed to connect to r2: {e}")))?;
        tracing::debug!("r2 connection test successful");
        Ok(())
    }

    pub async fn create_r2_bucket(&self, name: &str) -> Result<()> {
        self.client
            .create_bucket()
            .bucket(name)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("failed to create r2 bucket: {e}")))?;
        Ok(())
    }

    pub async fn delete_r2_bucket(&self, name: &str) -> Result<()> {
        self.abort_multipart_uploads(name).await?;
        self.delete_all_objects(name).await?;

        self.client
            .delete_bucket()
            .bucket(name)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("failed to delete r2 bucket: {e}")))?;

        Ok(())
    }

    async fn abort_multipart_uploads(&self, bucket: &str) -> Result<()> {
        let mut key_marker: Option<String> = None;
        let mut upload_id_marker: Option<String> = None;

        loop {
            let mut req = self.client.list_multipart_uploads().bucket(bucket);

            if let Some(ref km) = key_marker {
                req = req.key_marker(km);
            }
            if let Some(ref um) = upload_id_marker {
                req = req.upload_id_marker(um);
            }

            let response = req.send().await.map_err(|e| {
                AppError::Internal(format!("failed to list multipart uploads: {e}"))
            })?;

            for upload in response.uploads() {
                if let (Some(key), Some(upload_id)) = (upload.key(), upload.upload_id()) {
                    self.client
                        .abort_multipart_upload()
                        .bucket(bucket)
                        .key(key)
                        .upload_id(upload_id)
                        .send()
                        .await
                        .map_err(|e| {
                            AppError::Internal(format!("failed to abort multipart upload: {e}"))
                        })?;
                }
            }

            key_marker = response.next_key_marker().map(String::from);
            upload_id_marker = response.next_upload_id_marker().map(String::from);

            if key_marker.is_none() && upload_id_marker.is_none() {
                break;
            }
        }
        Ok(())
    }

    async fn delete_all_objects(&self, bucket: &str) -> Result<()> {
        let mut continuation_token: Option<String> = None;

        loop {
            let mut req = self.client.list_objects_v2().bucket(bucket);

            if let Some(ref token) = continuation_token {
                req = req.continuation_token(token);
            }

            let response = req
                .send()
                .await
                .map_err(|e| AppError::Internal(format!("failed to list objects: {e}")))?;

            let objects: Vec<_> = response
                .contents()
                .iter()
                .filter_map(|obj| {
                    obj.key().and_then(|k| {
                        aws_sdk_s3::types::ObjectIdentifier::builder()
                            .key(k)
                            .build()
                            .ok()
                    })
                })
                .collect();

            if !objects.is_empty() {
                let delete = aws_sdk_s3::types::Delete::builder()
                    .set_objects(Some(objects))
                    .quiet(true)
                    .build()
                    .map_err(|e| {
                        AppError::Internal(format!("failed to build delete request: {e}"))
                    })?;

                self.client
                    .delete_objects()
                    .bucket(bucket)
                    .delete(delete)
                    .send()
                    .await
                    .map_err(|e| AppError::Internal(format!("failed to delete objects: {e}")))?;
            }

            continuation_token = response.next_continuation_token().map(String::from);
            if continuation_token.is_none() {
                break;
            }
        }
        Ok(())
    }
}
