// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use crate::common::errors::AppError;
use serde_json::Value;
use std::io::{BufRead, BufReader, Write};
use std::process::{ChildStdin, ChildStdout};
use std::sync::{Mutex, atomic::AtomicI64};
use std::time::{Duration, Instant};

const READ_RESPONSE_TIMEOUT: Duration = Duration::from_secs(30);

pub struct LspClient {
    pub stdin: Mutex<ChildStdin>,
    pub stdout: Mutex<BufReader<ChildStdout>>,
    pub next_id: AtomicI64,
}

impl LspClient {
    pub fn send_request(&self, method: &str, params: Value) -> Result<Value, AppError> {
        let id = self
            .next_id
            .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        });

        let body =
            serde_json::to_string(&request).map_err(|e| AppError::internal(e.to_string()))?;
        let msg = format!("Content-Length: {}\r\n\r\n{}", body.len(), body);

        {
            let mut stdin = self
                .stdin
                .lock()
                .map_err(|e| AppError::internal(e.to_string()))?;
            stdin
                .write_all(msg.as_bytes())
                .map_err(|e| AppError::internal(e.to_string()))?;
            stdin
                .flush()
                .map_err(|e| AppError::internal(e.to_string()))?;
        }

        self.read_response(id)
    }

    pub fn send_notification(&self, method: &str, params: Value) -> Result<(), AppError> {
        let notification = serde_json::json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        });

        let body =
            serde_json::to_string(&notification).map_err(|e| AppError::internal(e.to_string()))?;
        let msg = format!("Content-Length: {}\r\n\r\n{}", body.len(), body);

        let mut stdin = self
            .stdin
            .lock()
            .map_err(|e| AppError::internal(e.to_string()))?;
        stdin
            .write_all(msg.as_bytes())
            .map_err(|e| AppError::internal(e.to_string()))?;
        stdin
            .flush()
            .map_err(|e| AppError::internal(e.to_string()))?;

        Ok(())
    }

    fn read_response(&self, expected_id: i64) -> Result<Value, AppError> {
        let mut stdout = self
            .stdout
            .lock()
            .map_err(|e| AppError::internal(e.to_string()))?;

        let deadline = Instant::now() + READ_RESPONSE_TIMEOUT;

        loop {
            if Instant::now() >= deadline {
                return Err(AppError::internal(format!(
                    "LSP response timeout waiting for request id {expected_id}"
                )));
            }

            let mut content_length: usize = 0;
            loop {
                let mut header_line = String::default();
                stdout
                    .read_line(&mut header_line)
                    .map_err(|e| AppError::internal(e.to_string()))?;
                let trimmed = header_line.trim();
                if trimmed.is_empty() {
                    break;
                }
                if let Some(len_str) = trimmed.strip_prefix("Content-Length: ") {
                    content_length = len_str
                        .parse()
                        .map_err(|_| AppError::internal("invalid Content-Length"))?;
                }
            }

            if content_length == 0 {
                return Err(AppError::internal("empty LSP response"));
            }

            let mut body = vec![0u8; content_length];
            std::io::Read::read_exact(&mut *stdout, &mut body)
                .map_err(|e| AppError::internal(e.to_string()))?;

            let response: Value =
                serde_json::from_slice(&body).map_err(|e| AppError::internal(e.to_string()))?;

            if let Some(id) = response.get("id")
                && id.as_i64() == Some(expected_id)
            {
                if let Some(error) = response.get("error") {
                    let msg = error
                        .get("message")
                        .and_then(|m| m.as_str())
                        .unwrap_or("LSP error");
                    return Err(AppError::bad_request(msg));
                }
                return Ok(response.get("result").cloned().unwrap_or(Value::Null));
            }
        }
    }
}
