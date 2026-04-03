// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use crate::common::shell::get_shell;
use async_trait::async_trait;
use nix::sys::signal::Signal;
use portable_pty::{CommandBuilder, MasterPty, NativePtySystem, PtySize, PtySystem};
use russh::server::{Auth, Handler, Msg, Server, Session};
use russh::{Channel, ChannelId, CryptoVec, Pty, Sig};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::Command;
use tokio::sync::Mutex;

pub struct SshServer {
    pub project_dir: String,
    pub default_project_dir: String,
    pub auth_token: String,
}

impl Server for SshServer {
    type Handler = SshSessionHandler;

    fn new_client(&mut self, _peer_addr: Option<std::net::SocketAddr>) -> Self::Handler {
        SshSessionHandler {
            project_dir: self.project_dir.clone(),
            default_project_dir: self.default_project_dir.clone(),
            auth_token: self.auth_token.clone(),
            channels: Arc::new(Mutex::new(HashMap::default())),
            streamlocal: Arc::new(super::forward::StreamlocalForwarder::default()),
            agent_socket_path: None,
        }
    }
}

struct ChannelState {
    pty: Option<PtyInfo>,
    pid: Option<u32>,
    pty_writer: Option<Box<dyn std::io::Write + Send>>,
    pty_master: Option<Arc<Mutex<Box<dyn MasterPty + Send>>>>,
    child: Option<Arc<Mutex<Box<dyn portable_pty::Child + Send>>>>,
    stdin: Option<Arc<Mutex<tokio::process::ChildStdin>>>,
    sftp_writer: Option<Arc<Mutex<tokio::io::WriteHalf<tokio::io::DuplexStream>>>>,
}

struct PtyInfo {
    term: String,
    col_width: u32,
    row_height: u32,
}

pub struct SshSessionHandler {
    project_dir: String,
    default_project_dir: String,
    auth_token: String,
    channels: Arc<Mutex<HashMap<ChannelId, ChannelState>>>,
    streamlocal: Arc<super::forward::StreamlocalForwarder>,
    agent_socket_path: Option<String>,
}

impl SshSessionHandler {
    fn working_dir(&self) -> String {
        if std::path::Path::new(&self.project_dir).exists() {
            self.project_dir.clone()
        } else {
            self.default_project_dir.clone()
        }
    }
}

fn ssh_signal_to_nix(sig: Sig) -> Signal {
    match sig {
        Sig::ABRT => Signal::SIGABRT,
        Sig::ALRM => Signal::SIGALRM,
        Sig::FPE => Signal::SIGFPE,
        Sig::HUP => Signal::SIGHUP,
        Sig::ILL => Signal::SIGILL,
        Sig::INT => Signal::SIGINT,
        Sig::KILL => Signal::SIGKILL,
        Sig::PIPE => Signal::SIGPIPE,
        Sig::QUIT => Signal::SIGQUIT,
        Sig::SEGV => Signal::SIGSEGV,
        Sig::TERM => Signal::SIGTERM,
        Sig::USR1 => Signal::SIGUSR1,
        _ => Signal::SIGKILL,
    }
}

#[async_trait]
impl Handler for SshSessionHandler {
    type Error = anyhow::Error;

    async fn auth_none(&mut self, _user: &str) -> Result<Auth, Self::Error> {
        if self.auth_token.is_empty() {
            Ok(Auth::Accept)
        } else {
            Ok(Auth::Reject {
                proceed_with_methods: Some(
                    russh::MethodSet::PASSWORD | russh::MethodSet::PUBLICKEY,
                ),
            })
        }
    }

    async fn auth_password(&mut self, _user: &str, password: &str) -> Result<Auth, Self::Error> {
        if self.auth_token.is_empty() || password == self.auth_token {
            Ok(Auth::Accept)
        } else {
            Ok(Auth::Reject {
                proceed_with_methods: None,
            })
        }
    }

    async fn auth_publickey(
        &mut self,
        _user: &str,
        _public_key: &russh_keys::PublicKey,
    ) -> Result<Auth, Self::Error> {
        if self.auth_token.is_empty() {
            Ok(Auth::Accept)
        } else {
            Ok(Auth::Reject {
                proceed_with_methods: Some(russh::MethodSet::PASSWORD),
            })
        }
    }

