// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use redis::AsyncCommands;
use snapflow_errors::{AppError, Result};

use crate::constants::auth::{AUTH_CODE_PREFIX, AUTH_CODE_TTL_SECS};

pub async fn store(
    conn: &mut redis::aio::ConnectionManager,
    code: &str,
    value: &str,
) -> Result<()> {
    let key = format!("{AUTH_CODE_PREFIX}{code}");
    conn.set_ex::<_, _, ()>(&key, value, AUTH_CODE_TTL_SECS)
        .await
        .map_err(|_| AppError::Internal("failed to store authorization code".into()))
}

pub async fn consume(
    conn: &mut redis::aio::ConnectionManager,
    code: &str,
) -> Result<Option<String>> {
    let key = format!("{AUTH_CODE_PREFIX}{code}");
    redis::cmd("GETDEL")
        .arg(&key)
        .query_async(conn)
        .await
        .map_err(|_| AppError::Internal("failed to retrieve authorization code".into()))
}
