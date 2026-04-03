// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use sqlx::Postgres;
use uuid::Uuid;

use crate::models::OrganizationInvitation;
use crate::models::OrganizationRole;
use snapflow_models::{OrganizationInvitationStatus, OrganizationMemberRole};

pub async fn create<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
    email: &str,
    invited_by: &str,
    role: OrganizationMemberRole,
    expires_at: chrono::DateTime<chrono::Utc>,
) -> sqlx::Result<OrganizationInvitation> {
    sqlx::query_as::<_, OrganizationInvitation>(
        "INSERT INTO organization_invitation (organization_id, email, invited_by, role, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *",
    )
    .bind(org_id)
    .bind(email)
    .bind(invited_by)
    .bind(role)
    .bind(expires_at)
    .fetch_one(db)
    .await
}

pub async fn find_by_id<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<Option<OrganizationInvitation>> {
    sqlx::query_as::<_, OrganizationInvitation>(
        "SELECT * FROM organization_invitation WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(db)
    .await
}

pub async fn find_pending_by_org<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
) -> sqlx::Result<Vec<OrganizationInvitation>> {
    sqlx::query_as::<_, OrganizationInvitation>(
        "SELECT * FROM organization_invitation
         WHERE organization_id = $1 AND status = $2 AND expires_at > now()
         ORDER BY created_at DESC",
    )
    .bind(org_id)
    .bind(OrganizationInvitationStatus::Pending)
    .fetch_all(db)
    .await
}

pub async fn find_pending_by_email<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    email: &str,
) -> sqlx::Result<Vec<OrganizationInvitation>> {
    sqlx::query_as::<_, OrganizationInvitation>(
        "SELECT * FROM organization_invitation
         WHERE email = $1 AND status = $2 AND expires_at > now()
         ORDER BY created_at DESC",
    )
    .bind(email)
    .bind(OrganizationInvitationStatus::Pending)
    .fetch_all(db)
    .await
}

pub async fn count_pending_by_email<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    email: &str,
) -> sqlx::Result<i64> {
    sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM organization_invitation
         WHERE email = $1 AND status = $2 AND expires_at > now()",
    )
    .bind(email)
    .bind(OrganizationInvitationStatus::Pending)
    .fetch_one(db)
    .await
}

pub async fn find_pending_by_org_and_email<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
    email: &str,
) -> sqlx::Result<Option<OrganizationInvitation>> {
    sqlx::query_as::<_, OrganizationInvitation>(
        "SELECT * FROM organization_invitation
         WHERE organization_id = $1 AND email = $2 AND status = $3 AND expires_at > now()",
    )
    .bind(org_id)
    .bind(email)
    .bind(OrganizationInvitationStatus::Pending)
    .fetch_optional(db)
    .await
}

pub async fn update_status<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    status: OrganizationInvitationStatus,
) -> sqlx::Result<OrganizationInvitation> {
    sqlx::query_as::<_, OrganizationInvitation>(
        "UPDATE organization_invitation SET status = $1, updated_at = now()
         WHERE id = $2
         RETURNING *",
    )
    .bind(status)
    .bind(id)
    .fetch_one(db)
    .await
}

pub async fn update<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    role: OrganizationMemberRole,
    expires_at: Option<chrono::DateTime<chrono::Utc>>,
) -> sqlx::Result<OrganizationInvitation> {
    sqlx::query_as::<_, OrganizationInvitation>(
        "UPDATE organization_invitation
         SET role = $1, expires_at = COALESCE($2, expires_at), updated_at = now()
         WHERE id = $3
         RETURNING *",
    )
    .bind(role)
    .bind(expires_at)
    .bind(id)
    .fetch_one(db)
    .await
}

pub async fn clear_assigned_roles<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    invitation_id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM organization_role_assignment_invitation WHERE invitation_id = $1")
        .bind(invitation_id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn assign_role<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    invitation_id: Uuid,
    role_id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query(
        "INSERT INTO organization_role_assignment_invitation (invitation_id, role_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING",
    )
    .bind(invitation_id)
    .bind(role_id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn find_assigned_role_ids<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    invitation_id: Uuid,
) -> sqlx::Result<Vec<Uuid>> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT role_id FROM organization_role_assignment_invitation WHERE invitation_id = $1",
    )
    .bind(invitation_id)
    .fetch_all(db)
    .await
}

pub async fn find_assigned_roles<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    invitation_id: Uuid,
) -> sqlx::Result<Vec<OrganizationRole>> {
    sqlx::query_as::<_, OrganizationRole>(
        "SELECT r.* FROM organization_role r
         JOIN organization_role_assignment_invitation ai ON ai.role_id = r.id
         WHERE ai.invitation_id = $1
         ORDER BY r.id ASC",
    )
    .bind(invitation_id)
    .fetch_all(db)
    .await
}

pub async fn find_org_name<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
) -> sqlx::Result<Option<String>> {
    sqlx::query_scalar::<_, String>("SELECT name FROM organization WHERE id = $1")
        .bind(org_id)
        .fetch_optional(db)
        .await
}