    async fn channel_open_session(
        &mut self,
        channel: Channel<Msg>,
        _session: &mut Session,
    ) -> Result<bool, Self::Error> {
        let mut channels = self.channels.lock().await;
        channels.insert(
            channel.id(),
            ChannelState {
                pty: None,
                pid: None,
                pty_writer: None,
                pty_master: None,
                child: None,
                stdin: None,
                sftp_writer: None,
            },
        );
        Ok(true)
    }

    async fn channel_open_direct_tcpip(
        &mut self,
        channel: Channel<Msg>,
        host_to_connect: &str,
        port_to_connect: u32,
        _originator_address: &str,
        _originator_port: u32,
        session: &mut Session,
    ) -> Result<bool, Self::Error> {
        let host = host_to_connect.to_string();
        let port = port_to_connect as u16;
        let handle = session.handle();
        let channel_id = channel.id();

        tokio::spawn(async move {
            match tokio::net::TcpStream::connect(format!("{host}:{port}")).await {
                Ok(stream) => {
                    let (mut tcp_read, mut tcp_write) = stream.into_split();

                    let h = handle.clone();
                    let tcp_to_ssh = tokio::spawn(async move {
                        let mut buf = [0u8; 8192];
                        loop {
                            match tcp_read.read(&mut buf).await {
                                Ok(0) | Err(_) => break,
                                Ok(n) => {
                                    let _ =
                                        h.data(channel_id, CryptoVec::from_slice(&buf[..n])).await;
                                }
                            }
                        }
                    });

                    let mut channel_reader = channel.into_stream();
                    let ssh_to_tcp = tokio::spawn(async move {
                        let mut buf = [0u8; 8192];
                        loop {
                            match channel_reader.read(&mut buf).await {
                                Ok(0) | Err(_) => break,
                                Ok(n) => {
                                    if tcp_write.write_all(&buf[..n]).await.is_err() {
                                        break;
                                    }
                                }
                            }
                        }
                    });

                    let _ = tokio::join!(tcp_to_ssh, ssh_to_tcp);
                    let _ = handle.close(channel_id).await;
                }
                Err(e) => {
                    tracing::error!(error = %e, "direct-tcpip connection failed");
                    let _ = handle.close(channel_id).await;
                }
            }
        });

        Ok(true)
    }

    async fn tcpip_forward(
        &mut self,
        _address: &str,
        _port: &mut u32,
        _session: &mut Session,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }

    async fn cancel_tcpip_forward(
        &mut self,
        _address: &str,
        _port: u32,
        _session: &mut Session,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }

    async fn pty_request(
        &mut self,
        channel: ChannelId,
        term: &str,
        col_width: u32,
        row_height: u32,
        _pix_width: u32,
        _pix_height: u32,
        _modes: &[(Pty, u32)],
        session: &mut Session,
    ) -> Result<(), Self::Error> {
        let mut channels = self.channels.lock().await;
        if let Some(state) = channels.get_mut(&channel) {
            state.pty = Some(PtyInfo {
                term: term.to_string(),
                col_width,
                row_height,
            });
        }
        let _ = session.channel_success(channel);
        Ok(())
    }

    async fn shell_request(
        &mut self,
        channel: ChannelId,
        session: &mut Session,
    ) -> Result<(), Self::Error> {
        let _ = session.channel_success(channel);

        let channels_lock = self.channels.lock().await;
        let state = channels_lock.get(&channel);
        let has_pty = state.map(|s| s.pty.is_some()).unwrap_or(false);
        let dir = self.working_dir();

        if has_pty {
            let pty_info = state.and_then(|s| s.pty.as_ref());
            let term = pty_info
                .map(|p| p.term.clone())
                .unwrap_or_else(|| "xterm-256color".to_string());
            let cols = pty_info.map(|p| p.col_width as u16).unwrap_or(80);
            let rows = pty_info.map(|p| p.row_height as u16).unwrap_or(24);
            let handle = session.handle();
            let channels = Arc::clone(&self.channels);
            let agent_sock = self.agent_socket_path.clone();
            drop(channels_lock);

            tokio::spawn(async move {
                if let Err(e) = run_pty_shell(
                    channel, &dir, &term, cols, rows, handle, channels, agent_sock,
                )
                .await
                {
                    tracing::debug!(error = %e, "PTY session ended");
                }
            });
        } else {
            let handle = session.handle();
            let ch = Arc::clone(&self.channels);
            let agent_sock = self.agent_socket_path.clone();
            drop(channels_lock);

            tokio::spawn(async move {
                if let Err(e) = run_exec(channel, &dir, None, handle, ch, agent_sock).await {
                    tracing::error!(error = %e, "shell session failed");
                }
            });
        }

        Ok(())
    }

