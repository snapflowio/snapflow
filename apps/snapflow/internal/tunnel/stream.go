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
	"fmt"
	"log/slog"
	"net"
	"time"

	microvmtypes "github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/tunnel/plan"
	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/streamio"
	"github.com/snapflowio/tunnel-go/transport"
)

const (
	streamDecisionTimeout = 5 * time.Second
	streamRetryAfter      = time.Second
)

func (session *tunnelSession) acceptStreams(ctx context.Context) error {
	tunnel := session.tunnel
	for {
		stream, open, err := session.carrier.AcceptStream(ctx)
		if err != nil {
			return err
		}
		target, exists := tunnel.manager.target(
			open.Binding,
			open.BackendID,
			open.AssignmentGeneration,
		)
		switch {
		case open.Binding != tunnel.binding.Identity:
			tunnel.rejectStream(stream, protocol.StreamOpenStatusBindingMismatch)
			continue
		case !exists || target.Protocol == protocol.ProtocolUDP || target.Protocol != open.Protocol:
			tunnel.rejectStream(stream, protocol.StreamOpenStatusBackendNotFound)
			continue
		}
		if !session.beginStream() {
			tunnel.rejectStream(stream, protocol.StreamOpenStatusMachineDraining)
			continue
		}
		permit, admitted := tunnel.manager.streams.acquire(session.slots)
		if !admitted {
			session.streams.Done()
			tunnel.rejectStream(stream, protocol.StreamOpenStatusTargetCapacity)
			continue
		}
		go func() {
			defer session.streams.Done()
			defer permit.release()
			tunnel.serveStream(ctx, stream, target)
		}()
	}
}

func (tunnel *edgeTunnel) serveStream(ctx context.Context, stream transport.Stream, target plan.Target) {
	dialContext, cancelDial := context.WithTimeout(ctx, streamDecisionTimeout)
	upstream, err := tunnel.manager.dialTarget(dialContext, target)
	cancelDial()
	if err != nil {
		tunnel.manager.log.DebugContext(ctx, "Machine tunnel target unavailable", "backend_id", target.BackendID, "error", err)
		tunnel.rejectStream(stream, protocol.StreamOpenStatusTargetUnavailable)
		return
	}
	defer closeNetworkResource("runtime tunnel connection", upstream)
	defer closeNetworkResource("tunnel stream", stream)
	if err := acceptStream(stream); err != nil {
		tunnel.manager.log.DebugContext(ctx, "Machine tunnel stream acceptance failed", "error", err)
		return
	}
	stopCancellation := context.AfterFunc(ctx, func() {
		closeNetworkResource("cancelled tunnel stream", stream)
		closeNetworkResource("cancelled runtime tunnel connection", upstream)
	})
	defer stopCancellation()
	if err := streamio.ProxyBidirectional(stream, upstream); err != nil && ctx.Err() == nil {
		tunnel.manager.log.DebugContext(ctx, "Machine tunnel stream ended", "error", err)
	}
}

func (manager *Manager) dialTarget(ctx context.Context, target plan.Target) (net.Conn, error) {
	switch target.Host {
	case plan.RuntimeTargetHost:
		if target.GuestService != "" {
			return manager.dialGuestService(ctx, target)
		}
		return manager.runtime.DialRuntimePort(
			ctx,
			target.SandboxID,
			microvmtypes.RuntimePortTarget{
				Protocol: microvmtypes.RuntimePortTCP,
				Port:     target.Port,
			},
		)
	case plan.BuildLogsTargetHost:
		return manager.buildLogs.DialBuildLog(ctx, target.Reference)
	case plan.SSHGatewayTargetHost:
		if manager.sshGateway == nil {
			return nil, errors.New("machine SSH gateway is unavailable")
		}
		return manager.sshGateway.DialSSHGateway(ctx)
	default:
		return nil, fmt.Errorf("unsupported tunnel target host %q", target.Host)
	}
}

func acceptStream(stream transport.Stream) error {
	if err := stream.SetWriteDeadline(time.Now().Add(streamDecisionTimeout)); err != nil {
		return fmt.Errorf("set tunnel stream acceptance deadline: %w", err)
	}
	if err := protocol.WriteFrame(stream, protocol.StreamOpenResult{
		Version: protocol.Version,
		Status:  protocol.StreamOpenStatusAccepted,
	}); err != nil {
		return fmt.Errorf("write tunnel stream acceptance: %w", err)
	}
	if err := stream.SetWriteDeadline(time.Time{}); err != nil {
		return fmt.Errorf("clear tunnel stream acceptance deadline: %w", err)
	}
	return nil
}

func (tunnel *edgeTunnel) rejectStream(
	stream transport.Stream,
	status protocol.StreamOpenStatus,
) {
	retryAfter := uint32(0)
	if status == protocol.StreamOpenStatusTargetUnavailable ||
		status == protocol.StreamOpenStatusTargetCapacity ||
		status == protocol.StreamOpenStatusMachineDraining {
		retryAfter = uint32(streamRetryAfter / time.Millisecond)
	}
	if err := stream.SetWriteDeadline(time.Now().Add(streamDecisionTimeout)); err == nil {
		if err := protocol.WriteFrame(stream, protocol.StreamOpenResult{
			Version:      protocol.Version,
			Status:       status,
			RetryAfterMS: retryAfter,
		}); err != nil {
			tunnel.manager.log.Debug("Could not reject machine tunnel stream", "status", status, "error", err)
		}
	}
	closeNetworkResource("rejected tunnel stream", stream)
}

func closeNetworkResource(name string, closer interface{ Close() error }) {
	if err := closer.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
		slog.Debug("Network resource did not close cleanly", "resource", name, "error", err)
	}
}
