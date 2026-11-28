// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package passthrough

import (
	"context"
	"net"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/admit"
	"github.com/snapflowio/edge/internal/proxy"
	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/streamio"
)

func (router *Router) forward(ctx context.Context, client net.Conn, serverName string, consumed []byte) {
	defer proxy.CloseAndLog(router.logger, "passthrough client", client)
	source, valid := proxy.SourceAddress(client.RemoteAddr())
	if !valid {
		router.counters.rejected.Add(1)
		return
	}
	destination, valid := proxy.ProxyDestination(client.LocalAddr(), source.Addr())
	if !valid {
		router.counters.rejected.Add(1)
		return
	}
	permit, result := router.admission.AdmitHTTPConnection(source.Addr())
	if result != admit.ResultAllowed {
		router.counters.rejected.Add(1)
		return
	}
	defer permit.Release()
	stream, err := router.origins.OpenOriginStream(ctx, protocol.OriginStreamOpen{
		Version:      protocol.Version,
		ConnectionID: uuid.New(),
		ServerName:   serverName,
		Source:       source,
		Destination:  destination,
	})
	if err != nil {
		router.counters.originUnavailable.Add(1)
		router.logger.Debug("origin tunnel unavailable for passthrough", "server_name", serverName, "error", err)
		return
	}
	defer proxy.CloseAndLog(router.logger, "passthrough origin stream", stream)
	router.counters.forwarded.Add(1)
	if err := streamio.WriteAll(stream, consumed); err != nil {
		router.logger.Debug("could not replay the client hello to the origin", "server_name", serverName, "error", err)
		return
	}
	if err := streamio.ProxyBidirectional(client, stream); err != nil {
		router.logger.Debug("passthrough connection closed with an error", "server_name", serverName, "error", err)
	}
}
