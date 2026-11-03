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
	"io"
	"net"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/snapflowio/common-go/pkg/guestspec"
	microvmtypes "github.com/snapflowio/microvm-go/types"
	"golang.org/x/crypto/ssh"
)

const (
	testHostKeyFile = "host_key"
	testWaitTimeout = 5 * time.Second
)

type unusedGuestServices struct{}

func (unusedGuestServices) GuestServiceTarget(context.Context, string, string) (*microvmtypes.ProxyTarget, error) {
	return nil, errors.New("no guest services in this test")
}

type blockingAccess struct{}

func (blockingAccess) ResolveSSHAccess(ctx context.Context, token string) (string, error) {
	<-ctx.Done()
	return "", ctx.Err()
}

func testService(t *testing.T, access AccessControl) *Service {
	t.Helper()
	service, err := New(
		Config{Port: maximumNetworkPort, HostKeyFile: filepath.Join(t.TempDir(), testHostKeyFile)},
		Dependencies{Runtime: unusedGuestServices{}, Access: access},
	)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	return service
}

func TestAdmitRejectsConnectionsBeyondTheLimit(t *testing.T) {
	service := testService(t, blockingAccess{})
	for range maximumConcurrentConnections {
		service.slots <- struct{}{}
	}
	server, client := net.Pipe()
	defer client.Close()
	var connections sync.WaitGroup
	service.admit(t.Context(), server, &connections)
	connections.Wait()
	if _, err := client.Read(make([]byte, 1)); !errors.Is(err, io.EOF) {
		t.Fatalf("read from rejected connection = %v, want EOF", err)
	}
}

func TestRunClosesLiveConnectionsOnShutdown(t *testing.T) {
	service := testService(t, blockingAccess{})
	service.port = 0
	if err := service.Prepare(t.Context()); err != nil {
		t.Fatalf("Prepare() error = %v", err)
	}
	ctx, cancel := context.WithCancel(t.Context())
	stopped := make(chan error, 1)
	go func() { stopped <- service.Run(ctx) }()
	connection, err := service.DialSSHGateway(t.Context())
	if err != nil {
		t.Fatalf("DialSSHGateway() error = %v", err)
	}
	defer connection.Close()
	handshake := make(chan error, 1)
	go func() {
		clientConn, channels, requests, err := ssh.NewClientConn(connection, guestspec.SSHService, &ssh.ClientConfig{
			User: testGrantToken, HostKeyCallback: acceptGuestServiceHostKey,
		})
		if err == nil {
			err = ssh.NewClient(clientConn, channels, requests).Wait()
		}
		handshake <- err
	}()
	cancel()
	select {
	case err := <-stopped:
		if err != nil {
			t.Fatalf("Run() error = %v", err)
		}
	case <-time.After(testWaitTimeout):
		t.Fatal("Run did not return after shutdown")
	}
	select {
	case err := <-handshake:
		t.Logf("the live SSH connection closed on shutdown: %v", err)
	case <-time.After(testWaitTimeout):
		t.Fatal("the live SSH connection was not closed on shutdown")
	}
}
