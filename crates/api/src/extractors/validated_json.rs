// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Json;
use axum::extract::FromRequest;
use axum::extract::rejection::JsonRejection;
use axum::http::Request;
use validator::Validate;

use crate::state::AppState;
use snapflow_errors::AppError;

pub struct ValidatedJson<T>(pub T);

impl<T> FromRequest<AppState> for ValidatedJson<T>
where
    T: serde::de::DeserializeOwned + Validate,
{
    type Rejection = AppError;

    async fn from_request(
        req: Request<axum::body::Body>,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let Json(body) = Json::<T>::from_request(req, state)
            .await
            .map_err(|e: JsonRejection| AppError::BadRequest(e.body_text()))?;

        body.validate().map_err(AppError::Validation)?;

        Ok(ValidatedJson(body))
    }
}
