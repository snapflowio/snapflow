// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

pub struct Runtime {
    pub default_entrypoint: &'static str,
    pub compile_args: Option<fn(&str, &str) -> Vec<String>>,
    pub run_args: fn(&str, &str) -> Vec<String>,
}

pub fn get_runtime(language: &str) -> Option<Runtime> {
    match language {
        "typescript" => Some(Runtime {
            default_entrypoint: "index.ts",
            compile_args: None,
            run_args: |ep, _| vec!["npx".into(), "ts-node".into(), ep.into()],
        }),
        "javascript" => Some(Runtime {
            default_entrypoint: "index.js",
            compile_args: None,
            run_args: |ep, _| vec!["node".into(), ep.into()],
        }),
        "bun" => Some(Runtime {
            default_entrypoint: "index.ts",
            compile_args: None,
            run_args: |ep, _| vec!["bun".into(), "run".into(), ep.into()],
        }),
        "go" => Some(Runtime {
            default_entrypoint: "main.go",
            compile_args: None,
            run_args: |ep, _| vec!["go".into(), "run".into(), ep.into()],
        }),
        "php" => Some(Runtime {
            default_entrypoint: "index.php",
            compile_args: None,
            run_args: |ep, _| vec!["php".into(), ep.into()],
        }),
        "ruby" => Some(Runtime {
            default_entrypoint: "index.rb",
            compile_args: None,
            run_args: |ep, _| vec!["ruby".into(), ep.into()],
        }),
        "lua" => Some(Runtime {
            default_entrypoint: "index.lua",
            compile_args: None,
            run_args: |ep, _| vec!["lua".into(), ep.into()],
        }),
        "python" => Some(Runtime {
            default_entrypoint: "index.py",
            compile_args: None,
            run_args: |ep, _| vec!["python3".into(), ep.into()],
        }),
        "c" => Some(Runtime {
            default_entrypoint: "main.c",
            compile_args: Some(|ep, out| vec!["gcc".into(), ep.into(), "-o".into(), out.into()]),
            run_args: |_, out| vec![out.into()],
        }),
        _ => None,
    }
}
