// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::http::header::{HeaderMap, HeaderValue, SET_COOKIE};
use chrono::{DateTime, Utc};

use crate::constants::auth::{ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE};

pub struct CookieBuilder {
    name: String,
    value: String,
    max_age: Option<i64>,
    expires: Option<DateTime<Utc>>,
    secure: bool,
    http_only: bool,
    same_site: SameSite,
    path: String,
    domain: Option<String>,
}

#[derive(Clone, Copy)]
pub enum SameSite {
    Strict,
    Lax,
    None,
}

impl SameSite {
    fn as_str(&self) -> &str {
        match self {
            SameSite::Strict => "Strict",
            SameSite::Lax => "Lax",
            SameSite::None => "None",
        }
    }
}

impl CookieBuilder {
    pub fn new(name: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            value: value.into(),
            max_age: None,
            expires: None,
            secure: true,
            http_only: true,
            same_site: SameSite::Lax,
            path: "/".to_string(),
            domain: None,
        }
    }

    pub fn max_age(mut self, seconds: i64) -> Self {
        self.max_age = Some(seconds);
        self
    }

    pub fn expires(mut self, expires: DateTime<Utc>) -> Self {
        self.expires = Some(expires);
        self
    }

    pub fn secure(mut self, secure: bool) -> Self {
        self.secure = secure;
        self
    }

    pub fn http_only(mut self, http_only: bool) -> Self {
        self.http_only = http_only;
        self
    }

    pub fn same_site(mut self, same_site: SameSite) -> Self {
        self.same_site = same_site;
        self
    }

    pub fn path(mut self, path: impl Into<String>) -> Self {
        self.path = path.into();
        self
    }

    pub fn domain(mut self, domain: impl Into<String>) -> Self {
        self.domain = Some(domain.into());
        self
    }

    pub fn build(self) -> String {
        let mut cookie = format!("{}={}", self.name, self.value);

        if let Some(max_age) = self.max_age {
            cookie.push_str(&format!("; Max-Age={}", max_age));
        }

        if let Some(expires) = self.expires {
            cookie.push_str(&format!("; Expires={}", expires.to_rfc2822()));
        }

        cookie.push_str(&format!("; Path={}", self.path));

        if let Some(domain) = self.domain {
            cookie.push_str(&format!("; Domain={}", domain));
        }

        if self.secure {
            cookie.push_str("; Secure");
        }

        if self.http_only {
            cookie.push_str("; HttpOnly");
        }

        cookie.push_str(&format!("; SameSite={}", self.same_site.as_str()));

        cookie
    }
}

pub fn set_access_token_cookie(
    headers: &mut HeaderMap,
    token: &str,
    is_production: bool,
) -> Result<(), String> {
    let cookie = CookieBuilder::new(ACCESS_TOKEN_COOKIE, token)
        .max_age(15 * 60) // 15 minutes
        .secure(is_production)
        .http_only(true)
        .same_site(SameSite::Lax)
        .build();

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
    let cookie = CookieBuilder::new(REFRESH_TOKEN_COOKIE, token)
        .max_age(30 * 24 * 60 * 60) // 30 days
        .secure(is_production)
        .http_only(true)
        .same_site(SameSite::Lax)
        .build();

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
    let cookie = CookieBuilder::new(ACCESS_TOKEN_COOKIE, "")
        .max_age(0)
        .secure(is_production)
        .http_only(true)
        .build();

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
    let cookie = CookieBuilder::new(REFRESH_TOKEN_COOKIE, "")
        .max_age(0)
        .secure(is_production)
        .http_only(true)
        .build();

    headers.append(
        SET_COOKIE,
        HeaderValue::from_str(&cookie).map_err(|e| e.to_string())?,
    );
    Ok(())
}

pub fn get_cookie_value(headers: &HeaderMap, cookie_name: &str) -> Option<String> {
    let cookie_header = headers.get("cookie")?.to_str().ok()?;

    for part in cookie_header.split(';') {
        let part = part.trim();
        if let Some(value) = part.strip_prefix(&format!("{}=", cookie_name)) {
            return Some(value.to_string());
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
