// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

mod api_key;
mod auth;
mod billing;
mod bucket;
mod executor;
mod health;
mod image;
mod oauth;
mod organization;
mod preview;
mod registry;
mod sandbox;
mod storage;

use axum::Router;
use utoipa::Modify;
use utoipa::OpenApi;
use utoipa::openapi::path::{ParameterBuilder, ParameterIn};
use utoipa::openapi::schema::SchemaType;
use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
use utoipa::openapi::{ObjectBuilder, Type};
use utoipa_scalar::{Scalar, Servable};

use crate::config::AppConfig;
use crate::middleware;
use crate::middleware::rate_limit;
use crate::state::AppState;
use snapflow_errors::AppError;

const SCALAR_HTML: &str = r#"<!doctype html>
<html>
<head>
    <title>Snapflow API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
    <script id="api-reference" data-configuration='{"theme":"alternate"}'></script>
    <script>
        document.getElementById('api-reference').textContent = JSON.stringify($spec)
    </script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>"#;

async fn api_fallback() -> AppError {
    AppError::NotFound("route not found".into())
}

pub fn build_openapi() -> utoipa::openapi::OpenApi {
    struct BearerSecurityScheme;
    impl Modify for BearerSecurityScheme {
        fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
            let components = openapi.components.get_or_insert_with(Default::default);
            components.security_schemes.insert(
                "bearer".to_owned(),
                SecurityScheme::Http(
                    HttpBuilder::default()
                        .scheme(HttpAuthScheme::Bearer)
                        .bearer_format("API Key or JWT")
                        .build(),
                ),
            );
        }
    }

    #[derive(OpenApi)]
    #[openapi(
        info(
            title = "Snapflow API",
            version = "0.1.0",
        ),
        security(("bearer" = [])),
        modifiers(&BearerSecurityScheme)
    )]
    struct BaseDoc;

    let mut doc = BaseDoc::openapi();
    doc.merge(health::Api::openapi());
    doc.merge(auth::Api::openapi());
    doc.merge(organization::Api::openapi());
    doc.merge(api_key::Api::openapi());
    doc.merge(registry::Api::openapi());
    doc.merge(storage::Api::openapi());
    doc.merge(bucket::Api::openapi());
    doc.merge(executor::Api::openapi());
    doc.merge(sandbox::Api::openapi());
    doc.merge(image::Api::openapi());
    doc.merge(preview::Api::openapi());
    doc.merge(oauth::Api::openapi());
    doc.merge(billing::Api::openapi());

    add_organization_header(&mut doc);

    doc
}

fn add_organization_header(openapi: &mut utoipa::openapi::OpenApi) {
    let header_param = ParameterBuilder::default()
        .name("x-snapflow-organization-id")
        .parameter_in(ParameterIn::Header)
        .description(Some("Organization ID"))
        .schema(Some(utoipa::openapi::RefOr::T(
            ObjectBuilder::new()
                .schema_type(SchemaType::new(Type::String))
                .into(),
        )))
        .build();

    let skip_prefixes = ["/auth", "/health", "/executor", "/preview"];

    for (path, item) in openapi.paths.paths.iter_mut() {
        if path.contains("{organization_id}") {
            continue;
        }
        if skip_prefixes.iter().any(|p| path.starts_with(p)) {
            continue;
        }
        for operation in [
            item.get.as_mut(),
            item.post.as_mut(),
            item.put.as_mut(),
            item.patch.as_mut(),
            item.delete.as_mut(),
        ]
        .into_iter()
        .flatten()
        {
            operation
                .parameters
                .get_or_insert_with(Vec::new)
                .insert(0, header_param.clone());
        }
    }
}

pub fn router(config: &AppConfig, state: &AppState) -> Router<AppState> {
    let public = Router::default()
        .merge(health::router())
        .merge(
            auth::public_router().route_layer(axum::middleware::from_fn_with_state(
                state.clone(),
                rate_limit::limit_auth_by_ip,
            )),
        )
        .merge(preview::public_router())
        .merge(oauth::public_router());

    let protected = Router::default()
        .merge(auth::protected_router())
        .merge(organization::router())
        .merge(api_key::router())
        .merge(registry::router())
        .merge(storage::router())
        .merge(bucket::router())
        .merge(executor::router())
        .merge(sandbox::router())
        .merge(image::router())
        .merge(preview::protected_router())
        .merge(oauth::protected_router())
        .merge(billing::router())
        .route_layer(axum::middleware::from_fn_with_state(
            state.clone(),
            middleware::auth::require_auth,
        ));

    let mut app = Router::default()
        .merge(public)
        .merge(protected)
        .fallback(api_fallback)
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            middleware::csrf::check_origin,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            rate_limit::limit_by_ip,
        ));

    if !config.is_production() {
        app = app.merge(Scalar::with_url("/reference", build_openapi()).custom_html(SCALAR_HTML));
    }

    app
}