    async fn exec_request(
        &mut self,
        channel: ChannelId,
        data: &[u8],
        session: &mut Session,
    ) -> Result<(), Self::Error> {
        let _ = session.channel_success(channel);
        let command = String::from_utf8_lossy(data).to_string();
        let dir = self.working_dir();
        let handle = session.handle();
        let channels = Arc::clone(&self.channels);
        let agent_sock = self.agent_socket_path.clone();

        tokio::spawn(async move {
            if let Err(e) =
                run_exec(channel, &dir, Some(&command), handle, channels, agent_sock).await
            {
                tracing::error!(error = %e, "exec request failed");
            }
        });

        Ok(())
    }

    async fn subsystem_request(
        &mut self,
        channel: ChannelId,
        name: &str,
        session: &mut Session,
    ) -> Result<(), Self::Error> {
        if name == "sftp" {
            let _ = session.channel_success(channel);
            let handle = session.handle();
            let channels = Arc::clone(&self.channels);
            tokio::spawn(async move {
                if let Err(e) = run_sftp(channel, handle, channels).await {
                    tracing::error!(error = %e, "SFTP session error");
                }
            });
        } else {
            tracing::error!(subsystem = name, "unsupported subsystem");
            let _ = session.channel_failure(channel);
        }
        Ok(())
    }

    async fn signal(
        &mut self,
        channel: ChannelId,
        signal: Sig,
        _session: &mut Session,
    ) -> Result<(), Self::Error> {
        let os_sig = ssh_signal_to_nix(signal);
        tracing::debug!(?os_sig, "received SSH signal");

        let channels = self.channels.lock().await;
        if let Some(state) = channels.get(&channel)
            && let Some(pid) = state.pid
        {
            let _ = nix::sys::signal::kill(nix::unistd::Pid::from_raw(pid as i32), os_sig);
        }
        Ok(())
    }

    async fn window_change_request(
        &mut self,
        channel: ChannelId,
        col_width: u32,
        row_height: u32,
        _pix_width: u32,
        _pix_height: u32,
        session: &mut Session,
    ) -> Result<(), Self::Error> {
        let mut channels = self.channels.lock().await;
        if let Some(state) = channels.get_mut(&channel) {
            if let Some(pty) = &mut state.pty {
                pty.col_width = col_width;
                pty.row_height = row_height;
            }
            if let Some(master) = &state.pty_master {
                let master = master.lock().await;
                let _ = master.resize(PtySize {
                    rows: row_height as u16,
                    cols: col_width as u16,
                    pixel_width: 0,
                    pixel_height: 0,
                });
            }
        }
        let _ = session.channel_success(channel);
        Ok(())
    }

