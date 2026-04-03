// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use sqlx::PgPool;

pub async fn cleanup_expired(pool: &PgPool) {
    match cleanup_expired_verifications(pool).await {
        Ok(count) => {
            if count > 0 {
                tracing::info!(deleted = count, "cleaned up expired verifications");
            }
        }
        Err(e) => tracing::warn!(error = %e, "failed to cleanup expired verifications"),
    }
}

async fn cleanup_expired_verifications(pool: &PgPool) -> Result<u64, sqlx::Error> {
    crate::repositories::verification::delete_expired(pool).await
}
