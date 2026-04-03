// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Arc;

use cookie::Cookie;
use redis::AsyncCommands;
use socketioxide::extract::{SocketRef, State};
use sqlx::PgPool;

use crate::constants::auth::ACCESS_TOKEN_COOKIE;
use crate::repositories;
use snapflow_auth::jwt::JwtKeys;

pub async fn on_connect(
    socket: SocketRef,
    State(pool): State<PgPool>,
    State(jwt): State<Arc<JwtKeys>>,
    State(redis): State<redis::aio::ConnectionManager>,
) {
    let Some(user_id) = authenticate(&jwt, &mut redis.clone(), &socket).await else {
        tracing::debug!(id = %socket.id, "realtime auth failed, disconnecting");
        let _ = socket.disconnect();
        return;
    };

    socket.join(user_id.to_string());

    match repositories::organization::find_by_user(&pool, user_id).await {
        Ok(orgs) => {
            for org in &orgs {
                socket.join(org.id.to_string());
            }
            tracing::debug!(
                socket_id = %socket.id,
                user_id = %user_id,
                orgs = orgs.len(),
                "realtime client connected"
            );
        }
        Err(e) => {
            tracing::warn!(
                socket_id = %socket.id,
                error = %e,
                "failed to load organizations for realtime client"
            );
        }
    }
}

async fn authenticate(
    jwt: &JwtKeys,
    redis: &mut redis::aio::ConnectionManager,
    socket: &SocketRef,
) -> Option<uuid::Uuid> {
    let token = get_token_from_cookie(socket).or_else(|| get_token_from_query(socket))?;

    let claims = jwt.verify(&token).ok()?;

    let blacklist_key = format!("jwt:blacklist:{}", claims.jti);
    let is_blacklisted: bool = redis.exists(&blacklist_key).await.ok()?;

    if is_blacklisted {
        return None;
    }

    Some(claims.sub)
}

fn get_token_from_cookie(socket: &SocketRef) -> Option<String> {
    let headers = &socket.req_parts().headers;
    let cookie_header = headers.get("cookie")?.to_str().ok()?;

    Cookie::split_parse_encoded(cookie_header)
        .filter_map(|c| c.ok())
        .find(|c| c.name() == ACCESS_TOKEN_COOKIE)
        .map(|c| c.value().to_string())
}

fn get_token_from_query(socket: &SocketRef) -> Option<String> {
    let query = socket.req_parts().uri.query()?;
    url::form_urlencoded::parse(query.as_bytes())
        .find(|(k, _)| k == "token")
        .map(|(_, v)| v.into_owned())
}