    async fn agent_request(
        &mut self,
        channel: ChannelId,
        session: &mut Session,
    ) -> Result<bool, Self::Error> {
        let socket_dir = format!("/tmp/ssh-agent-{}", std::process::id());
        let _ = tokio::fs::create_dir_all(&socket_dir).await;
        let socket_path = format!("{socket_dir}/agent.{channel}");
        let _ = tokio::fs::remove_file(&socket_path).await;

        match tokio::net::UnixListener::bind(&socket_path) {
            Ok(listener) => {
                self.agent_socket_path = Some(socket_path.clone());
                let handle = session.handle();

                tokio::spawn(async move {
                    loop {
                        match listener.accept().await {
                            Ok((unix_stream, _)) => {
                                let h = handle.clone();
                                tokio::spawn(async move {
                                    match h.channel_open_agent().await {
                                        Ok(agent_channel) => {
                                            let agent_id: russh::ChannelId = agent_channel.id();
                                            let (mut unix_read, mut unix_write) =
                                                unix_stream.into_split();

                                            let h2 = h.clone();
                                            let to_ssh = tokio::spawn(async move {
                                                let mut buf = [0u8; 8192];
                                                loop {
                                                    match unix_read.read(&mut buf).await {
                                                        Ok(0) | Err(_) => break,
                                                        Ok(n) => {
                                                            let _ = h2
                                                                .data(
                                                                    agent_id,
                                                                    CryptoVec::from_slice(
                                                                        &buf[..n],
                                                                    ),
                                                                )
                                                                .await;
                                                        }
                                                    }
                                                }
                                            });

                                            let mut ch_reader = agent_channel.into_stream();
                                            let from_ssh = tokio::spawn(async move {
                                                let mut buf = [0u8; 8192];
                                                loop {
                                                    match ch_reader.read(&mut buf).await {
                                                        Ok(0) | Err(_) => break,
                                                        Ok(n) => {
                                                            if unix_write
                                                                .write_all(&buf[..n])
                                                                .await
                                                                .is_err()
                                                            {
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                            });

                                            let _ = tokio::join!(to_ssh, from_ssh);
                                            let _ = h.close(agent_id).await;
                                        }
                                        Err(e) => {
                                            tracing::warn!(
                                                error = %e,
                                                "failed to open auth agent channel"
                                            );
                                        }
                                    }
                                });
                            }
                            Err(_) => break,
                        }
                    }
                });

                let _ = session.channel_success(channel);
                Ok(true)
            }
            Err(e) => {
                tracing::error!(error = %e, "failed to bind agent socket");
                let _ = session.channel_failure(channel);
                Ok(false)
            }
        }
    }

    async fn streamlocal_forward(
        &mut self,
        socket_path: &str,
        session: &mut Session,
    ) -> Result<bool, Self::Error> {
        let handle = session.handle();
        self.streamlocal
            .start(socket_path, handle)
            .await
            .map_err(|e| {
                tracing::error!(error = %e, "streamlocal forward failed");
                anyhow::anyhow!(e)
            })?;
        Ok(true)
    }

    async fn cancel_streamlocal_forward(
        &mut self,
        socket_path: &str,
        _session: &mut Session,
    ) -> Result<bool, Self::Error> {
        self.streamlocal.cancel(socket_path).await;
        Ok(true)
    }

    async fn data(
        &mut self,
        channel: ChannelId,
        data: &[u8],
        _session: &mut Session,
    ) -> Result<(), Self::Error> {
        let mut channels = self.channels.lock().await;
        if let Some(state) = channels.get_mut(&channel) {
            if let Some(writer) = &mut state.pty_writer {
                let _ = std::io::Write::write_all(writer, data);
            } else if let Some(sftp_writer) = &state.sftp_writer {
                let data = data.to_vec();
                let writer = Arc::clone(sftp_writer);
                tokio::spawn(async move {
                    let mut w = writer.lock().await;
                    let _ = w.write_all(&data).await;
                });
            } else if let Some(stdin) = &state.stdin {
                let data = data.to_vec();
                let stdin = Arc::clone(stdin);
                tokio::spawn(async move {
                    let mut stdin = stdin.lock().await;
                    let _ = stdin.write_all(&data).await;
                });
            }
        }
        Ok(())
    }
}

async fn run_pty_shell(
    channel: ChannelId,
    dir: &str,
    term: &str,
    cols: u16,
    rows: u16,
    handle: russh::server::Handle,
    channels: Arc<Mutex<HashMap<ChannelId, ChannelState>>>,
    agent_socket_path: Option<String>,
) -> anyhow::Result<()> {
    let pty_system = NativePtySystem::default();
    let pair = pty_system.openpty(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    })?;

    let shell = get_shell();
    let mut cmd = CommandBuilder::new(&shell);
    cmd.env("TERM", term);
    cmd.env("SHELL", &shell);
    cmd.cwd(dir);
    for (k, v) in std::env::vars() {
        cmd.env(k, v);
    }
    if let Some(ref sock) = agent_socket_path {
        cmd.env("SSH_AUTH_SOCK", sock);
    }

    let child = pair.slave.spawn_command(cmd)?;
    drop(pair.slave);

    let writer = pair.master.take_writer()?;
    let mut reader = pair.master.try_clone_reader()?;

    {
        let mut ch = channels.lock().await;
        if let Some(state) = ch.get_mut(&channel) {
            state.pty_writer = Some(writer);
            state.pty_master = Some(Arc::new(Mutex::new(pair.master)));
            state.child = Some(Arc::new(Mutex::new(child)));
        }
    }

    let h = handle.clone();
    let reader_task = tokio::task::spawn_blocking(move || {
        let rt = tokio::runtime::Handle::current();
        let mut buf = [0u8; 4096];
        loop {
            match std::io::Read::read(&mut reader, &mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = CryptoVec::from_slice(&buf[..n]);
                    let h = h.clone();
                    rt.spawn(async move {
                        let _ = h.data(channel, data).await;
                    });
                }
                Err(_) => break,
            }
        }
    });

    reader_task.await?;

    {
        let mut ch = channels.lock().await;
        if let Some(state) = ch.get_mut(&channel) {
            if let Some(child) = state.child.take() {
                let mut child = child.lock().await;
                let _ = child.kill();
                let _ = child.wait();
            }
            state.pty_writer = None;
            state.pty_master = None;
        }
    }

    let _ = handle.close(channel).await;
    Ok(())
}

async fn run_exec(
    channel: ChannelId,
    dir: &str,
    command: Option<&str>,
    handle: russh::server::Handle,
    channels: Arc<Mutex<HashMap<ChannelId, ChannelState>>>,
    agent_socket_path: Option<String>,
) -> anyhow::Result<()> {
    let mut cmd = if let Some(raw) = command {
        let mut c = Command::new("/bin/sh");
        c.arg("-c").arg(raw);
        c
    } else {
        Command::new(get_shell())
    };

    cmd.current_dir(dir);
    cmd.envs(std::env::vars());
    if let Some(ref sock) = agent_socket_path {
        cmd.env("SSH_AUTH_SOCK", sock);
    }
    cmd.stdin(std::process::Stdio::piped());
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn()?;

    if let Some(pid) = child.id() {
        let mut ch = channels.lock().await;
        if let Some(state) = ch.get_mut(&channel) {
            state.pid = Some(pid);
        }
    }

    let child_stdin = child.stdin.take();
    if let Some(stdin) = child_stdin {
        let stdin_arc = Arc::new(Mutex::new(stdin));
        let mut ch = channels.lock().await;
        if let Some(state) = ch.get_mut(&channel) {
            state.stdin = Some(stdin_arc);
        }
    }

    let Some(mut stdout) = child.stdout.take() else {
        return Ok(());
    };
    let Some(mut stderr) = child.stderr.take() else {
        return Ok(());
    };

    let h1 = handle.clone();
    let stdout_task = tokio::spawn(async move {
        let mut buf = [0u8; 4096];
        loop {
            match stdout.read(&mut buf).await {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let _ = h1.data(channel, CryptoVec::from_slice(&buf[..n])).await;
                }
            }
        }
    });

    let h2 = handle.clone();
    let stderr_task = tokio::spawn(async move {
        let mut buf = [0u8; 4096];
        loop {
            match stderr.read(&mut buf).await {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let _ = h2
                        .extended_data(channel, 1, CryptoVec::from_slice(&buf[..n]))
                        .await;
                }
            }
        }
    });

