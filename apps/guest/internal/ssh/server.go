// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package ssh

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net"
	"os"
	"os/exec"
	"strconv"
	"time"

	"github.com/gliderlabs/ssh"
	"github.com/pkg/sftp"
	"github.com/snapflowio/common-go/pkg/guestspec"
	"github.com/snapflowio/guest/internal/childreap"
	"github.com/snapflowio/guest/internal/common"
	"github.com/snapflowio/guest/internal/credentials"
	"golang.org/x/sys/unix"
)

const (
	genericFailureExitStatus = 1
	listenNetwork            = "tcp"
	sftpSubsystem            = "sftp"
	commandShell             = "/bin/sh"
	commandFlag              = "-c"
	agentSocketEnvironment   = "SSH_AUTH_SOCK"
	shutdownTimeout          = 5 * time.Second
)

type Config struct {
	WorkDir       string
	AuthTokenFile string
	BindAddress   string
}

type Dependencies struct {
	Logger *slog.Logger
	Reaper *childreap.Reaper
}

type Server struct {
	cfg    Config
	logger *slog.Logger
	reaper *childreap.Reaper
}

func New(cfg Config, deps Dependencies) *Server {
	return &Server{cfg: cfg, logger: deps.Logger.With(slog.String("component", "ssh_server")), reaper: deps.Reaper}
}

func (s *Server) Run(ctx context.Context) error {
	if _, err := credentials.ReadFile(s.cfg.AuthTokenFile); err != nil {
		return fmt.Errorf("read SSH service credential: %w", err)
	}
	address := net.JoinHostPort(s.cfg.BindAddress, strconv.Itoa(guestspec.SSHPort))
	listener, err := new(net.ListenConfig).Listen(ctx, listenNetwork, address)
	if err != nil {
		return fmt.Errorf("listen on SSH address %s: %w", address, err)
	}
	server := s.newServer()
	s.logger.Info("Starting ssh server", "address", address)
	served := make(chan error, 1)
	go func() { served <- server.Serve(listener) }()
	select {
	case err := <-served:
		return ignoreClosed(err)
	case <-ctx.Done():
	}
	shutdownContext, cancel := context.WithTimeout(context.WithoutCancel(ctx), shutdownTimeout)
	defer cancel()
	shutdownErr := server.Shutdown(shutdownContext)
	if errors.Is(shutdownErr, context.DeadlineExceeded) {
		shutdownErr = server.Close()
	}
	return errors.Join(shutdownErr, ignoreClosed(<-served))
}

func ignoreClosed(err error) error {
	if errors.Is(err, ssh.ErrServerClosed) {
		return nil
	}
	return err
}

func (s *Server) newServer() *ssh.Server {
	forwardedTCPHandler := &ssh.ForwardedTCPHandler{}
	unixForwardHandler := newForwardedUnixHandler(s.logger)
	return &ssh.Server{
		PasswordHandler: s.authenticate,
		Handler:         s.handleSession,
		ChannelHandlers: map[string]ssh.ChannelHandler{
			"session":                ssh.DefaultSessionHandler,
			"direct-tcpip":           ssh.DirectTCPIPHandler,
			directStreamLocalChannel: unixForwardHandler.handleDirect,
		},
		RequestHandlers: map[string]ssh.RequestHandler{
			"tcpip-forward":                 forwardedTCPHandler.HandleSSHRequest,
			"cancel-tcpip-forward":          forwardedTCPHandler.HandleSSHRequest,
			streamLocalForwardRequest:       unixForwardHandler.HandleSSHRequest,
			cancelStreamLocalForwardRequest: unixForwardHandler.HandleSSHRequest,
		},
		SubsystemHandlers: map[string]ssh.SubsystemHandler{
			sftpSubsystem: s.sftpHandler,
		},
		LocalPortForwardingCallback: func(ssh.Context, string, uint32) bool {
			return true
		},
		ReversePortForwardingCallback: func(ssh.Context, string, uint32) bool {
			return true
		},
		SessionRequestCallback: func(ssh.Session, string) bool {
			return true
		},
	}
}

func (s *Server) authenticate(ctx ssh.Context, password string) bool {
	authenticated, err := credentials.MatchesFile(s.cfg.AuthTokenFile, []byte(password))
	if err != nil {
		s.logger.Error("Failed to read SSH service credential", "error", err)
		return false
	}
	s.logger.Debug("Password authentication finished", "user", ctx.User(), "authenticated", authenticated)
	return authenticated
}

func (s *Server) handleSession(session ssh.Session) {
	switch subsystem := session.Subsystem(); subsystem {
	case "":
	case sftpSubsystem:
		s.sftpHandler(session)
		return
	default:
		s.logger.Error("Subsystem not supported", "subsystem", subsystem)
		s.reportExit(session, genericFailureExitStatus)
		return
	}
	ptyRequest, windows, isPty := session.Pty()
	if session.RawCommand() == "" && isPty {
		s.handlePty(session, ptyRequest, windows)
		return
	}
	s.handleNonPty(session)
}

func (s *Server) agentEnvironment(session ssh.Session) ([]string, func(), error) {
	if !ssh.AgentRequested(session) {
		return nil, func() {}, nil
	}
	listener, err := ssh.NewAgentListener()
	if err != nil {
		return nil, nil, fmt.Errorf("start agent listener: %w", err)
	}
	go ssh.ForwardAgentConnections(listener, session)
	closeListener := func() {
		if err := listener.Close(); err != nil {
			s.logger.Debug("Failed to close agent listener", "error", err)
		}
	}
	return []string{agentSocketEnvironment + "=" + listener.Addr().String()}, closeListener, nil
}

