// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"context"
	"crypto/tls"
	"time"

	"github.com/snapflowio/edge/internal/access"
	"github.com/snapflowio/edge/internal/admit"
	"github.com/snapflowio/edge/internal/certs"
	"github.com/snapflowio/edge/internal/control"
	"github.com/snapflowio/edge/internal/identity"
	"github.com/snapflowio/edge/internal/meter"
	"github.com/snapflowio/edge/internal/proxy"
	httpproxy "github.com/snapflowio/edge/internal/proxy/http"
	"github.com/snapflowio/edge/internal/proxy/tcp"
	"github.com/snapflowio/edge/internal/proxy/udp"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/telemetry"
)

const (
	drainTimeout      = 30 * time.Second
	drainPollInterval = 100 * time.Millisecond
)

type assembly struct {
	certificates *certs.Reloader
	tunnelTLS    *tls.Config
	publicTLS    *tls.Config
	identity     *identity.Identity
	session      *control.Session
	client       *control.Client
	routes       *routes.Store
	meter        *meter.Meter
	admission    *admit.Controller
	udp          *udp.Frontend
	tunnels      Tunnels
	sessions     *access.Sessions
	http         *httpproxy.Frontend
	tcp          *tcp.Frontend
	ports        *proxy.Ports
	coordinator  *control.Coordinator
	telemetry    *telemetry.Server
	components   registry
}

func (server *Server) assemble(ctx context.Context) (*assembly, error) {
	assembled := &assembly{}
	steps := [...]func() error{
		func() error { return server.openTLS(assembled) },
		func() error { return server.openControlPlane(ctx, assembled) },
		func() error { return server.openProxy(assembled) },
		func() error { return server.openObservation(assembled) },
	}
	for _, step := range steps {
		if err := step(); err != nil {
			return nil, err
		}
	}
	assembled.registerComponents()
	return assembled, nil
}

func (assembled *assembly) registerComponents() {
	assembled.components.register("Edge control session", assembled.session)
	assembled.components.register("admission maintenance", assembled.admission)
	assembled.components.register("TLS certificate reload", assembled.certificates)
	assembled.components.register("coordinator", assembled.coordinator)
	assembled.components.register("usage meter", assembled.meter)
	assembled.components.register("UDP socket metrics", assembled.udp.Sockets())
	assembled.components.register("Machine tunnels", assembled.tunnels)
	assembled.components.register("HTTP ingress", assembled.http)
	assembled.components.register("TCP and UDP ingress", assembled.ports)
	assembled.components.register("Prometheus metrics", assembled.telemetry)
}

func (assembled *assembly) drainPlan() drainPlan {
	return drainPlan{
		begin: func(ctx context.Context) {
			assembled.admission.BeginDrain()
			assembled.tunnels.BeginDrain()
			assembled.coordinator.BeginDrain(ctx)
		},
		complete: func() bool {
			counters := assembled.admission.Snapshot()
			return counters.HTTPRequestActive == 0 &&
				counters.HTTPStreamActive == 0 &&
				counters.TCPActive == 0 &&
				assembled.udp.FlowCount() == 0
		},
		timeout:      drainTimeout,
		pollInterval: drainPollInterval,
	}
}
