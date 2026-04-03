// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::client::LspClient;
use crate::common::errors::AppError;
use std::io::BufReader;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, atomic::AtomicI64};

pub struct LspServerInstance {
    pub child: Child,
    pub client: Arc<LspClient>,
    pub initialized: bool,
}

fn spawn_lsp_server(
    command: &str,
    args: &[&str],
    path_to_project: &str,
    client_name: &str,
) -> Result<LspServerInstance, AppError> {
    let mut child = Command::new(command)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| AppError::internal(format!("failed to start LSP server: {e}")))?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| AppError::internal("no stdin"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| AppError::internal("no stdout"))?;

    let client = Arc::new(LspClient {
        stdin: Mutex::new(stdin),
        stdout: Mutex::new(BufReader::new(stdout)),
        next_id: AtomicI64::new(1),
    });

    let init_params = serde_json::json!({
        "processId": std::process::id(),
        "clientInfo": { "name": client_name, "version": "0.0.1" },
        "rootUri": format!("file://{path_to_project}"),
        "capabilities": {
            "textDocument": {
                "completion": {
                    "dynamicRegistration": true,
                    "completionItem": {
                        "snippetSupport": true,
                        "commitCharactersSupport": true,
                        "documentationFormat": ["markdown", "plaintext"],
                        "deprecatedSupport": true,
                        "preselectSupport": true
                    },
                    "contextSupport": true
                },
                "documentSymbol": {
                    "dynamicRegistration": true,
                    "symbolKind": { "valueSet": [1,2,3,4,5,6,7,8,9,10,11,12,13] }
                }
            },
            "workspace": {
                "symbol": { "dynamicRegistration": true }
            }
        }
    });

    client.send_request("initialize", init_params)?;
    client.send_notification("initialized", serde_json::json!({}))?;

    Ok(LspServerInstance {
        child,
        client,
        initialized: true,
    })
}

pub fn create_typescript_server(path_to_project: &str) -> Result<LspServerInstance, AppError> {
    spawn_lsp_server(
        "typescript-language-server",
        &["--stdio"],
        path_to_project,
        "snapflow-typescript-lsp-client",
    )
}
