// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use base64::Engine;
use std::collections::HashSet;
use std::net::SocketAddr;
use std::sync::Arc;

use api::config::AppConfig;
use api::constants::infra::SHUTDOWN_TASK_TIMEOUT;
use api::infra::{database, lock::RedisLock, redis};
use api::mail::client::MailClient;
use api::middleware::rate_limit;
use api::realtime::Realtime;
use api::state::AppState;
use api::{jobs, middleware, routes};

use axum::Router;
use axum::ServiceExt;
use axum::http::Method;
use clap::Parser;
use socketioxide::SocketIo;
use tokio::sync::Mutex;
use tokio_util::task::TaskTracker;
use tower::Layer;
use tower_http::cors::{AllowHeaders, AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

#[derive(Parser)]
#[command(name = "snapflow")]
struct Cli {
    #[arg(long)]
    migration_run: bool,

    #[arg(long)]
    migration_revert: bool,

    #[arg(long)]
    openapi: bool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    if cli.openapi {
        let spec = routes::build_openapi()
            .to_pretty_json()
            .expect("failed to serialize OpenAPI spec");
        println!("{spec}");
        return Ok(());
    }

    let config = AppConfig::load()?;

    let env_filter = tracing_subscriber::EnvFilter::new(format!(
        "{},sqlx=warn,tower_http=info",
        config.log.level
    ));

    if config.is_production() {
        tracing_subscriber::fmt()
            .with_env_filter(env_filter)
            .json()
            .init();
    } else {
        tracing_subscriber::fmt()
            .with_env_filter(env_filter)
            .with_target(true)
            .with_thread_ids(false)
            .init();
    }

    tracing::info!(
        port = config.port,
        environment = %config.environment,
        "starting snapflow api"
    );

    let pool = database::create_pool(&config.database).await?;

    if cli.migration_run {
        tracing::info!("running pending migrations");
        database::run_migrations(&pool).await?;
        tracing::info!("migrations completed");
        pool.close().await;
        return Ok(());
    }

    if cli.migration_revert {
        tracing::info!("reverting last migration");
        database::revert_migration(&pool).await?;
        tracing::info!("migration reverted");
        pool.close().await;
        return Ok(());
    }

    database::run_migrations(&pool).await?;

    let redis_conn = redis::connect(&config.redis)
        .await
        .expect("redis is required");

    let mail = MailClient::new(&config.smtp);
    let storage = api::services::storage::StorageClient::new(&config.r2).map(Arc::new);

    let lock = RedisLock::new(redis_conn.clone());

    let pem = String::from_utf8(
        base64::engine::general_purpose::STANDARD
            .decode(config.jwt_private_key.trim())
            .expect("failed to base64 decode JWT_PRIVATE_KEY"),
    )
    .expect("JWT_PRIVATE_KEY is not valid UTF-8");
    let jwt_keys = Arc::new(
        snapflow_auth::jwt::JwtKeys::from_ec_pem(pem.as_bytes())
            .expect("failed to load JWT keys from JWT_PRIVATE_KEY"),
    );

    let (sio_layer, sio) = SocketIo::builder()
        .req_path("/api/realtime")
        .transports([socketioxide::TransportType::Websocket])
        .with_state(pool.clone())
        .with_state(Arc::clone(&jwt_keys))
        .with_state(redis_conn.clone())
        .build_layer();
    let realtime = Realtime::new(sio.clone());

    sio.ns("/", api::realtime::on_connect);
    tracing::info!("realtime websocket initialized");

    let docker = api::infra::docker::DockerClient::new(None, None)
        .ok()
        .map(Arc::new);

    let port = config.port;
    let config = Arc::new(config);

    let task_tracker = TaskTracker::default();

    api::bootstrap::run(&pool, &config).await;

    let infra = api::infra::Infra {
        pool,
        config: Arc::clone(&config),
        jwt: jwt_keys,
        lock,
        redis: redis_conn.clone(),
        realtime,
        events: api::events::EventBus::new(),
        http_client: reqwest::Client::default(),
        mail: Arc::new(mail),
        storage,
        docker,
        task_tracker: task_tracker.clone(),
        bucket_processing: Arc::new(Mutex::new(HashSet::default())),
    };

    let state = AppState {
        infra,
        rate_limiter: rate_limit::create_limiter(10),
        auth_rate_limiter: rate_limit::create_auth_limiter(3),
    };

    jobs::start(&state).await?;

    let cors = CorsLayer::default()
        .allow_origin(AllowOrigin::mirror_request())
        .allow_credentials(true)
        .allow_methods([
            Method::GET,
            Method::HEAD,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers(AllowHeaders::mirror_request());

    let router = Router::default()
        .nest("/api", routes::router(&config, &state))
        .layer(sio_layer)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(axum::middleware::from_fn(
            common_rs::middleware::request_id::request_id,
        ))
        .layer(axum::middleware::from_fn({
            let vh = common_rs::middleware::version_header::VersionHeader::new(
                common_rs::constants::headers::VERSION,
                concat!("v", env!("CARGO_PKG_VERSION")),
            );
            move |req, next| vh.clone().handle(req, next)
        }))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            middleware::maintenance::maintenance,
        ))
        .with_state(state);

    let app = tower_http::normalize_path::NormalizePathLayer::trim_trailing_slash().layer(router);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!(%addr, "listening");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(
        listener,
        ServiceExt::<axum::http::Request<axum::body::Body>>::into_make_service(app),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?;

    tracing::info!("server stopping, waiting for active tasks to complete");
    task_tracker.close();
    if tokio::time::timeout(SHUTDOWN_TASK_TIMEOUT, task_tracker.wait())
        .await
        .is_err()
    {
        tracing::warn!("timed out waiting for active tasks, proceeding with shutdown");
    }

    tracing::info!("server shut down gracefully");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install ctrl+c handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => tracing::info!("received ctrl+c, shutting down"),
        () = terminate => tracing::info!("received SIGTERM, shutting down"),
    }
}
