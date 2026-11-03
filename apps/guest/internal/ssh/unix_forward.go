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
	"io/fs"
	"log/slog"
	"net"
	"os"
	"path/filepath"
	"sync"

	"github.com/gliderlabs/ssh"
	"github.com/snapflowio/guest/internal/common"
	gossh "golang.org/x/crypto/ssh"
)

const (
	streamLocalForwardRequest       = "streamlocal-forward@openssh.com"
	cancelStreamLocalForwardRequest = "cancel-streamlocal-forward@openssh.com"
	forwardedStreamLocalChannel     = "forwarded-streamlocal@openssh.com"
	directStreamLocalChannel        = "direct-streamlocal@openssh.com"
	unixNetwork                     = "unix"
	socketDirectoryMode             = 0o700
)

type streamLocalForwardPayload struct {
	SocketPath string
}

type forwardedStreamLocalPayload struct {
	SocketPath string
	Reserved   uint32
}

type directStreamLocalPayload struct {
	SocketPath string
	Reserved1  string
	Reserved2  uint32
}

type forwardKey struct {
	sessionID string
	addr      string
}

type forwardedUnixHandler struct {
	logger   *slog.Logger
	mu       sync.Mutex
	forwards map[forwardKey]net.Listener
}

func newForwardedUnixHandler(logger *slog.Logger) *forwardedUnixHandler {
	return &forwardedUnixHandler{logger: logger, forwards: make(map[forwardKey]net.Listener)}
}

func (h *forwardedUnixHandler) HandleSSHRequest(ctx ssh.Context, server *ssh.Server, request *gossh.Request) (bool, []byte) {
	conn, ok := ctx.Value(ssh.ContextKeyConn).(*gossh.ServerConn)
	if !ok {
		h.logger.Warn("SSH unix forward request without an SSH connection", "server", server.Addr)
		return false, nil
	}
	var payload streamLocalForwardPayload
	if err := gossh.Unmarshal(request.Payload, &payload); err != nil {
		h.logger.Warn("Failed to parse the SSH unix forward request", "type", request.Type, "error", err)
		return false, nil
	}
	key := forwardKey{sessionID: ctx.SessionID(), addr: payload.SocketPath}
	switch request.Type {
	case streamLocalForwardRequest:
		return h.handleForward(ctx, conn, key), nil
	case cancelStreamLocalForwardRequest:
		h.handleCancel(key)
		return true, nil
	default:
		return false, nil
	}
}

func (h *forwardedUnixHandler) handleForward(ctx context.Context, conn *gossh.ServerConn, key forwardKey) bool {
	if err := allowedSocketPath(key.addr); err != nil {
		h.logger.Warn("Refused SSH unix forward", "socketPath", key.addr, "error", err)
		return false
	}
	if !h.reserve(key) {
		h.logger.Warn("SSH unix forward is already active on this session", "socketPath", key.addr)
		return true
	}
	listener, err := listenUnix(ctx, key.addr)
	if err != nil {
		h.release(key, nil)
		h.logger.Warn("Failed to listen for SSH unix forward", "socketPath", key.addr, "error", err)
		return false
	}
	if !h.store(key, listener) {
		h.closeListener(listener, key.addr)
		return true
	}
	go h.serveForward(ctx, conn, key, listener)
	return true
}

func (h *forwardedUnixHandler) handleCancel(key forwardKey) {
	h.mu.Lock()
	listener, ok := h.forwards[key]
	delete(h.forwards, key)
	h.mu.Unlock()
	if !ok {
		h.logger.Warn("SSH unix forward to cancel was not found", "socketPath", key.addr)
		return
	}
	if listener != nil {
		h.closeListener(listener, key.addr)
	}
}

func (h *forwardedUnixHandler) reserve(key forwardKey) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, exists := h.forwards[key]; exists {
		return false
	}
	h.forwards[key] = nil
	return true
}

func (h *forwardedUnixHandler) store(key forwardKey, listener net.Listener) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, reserved := h.forwards[key]; !reserved {
		return false
	}
	h.forwards[key] = listener
	return true
}

func (h *forwardedUnixHandler) release(key forwardKey, listener net.Listener) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if current, ok := h.forwards[key]; ok && current == listener {
		delete(h.forwards, key)
	}
}

func (h *forwardedUnixHandler) serveForward(ctx context.Context, conn *gossh.ServerConn, key forwardKey, listener net.Listener) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	stop := context.AfterFunc(ctx, func() { h.closeListener(listener, key.addr) })
	defer stop()
	for {
		accepted, err := listener.Accept()
		if err != nil {
			if !errors.Is(err, net.ErrClosed) {
				h.logger.Warn("SSH unix forward accept failed", "socketPath", key.addr, "error", err)
			}
			break
		}
		go h.forwardConnection(ctx, conn, key.addr, accepted)
	}
	h.release(key, listener)
	h.closeListener(listener, key.addr)
}