func (s *Server) handlePty(session ssh.Session, ptyRequest ssh.Pty, windows <-chan ssh.Window) {
	env, closeAgent, err := s.agentEnvironment(session)
	if err != nil {
		s.logger.Error("Failed to forward the SSH agent", "error", err)
		return
	}
	defer closeAgent()

	ctx := session.Context()
	sizes := make(chan common.TTYSize)
	go forwardWindowSizes(ctx, windows, sizes)
	exitCode, err := common.SpawnTTY(ctx, s.reaper, common.SpawnTTYOptions{
		Dir:    s.cfg.WorkDir,
		StdIn:  session,
		StdOut: session,
		Term:   ptyRequest.Term,
		Env:    env,
		SizeCh: sizes,
	})
	if err != nil {
		s.logger.Error("Interactive shell failed", "exitCode", exitCode, "error", err)
	}
	s.reportExit(session, exitCode)
}

func forwardWindowSizes(ctx context.Context, windows <-chan ssh.Window, sizes chan<- common.TTYSize) {
	defer close(sizes)
	for {
		select {
		case <-ctx.Done():
			return
		case window, open := <-windows:
			if !open {
				return
			}
			select {
			case sizes <- common.TTYSize{Height: dimension(window.Height), Width: dimension(window.Width)}:
			case <-ctx.Done():
				return
			}
		}
	}
}

func dimension(value int) uint16 {
	return uint16(min(max(value, 0), math.MaxUint16))
}

func (s *Server) reportExit(session ssh.Session, exitCode int) {
	exitStatus := exitCode
	if exitStatus < 0 {
		exitStatus = genericFailureExitStatus
	}
	if err := session.Exit(exitStatus); err != nil {
		s.logger.Warn("Unable to report command exit status", "error", err)
	}
}

func (s *Server) handleNonPty(session ssh.Session) {
	env, closeAgent, err := s.agentEnvironment(session)
	if err != nil {
		s.logger.Error("Failed to forward the SSH agent", "error", err)
		return
	}
	defer closeAgent()

	var args []string
	if len(session.Command()) > 0 {
		args = []string{commandFlag, session.RawCommand()}
	}
	cmd := exec.CommandContext(session.Context(), commandShell, args...)
	cmd.Env = append(os.Environ(), env...)
	cmd.Dir = s.cfg.WorkDir
	cmd.WaitDelay = childreap.PipeDrainTimeout
	cmd.Stdout = session
	cmd.Stderr = session.Stderr()
	stdin, err := cmd.StdinPipe()
	if err != nil {
		s.logger.Error("Unable to setup stdin for session", "error", err)
		return
	}
	go s.copyInput(stdin, session)
	if err := cmd.Start(); err != nil {
		s.logger.Error("Unable to start command", "error", err)
		return
	}
	stopSignals := s.relaySignals(session, cmd)
	exitCode, waitErr := s.reaper.Wait(cmd)
	stopSignals()
	if waitErr != nil || exitCode != 0 {
		s.logger.Info("Command exited", "command", session.RawCommand(), "exitCode", exitCode, "error", waitErr)
	}
	s.reportExit(session, exitCode)
}

func (s *Server) copyInput(stdin io.WriteCloser, session ssh.Session) {
	if _, err := io.Copy(stdin, session); err != nil {
		s.logger.Debug("Session input ended", "error", err)
	}
	if err := stdin.Close(); err != nil {
		s.logger.Debug("Unable to close command stdin", "error", err)
	}
}

func (s *Server) relaySignals(session ssh.Session, cmd *exec.Cmd) func() {
	signals := make(chan ssh.Signal, 1)
	session.Signals(signals)
	go func() {
		for received := range signals {
			if err := cmd.Process.Signal(osSignal(received)); err != nil {
				s.logger.Warn("Unable to send signal to process", "error", err)
			}
		}
	}()
	return func() {
		session.Signals(nil)
		close(signals)
	}
}

func signalTable() map[ssh.Signal]os.Signal {
	return map[ssh.Signal]os.Signal{
		ssh.SIGABRT: unix.SIGABRT,
		ssh.SIGALRM: unix.SIGALRM,
		ssh.SIGFPE:  unix.SIGFPE,
		ssh.SIGHUP:  unix.SIGHUP,
		ssh.SIGILL:  unix.SIGILL,
		ssh.SIGINT:  unix.SIGINT,
		ssh.SIGKILL: unix.SIGKILL,
		ssh.SIGPIPE: unix.SIGPIPE,
		ssh.SIGQUIT: unix.SIGQUIT,
		ssh.SIGSEGV: unix.SIGSEGV,
		ssh.SIGTERM: unix.SIGTERM,
		ssh.SIGUSR1: unix.SIGUSR1,
		ssh.SIGUSR2: unix.SIGUSR2,
	}
}

func osSignal(received ssh.Signal) os.Signal {
	if translated, known := signalTable()[received]; known {
		return translated
	}
	return unix.SIGKILL
}

func (s *Server) sftpHandler(session ssh.Session) {
	server, err := sftp.NewServer(session, sftp.WithDebug(io.Discard))
	if err != nil {
		s.logger.Error("sftp server init error", "error", err)
		return
	}
	if err := server.Serve(); err != nil && !errors.Is(err, io.EOF) {
		s.logger.Error("sftp server completed with error", "error", err)
	}
	if err := server.Close(); err != nil {
		s.logger.Debug("sftp server close failed", "error", err)
	}
}
