// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::path::{Component, PathBuf};
use std::time::Instant;

use super::{
    runtimes::get_runtime,
    types::{CodeRunRequest, CodeRunResponse},
};
use crate::common::errors::AppError;
use axum::Json;
use tokio::process::Command;

fn is_safe_subpath(base: &PathBuf, relative: &str) -> bool {
    let path = std::path::Path::new(relative);
    for component in path.components() {
        match component {
            Component::ParentDir => return false,
            Component::RootDir => return false,
            _ => {}
        }
    }
    let joined = base.join(relative);
    joined.starts_with(base)
}

#[utoipa::path(
    post,
    path = "/process/code-run",
    tag = "process",
    operation_id = "runCode",
    request_body = CodeRunRequest,
    responses(
        (status = 200, body = CodeRunResponse),
    )
)]
pub async fn run_code(Json(req): Json<CodeRunRequest>) -> Result<Json<CodeRunResponse>, AppError> {
    let runner = get_runtime(&req.language)
        .ok_or_else(|| AppError::bad_request(format!("unsupported language: {}", req.language)))?;

    let timeout = std::time::Duration::from_secs(req.timeout.unwrap_or(30));

    let (work_dir, _tmp_dir) = match req.work_dir {
        Some(ref wd) => (PathBuf::from(wd), None),
        None => {
            let td = tempfile::TempDir::new()
                .map_err(|_| AppError::internal("failed to create temp directory"))?;
            let path = td.path().to_path_buf();
            (path, Some(td))
        }
    };

    let entrypoint: PathBuf;
    if let Some(files) = &req.files {
        if files.is_empty() {
            return Err(AppError::bad_request(
                "either code or files must be provided",
            ));
        }
        for f in files {
            if !is_safe_subpath(&work_dir, &f.path) {
                return Err(AppError::bad_request(format!(
                    "invalid file path: {}",
                    f.path
                )));
            }
            let dest = work_dir.join(&f.path);
            if let Some(parent) = dest.parent() {
                tokio::fs::create_dir_all(parent)
                    .await
                    .map_err(|_| AppError::internal("failed to create file directories"))?;
            }
            tokio::fs::write(&dest, &f.content)
                .await
                .map_err(|_| AppError::internal(format!("failed to write file: {}", f.path)))?;
        }
        entrypoint = if let Some(ep) = &req.entrypoint {
            if !is_safe_subpath(&work_dir, ep) {
                return Err(AppError::bad_request("invalid entrypoint path"));
            }
            work_dir.join(ep)
        } else {
            work_dir.join(&files[0].path)
        };
    } else if let Some(code) = &req.code {
        let ep = req
            .entrypoint
            .as_deref()
            .unwrap_or(runner.default_entrypoint);
        if !is_safe_subpath(&work_dir, ep) {
            return Err(AppError::bad_request("invalid entrypoint path"));
        }
        let dest = work_dir.join(ep);
        tokio::fs::write(&dest, code)
            .await
            .map_err(|_| AppError::internal("failed to write code file"))?;
        entrypoint = dest;
    } else {
        return Err(AppError::bad_request(
            "either code or files must be provided",
        ));
    }

    let mut env: Vec<(String, String)> = std::env::vars()
        .filter(|(k, _)| !k.starts_with("SNAPFLOW_"))
        .collect();
    if let Some(extra) = &req.env {
        for (k, v) in extra {
            env.push((k.clone(), v.clone()));
        }
    }

    let start = Instant::now();
    let ep_str = entrypoint.to_string_lossy().to_string();
    let out_path = work_dir.join("snapflow_out").to_string_lossy().to_string();

    if let Some(compile_fn) = runner.compile_args {
        let compile_args = compile_fn(&ep_str, &out_path);
        let mut compile_cmd = Command::new(&compile_args[0]);
        compile_cmd
            .args(&compile_args[1..])
            .current_dir(&work_dir)
            .envs(env.iter().cloned())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        match tokio::time::timeout(timeout, compile_cmd.output()).await {
            Ok(Ok(output)) if !output.status.success() => {
                let duration = start.elapsed().as_millis() as i64;
                return Ok(Json(CodeRunResponse {
                    exit_code: output.status.code().unwrap_or(-1),
                    stdout: String::default(),
                    stderr: format!("compile error: {}", String::from_utf8_lossy(&output.stderr)),
                    duration,
                }));
            }
            Ok(Err(e)) => {
                return Ok(Json(CodeRunResponse {
                    exit_code: -1,
                    stdout: String::default(),
                    stderr: format!("compile error: {e}"),
                    duration: start.elapsed().as_millis() as i64,
                }));
            }
            Err(_) => {
                return Ok(Json(CodeRunResponse {
                    exit_code: -1,
                    stdout: String::default(),
                    stderr: format!("timeout after {timeout:?}"),
                    duration: start.elapsed().as_millis() as i64,
                }));
            }
            _ => {}
        }
    }

    let run_args = (runner.run_args)(&ep_str, &out_path);
    let mut run_cmd = Command::new(&run_args[0]);
    run_cmd
        .args(&run_args[1..])
        .current_dir(&work_dir)
        .envs(env.iter().cloned())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let result = tokio::time::timeout(timeout, run_cmd.output()).await;
    let duration = start.elapsed().as_millis() as i64;

    match result {
        Ok(Ok(output)) => Ok(Json(CodeRunResponse {
            exit_code: output.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            duration,
        })),
        Ok(Err(e)) => Ok(Json(CodeRunResponse {
            exit_code: -1,
            stdout: String::default(),
            stderr: e.to_string(),
            duration,
        })),
        Err(_) => Ok(Json(CodeRunResponse {
            exit_code: -1,
            stdout: String::default(),
            stderr: format!("timeout after {timeout:?}"),
            duration,
        })),
    }
}
