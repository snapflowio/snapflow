// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::Serialize;
use socketioxide::SocketIo;
use uuid::Uuid;

use crate::constants::sandbox;
use crate::schemas::sandbox::{BucketDto, ImageDto, SandboxDto};
use snapflow_models::{BucketState, ImageState, SandboxDesiredState, SandboxState};

#[derive(Clone)]
pub struct Realtime {
    io: SocketIo,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BucketStateChange<'a> {
    bucket: &'a BucketDto,
    old_state: BucketState,
    new_state: BucketState,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SandboxStateChange<'a> {
    sandbox: &'a SandboxDto,
    old_state: SandboxState,
    new_state: SandboxState,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SandboxDesiredStateChange<'a> {
    sandbox: &'a SandboxDto,
    old_desired_state: SandboxDesiredState,
    new_desired_state: SandboxDesiredState,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImageStateChange<'a> {
    image: &'a ImageDto,
    old_state: ImageState,
    new_state: ImageState,
}

impl Realtime {
    pub fn new(io: SocketIo) -> Self {
        Self { io }
    }

    pub fn bucket_created(&self, org_id: Uuid, bucket: &BucketDto) {
        self.emit_to_org(org_id, sandbox::bucket_events::CREATED, bucket);
    }

    pub fn bucket_state_updated(
        &self,
        org_id: Uuid,
        bucket: &BucketDto,
        old_state: BucketState,
        new_state: BucketState,
    ) {
        self.emit_to_org(
            org_id,
            sandbox::bucket_events::STATE_UPDATED,
            &BucketStateChange {
                bucket,
                old_state,
                new_state,
            },
        );
    }

    pub fn bucket_last_used_at_updated(&self, org_id: Uuid, bucket: &BucketDto) {
        self.emit_to_org(org_id, sandbox::bucket_events::LAST_USED_AT_UPDATED, bucket);
    }

    pub fn sandbox_created(&self, org_id: Uuid, dto: &SandboxDto) {
        self.emit_to_org(org_id, sandbox::events::CREATED, dto);
    }

    pub fn sandbox_state_updated(
        &self,
        org_id: Uuid,
        dto: &SandboxDto,
        old_state: SandboxState,
        new_state: SandboxState,
    ) {
        self.emit_to_org(
            org_id,
            sandbox::events::STATE_UPDATED,
            &SandboxStateChange {
                sandbox: dto,
                old_state,
                new_state,
            },
        );
    }

    pub fn sandbox_desired_state_updated(
        &self,
        org_id: Uuid,
        dto: &SandboxDto,
        old_desired_state: SandboxDesiredState,
        new_desired_state: SandboxDesiredState,
    ) {
        self.emit_to_org(
            org_id,
            sandbox::events::DESIRED_STATE_UPDATED,
            &SandboxDesiredStateChange {
                sandbox: dto,
                old_desired_state,
                new_desired_state,
            },
        );
    }

    pub fn sandbox_public_status_updated(&self, org_id: Uuid, dto: &SandboxDto) {
        self.emit_to_org(org_id, sandbox::events::PUBLIC_STATUS_UPDATED, dto);
    }

    pub fn sandbox_organization_updated(&self, org_id: Uuid, dto: &SandboxDto) {
        self.emit_to_org(org_id, sandbox::events::ORGANIZATION_UPDATED, dto);
    }

    pub fn image_created(&self, org_id: Uuid, image: &ImageDto) {
        self.emit_to_org(org_id, sandbox::image_events::CREATED, image);
    }

    pub fn image_state_updated(
        &self,
        org_id: Uuid,
        image: &ImageDto,
        old_state: ImageState,
        new_state: ImageState,
    ) {
        self.emit_to_org(
            org_id,
            sandbox::image_events::STATE_UPDATED,
            &ImageStateChange {
                image,
                old_state,
                new_state,
            },
        );
    }

    pub fn image_removed(&self, org_id: Uuid, image_id: Uuid) {
        self.emit_to_org(org_id, sandbox::image_events::REMOVED, &image_id);
    }

    fn emit_to_org<T: Serialize>(&self, org_id: Uuid, event: &str, data: &T) {
        let payload = match serde_json::to_value(data) {
            Ok(v) => v,
            Err(e) => {
                tracing::error!(error = %e, "failed to serialize realtime event payload");
                return;
            }
        };
        let io = self.io.clone();
        let room = org_id.to_string();
        let event = event.to_owned();
        tokio::spawn(async move {
            if let Err(e) = io.to(room).emit(&event, &payload).await {
                tracing::warn!(event, error = %e, "failed to emit realtime event");
            }
        });
    }
}
