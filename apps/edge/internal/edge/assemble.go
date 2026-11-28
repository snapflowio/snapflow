// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"context"
	"time"

	"github.com/snapflowio/edge/internal/access"
	"github.com/snapflowio/edge/internal/control"
	"github.com/snapflowio/edge/internal/identity"
	"github.com/snapflowio/edge/internal/meter"
	"github.com/snapflowio/edge/internal/proxy"
	httpproxy "github.com/snapflowio/edge/internal/proxy/http"
	"github.com/snapflowio/edge/internal/proxy/tcp"
	"github.com/snapflowio/edge/internal/proxy/udp"
	"github.com/snapflowio/edge/internal/telemetry"
	"github.com/snapflowio/edge/internal/tlsbundle"
)

const (
	drainTimeout      = 30 * time.Second
	drainPollInterval = 100 * time.Millisecond
)

type assembly struct {
	*relayAssembly
	identity    *identity.Identity
	session     *control.Session
	client      *control.Client
	meter       *meter.Meter
	udp         *udp.Frontend
	sessions    *access.Sessions
	http        *httpproxy.Frontend
	tcp         *tcp.Frontend
	ports       *proxy.Ports
	coordinator *control.Coordinator
	telemetry   *telemetry.Server
	tlsSync     *tlsbundle.Syncer
	components  registry
}

func (server *Server) assemble(ctx context.Context, relay *relayAssembly) (*assembly, error) {
	assembled := &assembly{relayAssembly: relay}
	steps := [...]func() error{
		func() error { return server.openControlPlane(ctx, assembled) },
		func() error { return server.openTLSSync(assembled) },
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
	assembled.components.register("TLS bundle sync", assembled.tlsSync)
	assembled.components.register("coordinator", assembled.coordinator)
	assembled.components.register("usage meter", assembled.meter)
	assembled.components.register("UDP socket metrics", assembled.udp.Sockets())
	assembled.components.register("HTTP ingress", assembled.http)
	assembled.components.register("TCP and UDP ingress", assembled.ports)
	assembled.components.register("Prometheus metrics", assembled.telemetry)
}

func (assembled *assembly) drainPlan() drainPlan {
	return drainPlan{
		begin: func(ctx context.Context) {
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
