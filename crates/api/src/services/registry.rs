// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::constants::registry::MAX_REGISTRIES_PER_ORG;
use crate::models::Registry;
use crate::repositories;
use crate::schemas::registry::{
    CreateRegistryDto, RegistryDto, RegistryPushAccessDto, UpdateRegistryDto,
};
use snapflow_errors::{AppError, Result};
use snapflow_models::{RegistryType, SystemRole};

pub async fn create(
    pool: &PgPool,
    dto: &CreateRegistryDto,
    org_id: Uuid,
    user_role: SystemRole,
) -> Result<Registry> {
    if dto.registry_type != RegistryType::Organization && user_role != SystemRole::Admin {
        return Err(AppError::Forbidden(format!(
            "insufficient permissions for creating {} registries",
            dto.registry_type
        )));
    }

    if dto.is_default == Some(true) && user_role != SystemRole::Admin {
        return Err(AppError::Forbidden(
            "insufficient permissions for setting a default registry".into(),
        ));
    }

    let count = repositories::registry::count_by_org(pool, org_id).await?;
    if count >= MAX_REGISTRIES_PER_ORG {
        return Err(AppError::BadRequest(format!(
            "maximum of {MAX_REGISTRIES_PER_ORG} registries per organization"
        )));
    }

    Ok(repositories::registry::create(
        pool,
        &repositories::registry::CreateRegistryParams {
            name: &dto.name,
            url: &dto.url,
            username: &dto.username,
            password: &dto.password,
            project: dto.project.as_deref().unwrap_or(""),
            registry_type: dto.registry_type,
            is_default: dto.is_default.unwrap_or(false),
            organization_id: Some(org_id),
        },
    )
    .await?)
}

pub async fn find_all(pool: &PgPool, org_id: Uuid) -> Result<Vec<RegistryDto>> {
    let registries = repositories::registry::find_all_by_org(pool, org_id).await?;
    Ok(registries.iter().map(RegistryDto::from).collect())
}

pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Registry> {
    repositories::registry::find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound("registry not found".into()))
}

pub async fn update(pool: &PgPool, id: Uuid, dto: &UpdateRegistryDto) -> Result<Registry> {
    repositories::registry::find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound("registry not found".into()))?;

    Ok(repositories::registry::update(
        pool,
        id,
        &dto.name,
        &dto.url,
        &dto.username,
        dto.password.as_deref(),
        dto.project.as_deref(),
    )
    .await?)
}

pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
    repositories::registry::find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound("registry not found".into()))?;

    repositories::registry::delete(pool, id).await?;
    Ok(())
}

pub async fn set_default(pool: &PgPool, id: Uuid) -> Result<Registry> {
    repositories::registry::find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound("registry not found".into()))?;

    repositories::registry::unset_all_defaults(pool).await?;
    Ok(repositories::registry::set_default(pool, id).await?)
}

pub async fn get_push_access(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
) -> Result<RegistryPushAccessDto> {
    let transient = repositories::registry::find_default_by_type(pool, RegistryType::Transient)
        .await?
        .ok_or(AppError::ServiceUnavailable(
            "transient registry not configured".into(),
        ))?;

    let unique_id = &Uuid::new_v4().to_string()[..12];
    let robot_name = format!("temp-push-robot-{unique_id}");
    let expires_at = Utc::now() + Duration::seconds(3600);

    let registry_url = get_registry_url(&transient.url);

    let robot_config = serde_json::json!({
        "name": robot_name,
        "description": format!("Temporary push access for user {user_id} in organization {org_id}"),
        "duration": 3600,
        "level": "project",
        "permissions": [{
            "kind": "project",
            "namespace": transient.project,
            "access": [{ "resource": "repository", "action": "push" }]
        }]
    });

    let client = reqwest::Client::default();
    let response = client
        .post(format!("{registry_url}/api/v2.0/robots"))
        .basic_auth(&transient.username, Some(&transient.password))
        .json(&robot_config)
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "failed to create robot account");
            AppError::Internal(format!("failed to create registry push access: {e}"))
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::error!(status = %status, body = %body, "registry robot account creation failed");
        return Err(AppError::Internal(format!(
            "failed to create registry push access: {status}"
        )));
    }

    let robot: serde_json::Value = response
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("failed to parse robot account response: {e}")))?;

    let host = url::Url::parse(&registry_url)
        .ok()
        .and_then(|u| u.host_str().map(String::from))
        .unwrap_or_else(|| transient.url.clone());

    Ok(RegistryPushAccessDto {
        username: robot["name"].as_str().unwrap_or(&robot_name).to_string(),
        secret: robot["secret"].as_str().unwrap_or("").to_string(),
        registry_id: transient.id,
        registry_url: host,
        project: transient.project,
        expires_at: expires_at.to_rfc3339(),
    })
}

pub async fn find_by_image_name(
    pool: &PgPool,
    image_name: &str,
    organization_id: Option<Uuid>,
) -> Result<Option<Registry>> {
    let registries =
        repositories::registry::find_candidates_for_image(pool, organization_id).await?;

    for registry in registries {
        let stripped = registry
            .url
            .trim_start_matches("https://")
            .trim_start_matches("http://");
        if image_name.starts_with(stripped) {
            return Ok(Some(registry));
        }
    }

    Ok(None)
}

