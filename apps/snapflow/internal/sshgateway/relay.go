// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sshgateway

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"time"

	"github.com/snapflowio/common-go/pkg/guestspec"
	"golang.org/x/crypto/ssh"
)

func (s *Service) handleConnection(ctx context.Context, conn net.Conn) {
	defer conn.Close()
	serverConn, chans, reqs, sandboxID, err := s.handshake(ctx, conn)
	if err != nil {
		s.log.WarnContext(ctx, "Rejected SSH connection", "error", err)
		return
	}
	defer serverConn.Close()
	go s.rejectGlobalRequests(reqs)
	connClosed := make(chan struct{})
	go func() {
		if err := serverConn.Wait(); err != nil {
			s.log.DebugContext(ctx, "SSH client connection closed", "error", err)
		}
		close(connClosed)
	}()
	for newChannel := range chans {
		go s.handleChannel(ctx, newChannel, connClosed, sandboxID)
	}
}

func (s *Service) handshake(
	ctx context.Context,
	conn net.Conn,
) (*ssh.ServerConn, <-chan ssh.NewChannel, <-chan *ssh.Request, string, error) {
	if err := conn.SetDeadline(time.Now().Add(sshHandshakeTimeout)); err != nil {
		return nil, nil, nil, "", fmt.Errorf("set SSH handshake deadline: %w", err)
	}
	serverConn, chans, reqs, err := ssh.NewServerConn(conn, s.serverConfig)
	if err != nil {
		return nil, nil, nil, "", fmt.Errorf("SSH handshake: %w", err)
	}
	sandboxID, err := s.authorize(ctx, serverConn.User())
	if err == nil {
		err = conn.SetDeadline(time.Time{})
	}
	if err != nil {
		return nil, nil, nil, "", errors.Join(err, serverConn.Close())
	}
	return serverConn, chans, reqs, sandboxID, nil
}

func (s *Service) authorize(ctx context.Context, token string) (string, error) {
	resolved, err, _ := s.resolutions.Do(token, func() (any, error) {
		resolveContext, cancel := context.WithTimeout(context.WithoutCancel(ctx), sshAccessTimeout)
		defer cancel()
		return s.access.ResolveSSHAccess(resolveContext, token)
	})
	if err != nil {
		return "", fmt.Errorf("validate SSH access grant: %w", err)
	}
	sandboxID, ok := resolved.(string)
	if !ok {
		return "", errors.New("SSH access grant resolved to an invalid sandbox")
	}
	return sandboxID, nil
}

func (s *Service) rejectGlobalRequests(reqs <-chan *ssh.Request) {
	for req := range reqs {
		if req == nil || !req.WantReply {
			continue
		}
		if err := req.Reply(false, nil); err != nil {
			s.log.Debug("Failed to reply to global SSH request", "requestType", req.Type, "error", err)
		}
	}
}

const (
	clientPeer  = "client"
	sandboxPeer = "sandbox"
)

func (s *Service) handleChannel(ctx context.Context, newChannel ssh.NewChannel, connClosed <-chan struct{}, sandboxID string) {
	s.log.Debug("New channel", "channelType", newChannel.ChannelType(), "sandboxID", sandboxID)

	clientChannel, clientRequests, err := newChannel.Accept()
	if err != nil {
		s.log.Warn("Could not accept client channel", "error", err)
		return
	}
	defer clientChannel.Close()

	sandboxChannel, sandboxRequests, sandboxClient, err := s.connectToSandbox(ctx, sandboxID, newChannel.ChannelType(), newChannel.ExtraData())
	if err != nil {
		s.log.Warn("Could not connect to sandbox", "sandboxID", sandboxID, "error", err)
		clientChannel.Close()
		return
	}
	defer sandboxClient.Close()
	defer sandboxChannel.Close()

	go s.forwardRequests(clientRequests, sandboxChannel, clientPeer, sandboxPeer, sandboxID)
	go s.forwardRequests(sandboxRequests, clientChannel, sandboxPeer, clientPeer, sandboxID)

	go func() {
		bytesCopied, err := io.Copy(sandboxChannel, clientChannel)
		if err != nil {
			s.log.Debug("Client to sandbox copy error", "bytesCopied", bytesCopied, "error", err)
		}
		if err := sandboxChannel.CloseWrite(); err != nil {
			s.log.Debug("Failed to half-close sandbox SSH channel", "sandboxID", sandboxID, "error", err)
		}
	}()

	sessionDone := make(chan struct{})
	defer close(sessionDone)
	go func() {
		select {
		case <-connClosed:
			if err := sandboxChannel.Close(); err != nil {
				s.log.Debug("Failed to close sandbox SSH channel", "sandboxID", sandboxID, "error", err)
			}
		case <-sessionDone:
		}
	}()

	bytesCopied, err := io.Copy(clientChannel, sandboxChannel)
	if err != nil {
		s.log.Debug("Sandbox to client copy error", "bytesCopied", bytesCopied, "error", err)
	}

	s.log.Debug("Channel closed for sandbox", "sandboxID", sandboxID)
}

