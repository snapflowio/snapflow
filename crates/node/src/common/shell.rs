// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::fs;
use std::path::Path;

pub fn get_shell() -> String {
    if let Ok(shell) = std::env::var("SHELL")
        && !shell.is_empty()
    {
        return shell;
    }

    if let Ok(contents) = fs::read_to_string("/etc/shells") {
        let preferred = ["/usr/bin/zsh", "/bin/zsh", "/usr/bin/bash", "/bin/bash"];

        let available: std::collections::HashSet<&str> = contents
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty() && !line.starts_with('#'))
            .collect();

        for shell in &preferred {
            if available.contains(shell) && Path::new(shell).exists() {
                return shell.to_string();
            }
        }
    }

    "/bin/sh".to_string()
}
