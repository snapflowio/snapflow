// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

use crate::constants::pagination::{DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT};
use crate::state::AppState;
use snapflow_errors::AppError;

#[derive(Debug, Clone, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct Pagination {
    #[param(default = 1, minimum = 1)]
    pub page: Option<u32>,
    #[param(default = 10, minimum = 1, maximum = 100)]
    pub limit: Option<u32>,
}

impl Pagination {
    pub fn page(&self) -> u32 {
        self.page.unwrap_or(DEFAULT_PAGE).max(1)
    }

    pub fn limit(&self) -> u32 {
        self.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT)
    }

    pub fn offset(&self) -> u32 {
        (self.page() - 1) * self.limit()
    }
}

impl FromRequestParts<AppState> for Pagination {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let axum::extract::Query(pagination) =
            axum::extract::Query::<Pagination>::from_request_parts(parts, state)
                .await
                .map_err(|e| AppError::BadRequest(format!("invalid pagination params: {e}")))?;

        Ok(pagination)
    }
}

#[derive(Serialize, ToSchema)]
pub struct PaginatedResponse<T: Serialize> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub total_pages: i64,
}

impl<T: Serialize> PaginatedResponse<T> {
    pub fn new(items: Vec<T>, total: i64, pagination: &Pagination) -> Self {
        let limit = pagination.limit() as i64;
        let total_pages = if total == 0 {
            0
        } else {
            (total + limit - 1) / limit
        };

        Self {
            items,
            total,
            page: pagination.page() as i64,
            total_pages,
        }
    }
}
