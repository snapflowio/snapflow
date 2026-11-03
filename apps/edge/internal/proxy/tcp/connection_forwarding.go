// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tcp

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"time"

	"github.com/snapflowio/edge/internal/admit"
	"github.com/snapflowio/edge/internal/proxy"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/proxyproto"
	"github.com/snapflowio/tunnel-go/streamio"
	"github.com/snapflowio/tunnel-go/transport"
)

var errInvalidProxyDestination = errors.New("edge TCP listener address is invalid for a PROXY header")

func (public *portListener) forward(ctx context.Context, client net.Conn) {
	defer func() {
		<-public.semaphore
		public.frontend.connections.Add(-1)
		proxy.CloseAndLog(public.frontend.logger, "edge TCP client", client)
	}()
	frontend := public.frontend
	route, exists := frontend.routes.Load().TCP(public.port, time.Now())
	if !exists {
		return
	}
	source, valid := proxy.SourceAddress(client.RemoteAddr())
	if !valid {
		return
	}
	permit, result := frontend.admission.AdmitTCP(source.Addr(), admit.RouteScope(route.Base))
	if result != admit.ResultAllowed {
		return
	}
	defer permit.Release()
	stream, err := frontend.streams.OpenStream(ctx, route.Base, protocol.ProtocolTCP, source)
	if err != nil {
		frontend.logger.Debug("Machine TCP tunnel unavailable", "backend_id", route.BackendID, "error", err)
		return
	}
	defer proxy.CloseAndLog(frontend.logger, "edge TCP tunnel stream", stream)
	counter := frontend.meter.OpenCounter(route.BackendID)
	defer counter.Close()
	counter.AddConnection()
	if err := writeProxyHeader(stream, route, client, source); err != nil {
		frontend.logger.Debug("could not send the PROXY protocol header", "backend_id", route.BackendID, "error", err)
		return
	}
	metered, err := proxy.NewMeteredConn(client, counter)
	if err != nil {
		frontend.logger.Error("could not meter the edge TCP connection", "backend_id", route.BackendID, "error", err)
		return
	}
	if err := streamio.ProxyBidirectional(
		&idleTimeoutConnection{connection: metered, timeout: route.Policy.IdleTimeout},
		&idleTimeoutConnection{connection: stream, timeout: route.Policy.IdleTimeout},
	); err != nil {
		frontend.logger.Debug(
			"edge TCP proxy closed with an error",
			"backend_id", route.BackendID,
			"error", err,
		)
	}
}

func writeProxyHeader(
	stream transport.Stream,
	route routes.TCP,
	client net.Conn,
	source netip.AddrPort,
) error {
	if route.Policy.ProxyProtocol != routes.ProxyProtocolV2 {
		return nil
	}
	destination, valid := proxy.ProxyDestination(client.LocalAddr(), source.Addr())
	if !valid {
		return errInvalidProxyDestination
	}
	header, err := proxyproto.EncodeV2(source, destination, proxyproto.TransportStream)
	if err != nil {
		return fmt.Errorf("encode PROXY header: %w", err)
	}
	if err := streamio.WriteAll(stream, header); err != nil {
		return fmt.Errorf("write PROXY header: %w", err)
	}
	return nil
}
