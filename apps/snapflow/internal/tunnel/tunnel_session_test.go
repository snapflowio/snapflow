// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tunnel

import (
	"context"
	"errors"
	"net"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/snapflow/internal/tunnel/plan"
	"github.com/snapflowio/tunnel-go/protocol"
)

const (
	testHeartbeatSequence      = 1
	testHeldResponseWindow     = 100 * time.Millisecond
	testHeartbeatResponseLimit = 5 * time.Second
)

func TestFirstHeartbeatResponseWaitsForControlAcknowledgement(t *testing.T) {
	t.Parallel()
	edge, machine := net.Pipe()
	t.Cleanup(func() {
		if err := edge.Close(); err != nil {
			t.Errorf("close Edge pipe: %v", err)
		}
	})
	binding := protocol.Binding{ID: uuid.New(), Revision: 1, Digest: testPlanDigest}
	session := &tunnelSession{
		tunnel:              &edgeTunnel{binding: plan.Binding{Identity: binding}},
		heartbeatConfirmed:  make(chan struct{}),
		controlAcknowledged: make(chan struct{}),
	}
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	responder := make(chan error, 1)
	go func() { responder <- session.respondToHeartbeats(ctx, machine) }()

	if err := protocol.WriteFrame(edge, protocol.HeartbeatRequest{
		Version:  protocol.Version,
		Sequence: testHeartbeatSequence,
	}); err != nil {
		t.Fatalf("write heartbeat request: %v", err)
	}
	if err := edge.SetReadDeadline(time.Now().Add(testHeldResponseWindow)); err != nil {
		t.Fatalf("set held response deadline: %v", err)
	}
	var response protocol.HeartbeatResponse
	if err := protocol.ReadFrame(edge, &response); !errors.Is(err, os.ErrDeadlineExceeded) {
		t.Fatalf("heartbeat response before control acknowledgement: %v", err)
	}

	session.confirmControlAcknowledgement()
	if err := edge.SetReadDeadline(time.Now().Add(testHeartbeatResponseLimit)); err != nil {
		t.Fatalf("set response deadline: %v", err)
	}
	if err := protocol.ReadFrame(edge, &response); err != nil {
		t.Fatalf("read heartbeat response after control acknowledgement: %v", err)
	}
	if response.Sequence != testHeartbeatSequence || response.Binding != binding {
		t.Fatalf("heartbeat response = %+v, want sequence %d for binding %s", response, testHeartbeatSequence, binding.ID)
	}
	select {
	case <-session.heartbeatConfirmed:
	case <-time.After(testHeartbeatResponseLimit):
		t.Fatal("first heartbeat was not confirmed")
	}
	cancel()
	if err := machine.Close(); err != nil {
		t.Fatalf("close Machine pipe: %v", err)
	}
	if err := <-responder; err == nil {
		t.Fatal("heartbeat responder kept running after its stream closed")
	}
}