func (h *forwardedUnixHandler) forwardConnection(ctx context.Context, conn *gossh.ServerConn, socketPath string, accepted net.Conn) {
	payload := gossh.Marshal(&forwardedStreamLocalPayload{SocketPath: socketPath})
	channel, requests, err := conn.OpenChannel(forwardedStreamLocalChannel, payload)
	if err != nil {
		h.logger.Warn("Failed to open the SSH unix forward channel", "socketPath", socketPath, "error", err)
		if closeErr := accepted.Close(); closeErr != nil {
			h.logger.Debug("Failed to close the SSH unix forward connection", "socketPath", socketPath, "error", closeErr)
		}
		return
	}
	go gossh.DiscardRequests(requests)
	h.bicopy(ctx, channel, accepted)
}

func (h *forwardedUnixHandler) handleDirect(server *ssh.Server, connection *gossh.ServerConn, newChannel gossh.NewChannel, ctx ssh.Context) {
	var payload directStreamLocalPayload
	if err := gossh.Unmarshal(newChannel.ExtraData(), &payload); err != nil {
		h.reject(newChannel, "could not parse "+directStreamLocalChannel+" channel payload")
		return
	}
	var dialer net.Dialer
	dialed, err := dialer.DialContext(ctx, unixNetwork, payload.SocketPath)
	if err != nil {
		h.reject(newChannel, fmt.Sprintf("dial unix socket %q: %v", payload.SocketPath, err))
		return
	}
	channel, requests, err := newChannel.Accept()
	if err != nil {
		if closeErr := dialed.Close(); closeErr != nil {
			h.logger.Debug("Failed to close the unaccepted SSH unix connection", "socketPath", payload.SocketPath, "error", closeErr)
		}
		return
	}
	h.logger.Debug("Handling SSH direct unix stream", "server", server.Addr, "remote", connection.RemoteAddr())
	go gossh.DiscardRequests(requests)
	h.bicopy(ctx, channel, dialed)
}

func (h *forwardedUnixHandler) reject(newChannel gossh.NewChannel, message string) {
	if err := newChannel.Reject(gossh.ConnectionFailed, message); err != nil {
		h.logger.Debug("Failed to reject the SSH unix channel", "error", err)
	}
}

func (h *forwardedUnixHandler) closeListener(listener net.Listener, socketPath string) {
	if err := listener.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
		h.logger.Debug("Failed to close the SSH unix forward listener", "socketPath", socketPath, "error", err)
	}
}

func (h *forwardedUnixHandler) bicopy(ctx context.Context, first, second io.ReadWriteCloser) {
	ctx, cancel := context.WithCancel(ctx)
	var copies sync.WaitGroup
	copyStream := func(destination io.Writer, source io.Reader) {
		defer cancel()
		if _, err := io.Copy(destination, source); err != nil && !errors.Is(err, net.ErrClosed) {
			h.logger.Debug("SSH forwarding stream copy ended", "error", err)
		}
	}
	copies.Go(func() { copyStream(first, second) })
	copies.Go(func() { copyStream(second, first) })
	<-ctx.Done()
	for _, stream := range []io.Closer{first, second} {
		if err := stream.Close(); err != nil {
			h.logger.Debug("Failed to close an SSH forwarding stream", "error", err)
		}
	}
	copies.Wait()
}

func allowedSocketPath(socketPath string) error {
	if !filepath.IsAbs(socketPath) {
		return errors.New("the socket path must be absolute")
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("resolve the home directory: %w", err)
	}
	cleaned := filepath.Clean(socketPath)
	for _, root := range []string{home, os.TempDir()} {
		if common.Within(root, cleaned) {
			return nil
		}
	}
	return errors.New("the socket path must be inside the home or temporary directory")
}

func listenUnix(ctx context.Context, socketPath string) (net.Listener, error) {
	if err := os.MkdirAll(filepath.Dir(socketPath), socketDirectoryMode); err != nil {
		return nil, fmt.Errorf("create the socket directory: %w", err)
	}
	info, err := os.Lstat(socketPath)
	switch {
	case errors.Is(err, fs.ErrNotExist):
	case err != nil:
		return nil, fmt.Errorf("inspect the existing socket path: %w", err)
	case info.Mode()&fs.ModeSocket == 0:
		return nil, errors.New("the socket path exists and is not a socket")
	default:
		if err := os.Remove(socketPath); err != nil && !errors.Is(err, fs.ErrNotExist) {
			return nil, fmt.Errorf("remove the stale socket: %w", err)
		}
	}
	return new(net.ListenConfig).Listen(ctx, unixNetwork, socketPath)
}