    let status = child.wait().await?;
    stdout_task.await?;
    stderr_task.await?;

    {
        let mut ch = channels.lock().await;
        if let Some(state) = ch.get_mut(&channel) {
            state.stdin = None;
            state.pid = None;
        }
    }

    let exit_code = status.code().unwrap_or(127) as u32;
    let _ = handle.exit_status_request(channel, exit_code).await;
    let _ = handle.close(channel).await;
    Ok(())
}

async fn run_sftp(
    channel: ChannelId,
    handle: russh::server::Handle,
    channels: Arc<Mutex<HashMap<ChannelId, ChannelState>>>,
) -> anyhow::Result<()> {
    let (sftp_stream, bridge_stream) = tokio::io::duplex(64 * 1024);
    let (mut bridge_read, bridge_write) = tokio::io::split(bridge_stream);

    let write_half = Arc::new(Mutex::new(bridge_write));

    {
        let mut ch = channels.lock().await;
        if let Some(state) = ch.get_mut(&channel) {
            state.sftp_writer = Some(Arc::clone(&write_half));
        }
    }

    let sftp_task = tokio::spawn(async move {
        let handler = super::sftp::SftpHandler::default();
        russh_sftp::server::run(sftp_stream, handler).await;
    });

    let h = handle.clone();
    let bridge_task = tokio::spawn(async move {
        let mut buf = [0u8; 64 * 1024];
        loop {
            match bridge_read.read(&mut buf).await {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let _ = h.data(channel, CryptoVec::from_slice(&buf[..n])).await;
                }
            }
        }
    });

    sftp_task.await?;
    bridge_task.abort();

    {
        let mut ch = channels.lock().await;
        if let Some(state) = ch.get_mut(&channel) {
            state.sftp_writer = None;
        }
    }

    let _ = handle.close(channel).await;
    Ok(())
}
