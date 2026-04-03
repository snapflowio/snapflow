// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Json;
use axum::extract::State;

use crate::constants::billing::get_tier_for_balance;
use crate::extractors::organization::OrganizationContext;
use crate::repositories;
use crate::schemas::billing::{WalletOverviewDto, WalletTransactionDto};
use crate::state::AppState;
use snapflow_errors::Result;

#[utoipa::path(
    get,
    path = "/organizations/{organization_id}/wallet",
    tag = "billing",
    operation_id = "getWalletOverview",
    summary = "Get wallet overview",
    params(
        ("organization_id" = Uuid, Path, description = "ID of the organization"),
    ),
    responses(
        (status = 200, description = "Wallet overview.", body = WalletOverviewDto),
    ),
    security(("bearer" = []))
)]
pub async fn get_wallet(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
) -> Result<Json<WalletOverviewDto>> {
    let balance =
        repositories::billing::get_balance(&state.infra.pool, org_ctx.organization.id).await?;
    let tier = get_tier_for_balance(balance);

    Ok(Json(WalletOverviewDto {
        balance,
        tier_id: tier.id.to_string(),
        tier_name: tier.name.to_string(),
    }))
}

#[utoipa::path(
    get,
    path = "/organizations/{organization_id}/wallet/transactions",
    tag = "billing",
    operation_id = "listWalletTransactions",
    summary = "List wallet transactions",
    params(
        ("organization_id" = Uuid, Path, description = "ID of the organization"),
    ),
    responses(
        (status = 200, description = "List of wallet transactions.", body = Vec<WalletTransactionDto>),
    ),
    security(("bearer" = []))
)]
pub async fn list_transactions(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
) -> Result<Json<Vec<WalletTransactionDto>>> {
    let transactions =
        repositories::billing::find_transactions(&state.infra.pool, org_ctx.organization.id, 100)
            .await?;
    Ok(Json(
        transactions
            .iter()
            .map(WalletTransactionDto::from)
            .collect(),
    ))
}
