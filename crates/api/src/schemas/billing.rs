// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::models::WalletTransaction;

#[derive(Serialize, ToSchema)]
#[schema(as = WalletOverview)]
#[serde(rename_all = "camelCase")]
pub struct WalletOverviewDto {
    pub balance: f64,
    pub tier_id: String,
    pub tier_name: String,
}

#[derive(Serialize, ToSchema)]
#[schema(as = WalletTransaction)]
#[serde(rename_all = "camelCase")]
pub struct WalletTransactionDto {
    pub id: Uuid,
    pub amount: f64,
    pub balance_after: f64,
    pub description: String,
    pub sandbox_id: Option<Uuid>,
    pub usage_period_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

impl From<&WalletTransaction> for WalletTransactionDto {
    fn from(t: &WalletTransaction) -> Self {
        Self {
            id: t.id,
            amount: t.amount,
            balance_after: t.balance_after,
            description: t.description.clone(),
            sandbox_id: t.sandbox_id,
            usage_period_id: t.usage_period_id,
            created_at: t.created_at,
        }
    }
}
