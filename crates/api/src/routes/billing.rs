// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Router;
use axum::routing::get;
use utoipa::OpenApi;

use crate::handlers;
use crate::schemas;
use crate::state::AppState;

#[derive(OpenApi)]
#[openapi(
    paths(handlers::billing::get_wallet, handlers::billing::list_transactions,),
    components(schemas(
        schemas::billing::WalletOverviewDto,
        schemas::billing::WalletTransactionDto,
    ))
)]
pub struct Api;

pub fn router() -> Router<AppState> {
    Router::default()
        .route(
            "/organizations/{organization_id}/wallet",
            get(handlers::billing::get_wallet),
        )
        .route(
            "/organizations/{organization_id}/wallet/transactions",
            get(handlers::billing::list_transactions),
        )
}
