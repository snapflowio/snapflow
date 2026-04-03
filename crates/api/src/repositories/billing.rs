use sqlx::Postgres;
use uuid::Uuid;

use crate::models::{SandboxUsagePeriod, WalletTransaction};

pub async fn find_unbilled_closed_periods<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    limit: i64,
) -> sqlx::Result<Vec<SandboxUsagePeriod>> {
    sqlx::query_as::<_, SandboxUsagePeriod>(
        "SELECT * FROM sandbox_usage_period
         WHERE billed = false AND end_at IS NOT NULL
         ORDER BY end_at ASC
         LIMIT $1",
    )
    .bind(limit)
    .fetch_all(db)
    .await
}

pub async fn mark_period_billed<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE sandbox_usage_period SET billed = true WHERE id = $1")
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn deduct_and_mark_billed(
    pool: &sqlx::PgPool,
    organization_id: Uuid,
    amount: f64,
    description: &str,
    sandbox_id: Option<Uuid>,
    usage_period_id: Uuid,
) -> sqlx::Result<f64> {
    let mut tx = pool.begin().await?;

    let (current_balance,): (f64,) =
        sqlx::query_as("SELECT wallet_balance FROM organization WHERE id = $1 FOR UPDATE")
            .bind(organization_id)
            .fetch_one(&mut *tx)
            .await?;

    let actual_deduction = amount.min(current_balance.max(0.0));
    let new_balance = current_balance - actual_deduction;

    sqlx::query("UPDATE organization SET wallet_balance = $1, updated_at = now() WHERE id = $2")
        .bind(new_balance)
        .bind(organization_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query(
        "INSERT INTO wallet_transaction (organization_id, amount, balance_after, description, sandbox_id, usage_period_id)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(organization_id)
    .bind(-actual_deduction)
    .bind(new_balance)
    .bind(description)
    .bind(sandbox_id)
    .bind(Some(usage_period_id))
    .execute(&mut *tx)
    .await?;

    sqlx::query("UPDATE sandbox_usage_period SET billed = true WHERE id = $1")
        .bind(usage_period_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(new_balance)
}

pub async fn add_balance(
    pool: &sqlx::PgPool,
    organization_id: Uuid,
    amount: f64,
    description: &str,
) -> sqlx::Result<f64> {
    let mut tx = pool.begin().await?;

    let (new_balance,): (f64,) = sqlx::query_as(
        "UPDATE organization
         SET wallet_balance = wallet_balance + $1, updated_at = now()
         WHERE id = $2
         RETURNING wallet_balance",
    )
    .bind(amount)
    .bind(organization_id)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO wallet_transaction (organization_id, amount, balance_after, description)
         VALUES ($1, $2, $3, $4)",
    )
    .bind(organization_id)
    .bind(amount)
    .bind(new_balance)
    .bind(description)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(new_balance)
}

pub async fn get_balance<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    organization_id: Uuid,
) -> sqlx::Result<f64> {
    sqlx::query_scalar::<_, f64>("SELECT wallet_balance FROM organization WHERE id = $1")
        .bind(organization_id)
        .fetch_one(db)
        .await
}

pub async fn find_transactions<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    organization_id: Uuid,
    limit: i64,
) -> sqlx::Result<Vec<WalletTransaction>> {
    sqlx::query_as::<_, WalletTransaction>(
        "SELECT * FROM wallet_transaction
         WHERE organization_id = $1
         ORDER BY created_at DESC
         LIMIT $2",
    )
    .bind(organization_id)
    .bind(limit)
    .fetch_all(db)
    .await
}
