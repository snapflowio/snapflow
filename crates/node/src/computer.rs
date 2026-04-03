// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

pub mod display;
pub mod keyboard;
pub mod mouse;
pub mod routes;
pub mod screenshot;

use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::AsyncReadExt;
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use utoipa::ToSchema;

pub const REQUIRED_TOOLS: &[(&str, &str)] = &[
    ("xdotool", "xdotool"),
    ("scrot", "scrot"),
    ("xdpyinfo", "x11-utils"),
    ("Xvnc", "kasmvncserver"),
    ("startxfce4", "xfce4"),
    ("dbus-launch", "dbus-x11"),
];

#[derive(Clone, serde::Serialize)]
pub struct ComputerError {
    pub error_type: String,
    pub message: String,
    pub details: String,
    pub solution: Option<ComputerSolution>,
}

#[derive(Clone, serde::Serialize)]
pub struct ComputerSolution {
    pub ubuntu: String,
    pub fedora: String,
    pub alpine: String,
}

pub fn check_availability() -> bool {
    match detect_error() {
        Some(err) => {
            tracing::warn!("{}", err.message);
            tracing::info!("{}", err.details);
            tracing::info!("Continuing without computer functionality...");
            false
        }
        None => true,
    }
}

pub fn detect_error() -> Option<ComputerError> {
    let missing = get_missing_tools();
    if !missing.is_empty() {
        let missing_packages: Vec<&str> = REQUIRED_TOOLS
            .iter()
            .filter(|(tool, _)| !tool_exists(tool))
            .map(|(_, pkg)| *pkg)
            .collect();

        return Some(ComputerError {
            error_type: "dependency".into(),
            message: format!(
                "Computer features require tools that are not available (missing: {})",
                missing.join(", ")
            ),
            details: format!(
                "The following tools are required for screen capture, mouse/keyboard control, \
                 and display management: {}.\n\n\
                 Note: Computer features will be disabled until dependencies are installed.",
                missing.join(", ")
            ),
            solution: Some(ComputerSolution {
                ubuntu: format!(
                    "sudo apt-get update && sudo apt-get install -y {}",
                    missing_packages.join(" ")
                ),
                fedora: format!("sudo dnf install -y {}", missing_packages.join(" ")),
                alpine: format!("apk add --no-cache {}", missing_packages.join(" ")),
            }),
        });
    }

    None
}

pub fn get_missing_tools() -> Vec<String> {
    REQUIRED_TOOLS
        .iter()
        .filter(|(tool, _)| !tool_exists(tool))
        .map(|(tool, _)| tool.to_string())
        .collect()
}

