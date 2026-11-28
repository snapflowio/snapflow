// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package connector

import (
	"context"
	"fmt"
	"io"
	"net"
	"time"

	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/proxyproto"
	"github.com/snapflowio/tunnel-go/streamio"
	"github.com/snapflowio/tunnel-go/transport"
)

const (
	tcpNetwork            = "tcp"
	upstreamDialTimeout   = 5 * time.Second
	streamDecisionTimeout = 5 * time.Second
)

func (connector *Connector) serveStream(
	ctx context.Context,
	stream transport.Stream,
	open protocol.OriginStreamOpen,
) {
	defer func() { <-connector.streams }()
	dialer := net.Dialer{Timeout: upstreamDialTimeout}
	upstream, err := dialer.DialContext(ctx, tcpNetwork, connector.upstream)
	if err != nil {
		connector.logger.Warn("could not reach the origin upstream", "upstream", connector.upstream, "server_name", open.ServerName, "error", err)
		connector.reject(stream, protocol.StreamOpenStatusTargetUnavailable)
		return
	}
	defer connector.closeAndLog("origin upstream connection", upstream)
	defer connector.closeAndLog("origin tunnel stream", stream)
	if err := connector.accept(stream); err != nil {
		connector.logger.Debug("could not accept the origin stream", "server_name", open.ServerName, "error", err)
		return
	}
	header, err := proxyproto.EncodeV2(open.Source, open.Destination, proxyproto.TransportStream)
	if err != nil {
		connector.logger.Debug("could not encode the PROXY header", "server_name", open.ServerName, "error", err)
		return
	}
	if err := streamio.WriteAll(upstream, header); err != nil {
		connector.logger.Debug("could not send the PROXY header", "server_name", open.ServerName, "error", err)
		return
	}
	if err := streamio.ProxyBidirectional(stream, upstream); err != nil {
		connector.logger.Debug("origin stream closed with an error", "server_name", open.ServerName, "error", err)
	}
}

func (connector *Connector) accept(stream transport.Stream) error {
	return connector.writeResult(stream, protocol.StreamOpenStatusAccepted)
}

func (connector *Connector) reject(stream transport.Stream, status protocol.StreamOpenStatus) {
	if err := connector.writeResult(stream, status); err != nil {
		connector.logger.Debug("could not reject the origin stream", "status", status, "error", err)
	}
	connector.closeAndLog("rejected origin stream", stream)
}

func (connector *Connector) writeResult(stream transport.Stream, status protocol.StreamOpenStatus) error {
	if err := stream.SetWriteDeadline(time.Now().Add(streamDecisionTimeout)); err != nil {
		return fmt.Errorf("set stream decision deadline: %w", err)
	}
	if err := protocol.WriteFrame(stream, protocol.StreamOpenResult{Version: protocol.Version, Status: status}); err != nil {
		return fmt.Errorf("write stream decision: %w", err)
	}
	if err := stream.SetWriteDeadline(time.Time{}); err != nil {
		return fmt.Errorf("clear stream decision deadline: %w", err)
	}
	return nil
}

func (connector *Connector) closeAndLog(resource string, closer io.Closer) {
	if err := closer.Close(); err != nil {
		connector.logger.Debug("could not close "+resource, "error", err)
	}
}
