// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::http::header::{HeaderMap, HeaderValue, SET_COOKIE};
use cookie::{Cookie, SameSite};

use crate::constants::auth::{ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE};

pub fn set_access_token_cookie(
    headers: &mut HeaderMap,
    token: &str,
    is_production: bool,
) -> Result<(), String> {
    let cookie = Cookie::build((ACCESS_TOKEN_COOKIE, token))
        .max_age(cookie::time::Duration::minutes(15))
        .secure(is_production)
        .http_only(true)
        .same_site(SameSite::Lax)
        .path("/")
        .build()
        .to_string();

    headers.insert(
        SET_COOKIE,
        HeaderValue::from_str(&cookie).map_err(|e| e.to_string())?,
    );
    Ok(())
}

pub fn set_refresh_token_cookie(
    headers: &mut HeaderMap,
    token: &str,
    is_production: bool,
) -> Result<(), String> {
    let cookie = Cookie::build((REFRESH_TOKEN_COOKIE, token))
        .max_age(cookie::time::Duration::days(30))
        .secure(is_production)
        .http_only(true)
        .same_site(SameSite::Lax)
        .path("/")
        .build()
        .to_string();

    headers.append(
        SET_COOKIE,
        HeaderValue::from_str(&cookie).map_err(|e| e.to_string())?,
    );
    Ok(())
}

pub fn clear_access_token_cookie(
    headers: &mut HeaderMap,
    is_production: bool,
) -> Result<(), String> {
    let cookie = Cookie::build((ACCESS_TOKEN_COOKIE, ""))
        .max_age(cookie::time::Duration::ZERO)
        .secure(is_production)
        .http_only(true)
        .path("/")
        .build()
        .to_string();

    headers.insert(
        SET_COOKIE,
        HeaderValue::from_str(&cookie).map_err(|e| e.to_string())?,
    );
    Ok(())
}

pub fn clear_refresh_token_cookie(
    headers: &mut HeaderMap,
    is_production: bool,
) -> Result<(), String> {
    let cookie = Cookie::build((REFRESH_TOKEN_COOKIE, ""))
        .max_age(cookie::time::Duration::ZERO)
        .secure(is_production)
        .http_only(true)
        .path("/")
        .build()
        .to_string();

    headers.append(
        SET_COOKIE,
        HeaderValue::from_str(&cookie).map_err(|e| e.to_string())?,
    );
    Ok(())
}

pub fn get_cookie_value(headers: &HeaderMap, cookie_name: &str) -> Option<String> {
    let cookie_header = headers.get("cookie")?.to_str().ok()?;

    for part in cookie_header.split(';') {
        if let Ok(cookie) = Cookie::parse(part.trim()) {
            if cookie.name() == cookie_name {
                return Some(cookie.value().to_string());
            }
        }
    }

    None
}

pub fn get_access_token(headers: &HeaderMap) -> Option<String> {
    get_cookie_value(headers, ACCESS_TOKEN_COOKIE)
}

pub fn get_refresh_token(headers: &HeaderMap) -> Option<String> {
    get_cookie_value(headers, REFRESH_TOKEN_COOKIE)
}