fn tool_exists(name: &str) -> bool {
    std::process::Command::new("which")
        .arg(name)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[derive(Clone, Serialize, ToSchema)]
pub struct ProcessStatus {
    pub running: bool,
    pub priority: i32,
    pub auto_restart: bool,
    pub pid: Option<u32>,
}

pub struct ComputerManager {
    processes: Mutex<HashMap<String, ManagedProcess>>,
    display: String,
}

struct ManagedProcess {
    child: Option<Child>,
    cmd: String,
    args: Vec<String>,
    env: HashMap<String, String>,
    priority: i32,
    auto_restart: bool,
    stdout_log: Arc<Mutex<String>>,
    stderr_log: Arc<Mutex<String>>,
}

const MAX_LOG_BYTES: usize = 1024 * 1024;

fn truncate_log_front(log: &mut String) {
    if log.len() > MAX_LOG_BYTES {
        let drain = log.len() - MAX_LOG_BYTES;
        let boundary = log.ceil_char_boundary(drain);
        log.drain(..boundary);
    }
}

impl ComputerManager {
    pub fn default() -> Self {
        let display = std::env::var("DISPLAY").unwrap_or_else(|_| ":1".into());
        Self {
            processes: Mutex::new(HashMap::default()),
            display,
        }
    }

    pub fn display(&self) -> &str {
        &self.display
    }

    pub async fn start(&self) -> anyhow::Result<()> {
        let display = &self.display;
        let display_num = display.trim_start_matches(':');

        let _ = tokio::fs::remove_file(format!("/tmp/.X{display_num}-lock")).await;
        let _ = tokio::fs::remove_file(format!("/tmp/.X11-unix/X{display_num}")).await;

        let mut dbus_env = HashMap::new();
        if let Ok(output) = tokio::process::Command::new("dbus-launch").output().await {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if let Some(kv) = line.split(';').next()
                    && let Some((key, val)) = kv.split_once('=')
                {
                    let key = key.trim();
                    if key == "DBUS_SESSION_BUS_ADDRESS" || key == "DBUS_SESSION_BUS_PID" {
                        dbus_env.insert(key.to_string(), val.trim().to_string());
                    }
                }
            }
        }

        let resolution = std::env::var("VNC_RESOLUTION").unwrap_or_else(|_| "1024x768".into());
        let novnc_port = std::env::var("NO_VNC_PORT").unwrap_or_else(|_| "6080".into());
        let home = std::env::var("HOME").unwrap_or_else(|_| "/root".into());
        let user = std::env::var("SNAPFLOW_SANDBOX_USER").unwrap_or_else(|_| "root".into());

        let _ = tokio::fs::create_dir_all(format!("{home}/.vnc")).await;

        let mut vnc_env = HashMap::default();
        vnc_env.insert("DISPLAY".into(), display.clone());
        vnc_env.insert("HOME".into(), home.clone());

        self.start_process(
            "kasmvnc",
            "/usr/bin/Xvnc",
            &[
                display,
                "+extension",
                "XINERAMA",
                "-SecurityTypes",
                "None",
                "-disableBasicAuth",
                "-depth",
                "24",
                "-geometry",
                &resolution,
                "-websocketPort",
                &novnc_port,
                "-httpd",
                "/usr/share/kasmvnc/www",
                "-interface",
                "127.0.0.1",
                "-useipv6=false",
            ],
            vnc_env,
            100,
            true,
        )
        .await?;

        tokio::time::sleep(std::time::Duration::from_secs(1)).await;

        let mut xfce_env = HashMap::default();
        xfce_env.insert("DISPLAY".into(), display.clone());
        xfce_env.insert("HOME".into(), home.clone());
        xfce_env.insert("USER".into(), user);
        xfce_env.extend(dbus_env);

        self.start_process("xfce4", "/usr/bin/startxfce4", &[], xfce_env, 200, true)
            .await?;

        Ok(())
    }

    pub async fn stop(&self) -> anyhow::Result<()> {
        let mut processes = self.processes.lock().await;
        for (_, proc) in processes.iter_mut() {
            if let Some(child) = proc.child.as_mut() {
                let _ = child.kill().await;
            }
            proc.child = None;
        }
        Ok(())
    }

    async fn start_process(
        &self,
        name: &str,
        cmd: &str,
        args: &[&str],
        env: HashMap<String, String>,
        priority: i32,
        auto_restart: bool,
    ) -> anyhow::Result<()> {
        let stdout_log = Arc::new(Mutex::new(String::default()));
        let stderr_log = Arc::new(Mutex::new(String::default()));

        let mut child = Command::new(cmd)
            .args(args)
            .envs(&env)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()?;

        if let Some(stdout) = child.stdout.take() {
            let log = Arc::clone(&stdout_log);
            tokio::spawn(async move {
                let mut reader = stdout;
                let mut buf = [0u8; 4096];
                loop {
                    match reader.read(&mut buf).await {
                        Ok(0) | Err(_) => break,
                        Ok(n) => {
                            let mut l = log.lock().await;
                            l.push_str(&String::from_utf8_lossy(&buf[..n]));
                            truncate_log_front(&mut l);
                        }
                    }
                }
            });
        }

        if let Some(stderr) = child.stderr.take() {
            let log = Arc::clone(&stderr_log);
            tokio::spawn(async move {
                let mut reader = stderr;
                let mut buf = [0u8; 4096];
                loop {
                    match reader.read(&mut buf).await {
                        Ok(0) | Err(_) => break,
                        Ok(n) => {
                            let mut l = log.lock().await;
                            l.push_str(&String::from_utf8_lossy(&buf[..n]));
                            truncate_log_front(&mut l);
                        }
                    }
                }
            });
        }

        let mut processes = self.processes.lock().await;
        processes.insert(
            name.to_string(),
            ManagedProcess {
                child: Some(child),
                cmd: cmd.to_string(),
                args: args.iter().map(|s| s.to_string()).collect(),
                env,
                priority,
                auto_restart,
                stdout_log,
                stderr_log,
            },
        );

        Ok(())
    }

    pub async fn get_process_status(&self) -> HashMap<String, ProcessStatus> {
        let processes = self.processes.lock().await;
        let mut status = HashMap::default();
        for (name, proc) in processes.iter() {
            let running = proc
                .child
                .as_ref()
                .map(|c| c.id().is_some())
                .unwrap_or(false);
            status.insert(
                name.clone(),
                ProcessStatus {
                    running,
                    priority: proc.priority,
                    auto_restart: proc.auto_restart,
                    pid: proc.child.as_ref().and_then(|c| c.id()),
                },
            );
        }
        status
    }

    pub async fn is_process_running(&self, name: &str) -> Option<bool> {
        let processes = self.processes.lock().await;
        processes
            .get(name)
            .map(|p| p.child.as_ref().map(|c| c.id().is_some()).unwrap_or(false))
    }

    pub async fn restart_process(&self, name: &str) -> anyhow::Result<()> {
        let mut processes = self.processes.lock().await;
        if let Some(proc) = processes.get_mut(name) {
            if let Some(child) = proc.child.as_mut() {
                let _ = child.kill().await;
            }
            let arg_refs: Vec<&str> = proc.args.iter().map(String::as_str).collect();
            let new_child = Command::new(&proc.cmd)
                .args(&arg_refs)
                .envs(&proc.env)
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()?;
            *proc.stdout_log.lock().await = String::default();
            *proc.stderr_log.lock().await = String::default();
            proc.child = Some(new_child);
        }
        Ok(())
    }

    pub async fn get_process_logs(&self, name: &str) -> Option<String> {
        let processes = self.processes.lock().await;
        let proc = processes.get(name)?;
        Some(proc.stdout_log.lock().await.clone())
    }

    pub async fn get_process_errors(&self, name: &str) -> Option<String> {
        let processes = self.processes.lock().await;
        let proc = processes.get(name)?;
        Some(proc.stderr_log.lock().await.clone())
    }

    pub async fn get_overall_status(&self) -> &'static str {
        let statuses = self.get_process_status().await;
        if statuses.is_empty() {
            return "inactive";
        }
        let running_count = statuses.values().filter(|s| s.running).count();
        if running_count == statuses.len() {
            "active"
        } else if running_count > 0 {
            "partial"
        } else {
            "inactive"
        }
    }
}
