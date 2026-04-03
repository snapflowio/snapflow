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
use aws_sdk_s3::primitives::ByteStream;

#[derive(Clone)]
pub struct StorageConfig {
    pub endpoint: String,
    pub region: String,
    pub access_key: String,
    pub secret_key: String,
    pub default_bucket: String,
}

impl std::fmt::Debug for StorageConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("StorageConfig")
            .field("endpoint", &self.endpoint)
            .field("region", &self.region)
            .field("access_key", &"[REDACTED]")
            .field("secret_key", &"[REDACTED]")
            .field("default_bucket", &self.default_bucket)
            .finish()
    }
}

impl StorageConfig {
    pub fn is_configured(&self) -> bool {
        !self.endpoint.is_empty() && !self.access_key.is_empty() && !self.secret_key.is_empty()
    }
}

pub fn build_s3_client(config: &StorageConfig) -> S3Client {
    let credentials = Credentials::new(
        &config.access_key,
        &config.secret_key,
        None,
        None,
        "snapflow-storage",
    );

    let s3_config = S3ConfigBuilder::default()
        .behavior_version_latest()
        .region(Region::new(config.region.clone()))
        .endpoint_url(&config.endpoint)
        .credentials_provider(credentials)
        .force_path_style(true)
        .build();

    S3Client::from_conf(s3_config)
}

pub async fn get_object(client: &S3Client, bucket: &str, key: &str) -> anyhow::Result<Vec<u8>> {
    let result = client.get_object().bucket(bucket).key(key).send().await?;

    let data = result.body.collect().await?.into_bytes().to_vec();
    Ok(data)
}

pub async fn get_object_stream(
    client: &S3Client,
    bucket: &str,
    key: &str,
) -> anyhow::Result<ByteStream> {
    let result = client.get_object().bucket(bucket).key(key).send().await?;

    Ok(result.body)
}

pub async fn put_object(
    client: &S3Client,
    bucket: &str,
    key: &str,
    body: Vec<u8>,
) -> anyhow::Result<()> {
    client
        .put_object()
        .bucket(bucket)
        .key(key)
        .body(ByteStream::from(body))
        .send()
        .await?;
    Ok(())
}

pub async fn delete_object(client: &S3Client, bucket: &str, key: &str) -> anyhow::Result<()> {
    client
        .delete_object()
        .bucket(bucket)
        .key(key)
        .send()
        .await?;
    Ok(())
}

pub async fn head_object(client: &S3Client, bucket: &str, key: &str) -> anyhow::Result<bool> {
    match client.head_object().bucket(bucket).key(key).send().await {
        Ok(_) => Ok(true),
        Err(err) => {
            if err.as_service_error().is_some_and(|e| e.is_not_found()) {
                Ok(false)
            } else {
                Err(err.into())
            }
        }
    }
}

pub async fn list_objects(
    client: &S3Client,
    bucket: &str,
    prefix: &str,
) -> anyhow::Result<Vec<String>> {
    let mut keys = Vec::default();
    let mut continuation_token: Option<String> = None;

    loop {
        let mut req = client.list_objects_v2().bucket(bucket).prefix(prefix);

        if let Some(token) = &continuation_token {
            req = req.continuation_token(token);
        }

        let output = req.send().await?;

        for obj in output.contents() {
            if let Some(key) = obj.key() {
                keys.push(key.to_owned());
            }
        }

        match output.next_continuation_token() {
            Some(token) => continuation_token = Some(token.to_owned()),
            None => break,
        }
    }

    Ok(keys)
}

pub async fn delete_objects(client: &S3Client, bucket: &str, prefix: &str) -> anyhow::Result<u64> {
    let keys = list_objects(client, bucket, prefix).await?;
    let count = keys.len() as u64;

    for chunk in keys.chunks(1000) {
        let objects: Vec<_> = chunk
            .iter()
            .filter_map(|key| {
                aws_sdk_s3::types::ObjectIdentifier::builder()
                    .key(key)
                    .build()
                    .ok()
            })
            .collect();

        if objects.is_empty() {
            continue;
        }

        let delete = aws_sdk_s3::types::Delete::builder()
            .set_objects(Some(objects))
            .build()?;

        client
            .delete_objects()
            .bucket(bucket)
            .delete(delete)
            .send()
            .await?;
    }

    Ok(count)
}

pub async fn test_connection(client: &S3Client, bucket: &str) -> anyhow::Result<()> {
    client.head_bucket().bucket(bucket).send().await?;
    tracing::debug!("storage connection test successful");
    Ok(())
}
