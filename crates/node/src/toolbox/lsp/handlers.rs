// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::types::*;
use snapflow_errors::AppError;
use crate::toolbox::AppState;
use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde_json::Value;
use std::sync::Arc;

#[utoipa::path(
    post,
    path = "/lsp/start",
    tag = "lsp",
    operation_id = "lspStart",
    request_body = LspServerRequest,
    responses(
        (status = 200),
    )
)]
pub async fn start(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LspServerRequest>,
) -> Result<impl IntoResponse, AppError> {
    let language_id = req.language_id.clone();
    let path = req.path_to_project.clone();
    let lsp = state.lsp_servers.clone();

    tokio::task::spawn_blocking(move || lsp.start_server(&language_id, &path))
        .await
        .map_err(|e| AppError::internal(e.to_string()))??;

    Ok(StatusCode::OK)
}

#[utoipa::path(
    post,
    path = "/lsp/stop",
    tag = "lsp",
    operation_id = "lspStop",
    request_body = LspServerRequest,
    responses(
        (status = 200),
    )
)]
pub async fn stop(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LspServerRequest>,
) -> Result<impl IntoResponse, AppError> {
    state
        .lsp_servers
        .stop_server(&req.language_id, &req.path_to_project)
        .await?;

    Ok(StatusCode::OK)
}

#[utoipa::path(
    post,
    path = "/lsp/completions",
    tag = "lsp",
    operation_id = "lspCompletions",
    request_body = LspCompletionParams,
    responses(
        (status = 200, body = CompletionList),
    )
)]
pub async fn completions(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LspCompletionParams>,
) -> Result<Json<CompletionList>, AppError> {
    let server = state
        .lsp_servers
        .get_server(&req.language_id, &req.path_to_project)?;

    let params = serde_json::json!({
        "textDocument": { "uri": req.uri },
        "position": { "line": req.position.line, "character": req.position.character },
        "context": req.context,
    });

    let result =
        tokio::task::spawn_blocking(move || server.send_request("textDocument/completion", params))
            .await
            .map_err(|e| AppError::internal(e.to_string()))??;

    let list: CompletionList = if result.is_object() {
        let items: Vec<CompletionItem> = serde_json::from_value(
            result
                .get("items")
                .cloned()
                .unwrap_or_else(|| Value::Array(vec![])),
        )
        .unwrap_or_default();

        CompletionList {
            is_incomplete: result
                .get("isIncomplete")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            items,
        }
    } else if result.is_array() {
        CompletionList {
            is_incomplete: false,
            items: serde_json::from_value(result).unwrap_or_default(),
        }
    } else {
        CompletionList {
            is_incomplete: false,
            items: vec![],
        }
    };

    Ok(Json(list))
}

#[utoipa::path(
    post,
    path = "/lsp/did-open",
    tag = "lsp",
    operation_id = "lspDidOpen",
    request_body = LspDocumentRequest,
    responses(
        (status = 200),
    )
)]
pub async fn did_open(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LspDocumentRequest>,
) -> Result<impl IntoResponse, AppError> {
    let server = state
        .lsp_servers
        .get_server(&req.language_id, &req.path_to_project)?;

    let path = req.uri.strip_prefix("file://").unwrap_or(&req.uri);
    let content = tokio::fs::read_to_string(path)
        .await
        .map_err(|e| AppError::bad_request(e.to_string()))?;

    let language_id = req.language_id.clone();
    let uri = req.uri.clone();

    tokio::task::spawn_blocking(move || {
        server.send_notification(
            "textDocument/didOpen",
            serde_json::json!({
                "textDocument": {
                    "uri": uri,
                    "languageId": language_id,
                    "version": 1,
                    "text": content,
                }
            }),
        )
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))??;

    Ok(StatusCode::OK)
}

#[utoipa::path(
    post,
    path = "/lsp/did-close",
    tag = "lsp",
    operation_id = "lspDidClose",
    request_body = LspDocumentRequest,
    responses(
        (status = 200),
    )
)]
pub async fn did_close(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LspDocumentRequest>,
) -> Result<impl IntoResponse, AppError> {
    let server = state
        .lsp_servers
        .get_server(&req.language_id, &req.path_to_project)?;
    let uri = req.uri.clone();

    tokio::task::spawn_blocking(move || {
        server.send_notification(
            "textDocument/didClose",
            serde_json::json!({ "textDocument": { "uri": uri } }),
        )
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))??;

    Ok(StatusCode::OK)
}

#[utoipa::path(
    get,
    path = "/lsp/document-symbols",
    tag = "lsp",
    operation_id = "lspDocumentSymbols",
    params(DocumentSymbolsQuery),
    responses(
        (status = 200, body = Vec<LspSymbol>),
    )
)]
pub async fn document_symbols(
    State(state): State<Arc<AppState>>,
    Query(q): Query<DocumentSymbolsQuery>,
) -> Result<Json<Vec<LspSymbol>>, AppError> {
    let language_id = q
        .language_id
        .ok_or_else(|| AppError::bad_request("languageId is required"))?;
    let path = q
        .path_to_project
        .ok_or_else(|| AppError::bad_request("pathToProject is required"))?;
    let uri = q
        .uri
        .ok_or_else(|| AppError::bad_request("uri is required"))?;

    let server = state.lsp_servers.get_server(&language_id, &path)?;

    let result = tokio::task::spawn_blocking(move || {
        server.send_request(
            "textDocument/documentSymbol",
            serde_json::json!({ "textDocument": { "uri": uri } }),
        )
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))??;

    let symbols: Vec<LspSymbol> = serde_json::from_value(result).unwrap_or_default();
    Ok(Json(symbols))
}

#[utoipa::path(
    get,
    path = "/lsp/workspacesymbols",
    tag = "lsp",
    operation_id = "lspWorkspaceSymbols",
    params(WorkspaceSymbolsQuery),
    responses(
        (status = 200, body = Vec<LspSymbol>),
    )
)]
pub async fn workspace_symbols(
    State(state): State<Arc<AppState>>,
    Query(q): Query<WorkspaceSymbolsQuery>,
) -> Result<Json<Vec<LspSymbol>>, AppError> {
    let query = q
        .query
        .ok_or_else(|| AppError::bad_request("query is required"))?;
    let language_id = q
        .language_id
        .ok_or_else(|| AppError::bad_request("languageId is required"))?;
    let path = q
        .path_to_project
        .ok_or_else(|| AppError::bad_request("pathToProject is required"))?;

    let server = state.lsp_servers.get_server(&language_id, &path)?;

    let result = tokio::task::spawn_blocking(move || {
        server.send_request("workspace/symbol", serde_json::json!({ "query": query }))
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))??;

    let symbols: Vec<LspSymbol> = serde_json::from_value(result).unwrap_or_default();
    Ok(Json(symbols))
}