func (s *Service) forwardRequests(requests <-chan *ssh.Request, destination ssh.Channel, source, target, sandboxID string) {
	for req := range requests {
		if req == nil {
			return
		}
		s.log.Debug("Channel request", "from", source, "requestType", req.Type, "sandboxID", sandboxID)
		ok, err := destination.SendRequest(req.Type, req.WantReply, req.Payload)
		if !req.WantReply {
			continue
		}
		reply := []byte(nil)
		if err != nil {
			s.log.Warn("Failed to forward channel request", "to", target, "requestType", req.Type, "sandboxID", sandboxID, "error", err)
			ok, reply = false, []byte(err.Error())
		}
		if replyErr := req.Reply(ok, reply); replyErr != nil {
			s.log.Warn("Failed to reply to channel request", "from", source, "error", replyErr)
		}
	}
}

func (s *Service) connectToSandbox(ctx context.Context, sandboxID, channelType string, extraData []byte) (ssh.Channel, <-chan *ssh.Request, *ssh.Client, error) {
	target, err := s.runtime.GuestServiceTarget(ctx, sandboxID, guestspec.SSHService)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("resolve sandbox SSH service: %w", err)
	}
	if target.DialContext == nil {
		return nil, nil, nil, errors.New("sandbox SSH service has no dial transport")
	}
	if target.Credential == "" {
		return nil, nil, nil, errors.New("sandbox SSH service credential is unavailable")
	}
	clientConfig := &ssh.ClientConfig{
		User:            sshSandboxUser,
		Auth:            []ssh.AuthMethod{ssh.Password(target.Credential)},
		HostKeyCallback: acceptGuestServiceHostKey,
		Timeout:         sshDialTimeout,
	}

	dialContext, cancel := context.WithTimeout(ctx, sshDialTimeout)
	defer cancel()
	connection, err := target.DialContext(dialContext, "tcp", guestspec.SSHService)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("dial sandbox SSH service: %w", err)
	}
	if err := connection.SetDeadline(time.Now().Add(sshDialTimeout)); err != nil {
		closeErr := connection.Close()
		return nil, nil, nil, errors.Join(fmt.Errorf("set sandbox SSH handshake deadline: %w", err), closeErr)
	}
	clientConnection, channels, requests, err := ssh.NewClientConn(connection, guestspec.SSHService, clientConfig)
	if err != nil {
		closeErr := connection.Close()
		return nil, nil, nil, errors.Join(fmt.Errorf("handshake with sandbox SSH service: %w", err), closeErr)
	}
	if err := connection.SetDeadline(time.Time{}); err != nil {
		closeErr := clientConnection.Close()
		return nil, nil, nil, errors.Join(fmt.Errorf("clear sandbox SSH deadline: %w", err), closeErr)
	}
	sandboxClient := ssh.NewClient(clientConnection, channels, requests)

	sandboxChannel, sandboxRequests, err := sandboxClient.OpenChannel(channelType, extraData)
	if err != nil {
		closeErr := sandboxClient.Close()
		return nil, nil, nil, errors.Join(fmt.Errorf("open sandbox SSH channel: %w", err), closeErr)
	}

	return sandboxChannel, sandboxRequests, sandboxClient, nil
}

func acceptGuestServiceHostKey(string, net.Addr, ssh.PublicKey) error {
	return nil
}
