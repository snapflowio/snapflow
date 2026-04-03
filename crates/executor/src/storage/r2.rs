// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use anyhow::{Context, Result};

const CONTEXT_TAR_FILE_NAME: &str = "context.tar";

#[derive(Clone)]
pub struct R2Client {
    client: aws_sdk_s3::Client,
    bucket_name: String,
}

impl R2Client {
    pub fn new(
        endpoint_url: &str,
        access_key_id: &str,
        secret_access_key: &str,
        region: &str,
        bucket_name: &str,
    ) -> Result<Self> {
        if endpoint_url.is_empty()
            || access_key_id.is_empty()
            || secret_access_key.is_empty()
            || bucket_name.is_empty()
            || region.is_empty()
        {
            anyhow::bail!(
                "Missing R2 configuration — endpoint, access key, secret key, region, or bucket name not provided"
            );
        }

        let config = snapflow_storage::StorageConfig {
            endpoint: endpoint_url.to_string(),
            region: region.to_string(),
            access_key: access_key_id.to_string(),
            secret_key: secret_access_key.to_string(),
            default_bucket: bucket_name.to_string(),
        };

        let client = snapflow_storage::build_s3_client(&config);

        Ok(Self {
            client,
            bucket_name: bucket_name.to_string(),
        })
    }

    pub async fn get_object(&self, organization_id: &str, hash: &str) -> Result<Vec<u8>> {
        let key = format!("{}/{}/{}", organization_id, hash, CONTEXT_TAR_FILE_NAME);
        snapflow_storage::get_object(&self.client, &self.bucket_name, &key)
            .await
            .with_context(|| format!("Failed to get object from R2: {}", key))
    }
}
