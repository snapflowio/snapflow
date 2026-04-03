// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::{IntoParams, ToSchema};

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LspServerRequest {
    pub language_id: String,
    pub path_to_project: String,
}

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LspDocumentRequest {
    pub language_id: String,
    pub path_to_project: String,
    pub uri: String,
}

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LspCompletionParams {
    pub language_id: String,
    pub path_to_project: String,
    pub uri: String,
    pub position: Position,
    pub context: Option<CompletionContext>,
}

#[derive(Deserialize, Serialize, Clone, ToSchema)]
pub struct Position {
    pub line: i32,
    pub character: i32,
}

#[derive(Deserialize, Serialize, Clone, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CompletionContext {
    pub trigger_kind: i32,
    pub trigger_character: Option<String>,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CompletionList {
    pub is_incomplete: bool,
    pub items: Vec<CompletionItem>,
}

#[derive(Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CompletionItem {
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Option<Object>)]
    pub documentation: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub insert_text: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct LspSymbol {
    pub kind: i32,
    pub location: LspLocation,
    pub name: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct LspLocation {
    pub range: LspRange,
    pub uri: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct LspRange {
    pub end: LspPosition,
    pub start: LspPosition,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct LspPosition {
    pub character: i32,
    pub line: i32,
}

#[derive(Deserialize, IntoParams)]
#[serde(rename_all = "camelCase")]
pub struct DocumentSymbolsQuery {
    pub language_id: Option<String>,
    pub path_to_project: Option<String>,
    pub uri: Option<String>,
}

#[derive(Deserialize, IntoParams)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSymbolsQuery {
    pub query: Option<String>,
    pub language_id: Option<String>,
    pub path_to_project: Option<String>,
}