pub async fn remove_image(pool: &PgPool, image_name: &str, registry_id: Uuid) -> Result<()> {
    let registry = find_by_id(pool, registry_id).await?;

    let (name_with_tag, tag) = image_name
        .rsplit_once(':')
        .map(|(n, t)| (n, t.to_string()))
        .unwrap_or_else(|| (image_name, "latest".to_string()));

    let parts: Vec<&str> = name_with_tag.split('/').collect();

    let (project, repository) = if parts.len() >= 3 && parts[0].contains('.') {
        (parts[1].to_string(), parts[2..].join("/"))
    } else if parts.len() == 2 {
        (parts[0].to_string(), parts[1].to_string())
    } else {
        return Err(AppError::BadRequest(
            "invalid image name format, expected: [registry]/project/repository[:tag]".into(),
        ));
    };

    let registry_url = get_registry_url(&registry.url);
    let artifact_url = format!(
        "{registry_url}/api/v2.0/projects/{project}/repositories/{repository}/artifacts/{tag}"
    );

    let client = reqwest::Client::default();
    let response = client
        .delete(&artifact_url)
        .basic_auth(&registry.username, Some(&registry.password))
        .send()
        .await
        .map_err(|e| {
            tracing::error!(image_name, error = %e, "failed to delete artifact from registry");
            AppError::Internal(format!("failed to remove image {image_name}: {e}"))
        })?;

    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(());
    }

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::error!(image_name, status = %status, body = %body, "registry artifact deletion failed");
        return Err(AppError::Internal(format!(
            "failed to remove image {image_name}: {status}"
        )));
    }

    Ok(())
}

pub async fn check_image_exists_in_registry(image_name: &str, registry: &Registry) -> bool {
    let (name, tag) = image_name
        .rsplit_once(':')
        .unwrap_or((image_name, "latest"));

    let parts: Vec<&str> = name.split('/').collect();
    if parts.len() < 3 {
        tracing::warn!(image_name, "invalid image name format for registry check");
        return false;
    }

    let registry_url = get_registry_url(&registry.url);
    let manifest_url = format!(
        "{}/v2/{}/{}/manifests/{}",
        registry_url, parts[1], parts[2], tag
    );

    let accept = [
        "application/vnd.docker.distribution.manifest.v2+json",
        "application/vnd.docker.distribution.manifest.list.v2+json",
        "application/vnd.oci.image.index.v1+json",
        "application/vnd.oci.image.manifest.v1+json",
    ]
    .join(", ");

    let client = reqwest::Client::default();
    match client
        .get(&manifest_url)
        .header("Accept", &accept)
        .basic_auth(&registry.username, Some(&registry.password))
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
    {
        Ok(resp) => resp.status() == reqwest::StatusCode::OK,
        Err(e) => {
            tracing::warn!(image_name, error = %e, "failed to check image in registry");
            false
        }
    }
}

pub async fn delete_sandbox_backup_repository(
    pool: &PgPool,
    sandbox_id: Uuid,
    backup_registry_id: Option<Uuid>,
) {
    let Some(registry_id) = backup_registry_id else {
        return;
    };

    let registry = match repositories::registry::find_by_id(pool, registry_id).await {
        Ok(Some(r)) => r,
        _ => return,
    };

    let registry_url = get_registry_url(&registry.url);
    let repo_name = format!("backup-{sandbox_id}");
    let tags_url = format!(
        "{}/v2/{}/{}/tags/list",
        registry_url, registry.project, repo_name
    );

    let client = reqwest::Client::default();

    let tags: Vec<String> = match client
        .get(&tags_url)
        .basic_auth(&registry.username, Some(&registry.password))
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            let body: serde_json::Value = resp.json().await.unwrap_or_default();
            body.get("tags")
                .and_then(|t| t.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default()
        }
        _ => return,
    };

    for tag in &tags {
        let manifest_url = format!(
            "{}/v2/{}/{}/manifests/{}",
            registry_url, registry.project, repo_name, tag
        );

        let accept = [
            "application/vnd.docker.distribution.manifest.v2+json",
            "application/vnd.docker.distribution.manifest.list.v2+json",
            "application/vnd.oci.image.index.v1+json",
            "application/vnd.oci.image.manifest.v1+json",
        ]
        .join(", ");

        let digest = match client
            .head(&manifest_url)
            .basic_auth(&registry.username, Some(&registry.password))
            .header("Accept", &accept)
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => resp
                .headers()
                .get("docker-content-digest")
                .and_then(|v| v.to_str().ok())
                .map(String::from),
            _ => continue,
        };

        let Some(digest) = digest else {
            continue;
        };

        let delete_url = format!(
            "{}/v2/{}/{}/manifests/{}",
            registry_url, registry.project, repo_name, digest
        );

        if let Err(e) = client
            .delete(&delete_url)
            .basic_auth(&registry.username, Some(&registry.password))
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .await
        {
            tracing::warn!(
                sandbox_id = %sandbox_id,
                tag,
                error = %e,
                "failed to delete backup tag from registry"
            );
        }
    }

    tracing::info!(sandbox_id = %sandbox_id, "cleaned up backup repository from registry");
}

fn get_registry_url(url: &str) -> String {
    if url == "registry:5000" || url == "localhost:5000" {
        return format!("http://{url}");
    }
    if url.contains("localhost:") {
        return format!("http://{url}");
    }
    if url.starts_with("http") {
        return url.to_string();
    }
    format!("https://{url}")
}
