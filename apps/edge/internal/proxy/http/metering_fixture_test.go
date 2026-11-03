// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package http

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"net/url"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/traffic"
	"github.com/snapflowio/edge/internal/web"
	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/transport"
)

const (
	meteringTestHost        = "app.example.test"
	meteringTestBodyLimit   = 1 << 20
	meteringTestWait        = 10 * time.Second
	meteringTestPollPeriod  = 5 * time.Millisecond
	meteringTestTCPNetwork  = "tcp"
	meteringTestServedQueue = 16
)

type recordingMeter struct {
	mu        sync.Mutex
	counters  map[uuid.UUID][]*traffic.Counter
	harvested map[uuid.UUID]traffic.Totals
}

func newRecordingMeter() *recordingMeter {
	return &recordingMeter{
		counters:  make(map[uuid.UUID][]*traffic.Counter),
		harvested: make(map[uuid.UUID]traffic.Totals),
	}
}

func (meter *recordingMeter) OpenCounter(backendID uuid.UUID) *traffic.Counter {
	counter := new(traffic.Counter)
	meter.mu.Lock()
	defer meter.mu.Unlock()
	meter.counters[backendID] = append(meter.counters[backendID], counter)
	return counter
}

func (meter *recordingMeter) totals(backendID uuid.UUID) traffic.Totals {
	meter.mu.Lock()
	defer meter.mu.Unlock()
	sum := meter.harvested[backendID]
	for _, counter := range meter.counters[backendID] {
		delta := counter.Harvest()
		sum.BytesIn += delta.BytesIn
		sum.BytesOut += delta.BytesOut
		sum.Connections += delta.Connections
	}
	meter.harvested[backendID] = sum
	return sum
}

type dialingTunnel struct {
	address string
	err     error
}

func (dialingTunnel) BackendLoad(routes.Base) (int64, bool) {
	return 0, true
}

func (tunnel dialingTunnel) OpenStream(
	ctx context.Context,
	route routes.Base,
	routeProtocol protocol.Protocol,
	source netip.AddrPort,
) (transport.Stream, error) {
	if tunnel.err != nil {
		return nil, tunnel.err
	}
	var dialer net.Dialer
	return dialer.DialContext(ctx, meteringTestTCPNetwork, tunnel.address)
}

type meteringFixture struct {
	meter  *recordingMeter
	tunnel dialingTunnel
	route  routes.HTTP
	served chan struct{}
}

func newMeteringFixture(t *testing.T, tunnel dialingTunnel, policy routes.HTTPPolicy) *meteringFixture {
	t.Helper()
	policy.MaxBodyBytes = meteringTestBodyLimit
	return &meteringFixture{
		meter:  newRecordingMeter(),
		tunnel: tunnel,
		route: routes.HTTP{
			Base:   routes.Base{BackendID: uuid.New(), PublicHost: meteringTestHost},
			Policy: policy,
		},
		served: make(chan struct{}, meteringTestServedQueue),
	}
}

func backendAddress(t *testing.T, backend *httptest.Server) string {
	t.Helper()
	parsed, err := url.Parse(backend.URL)
	if err != nil {
		t.Fatalf("parse backend URL: %v", err)
	}
	return parsed.Host
}

func (fixture *meteringFixture) handler() http.Handler {
	frontend := &Frontend{streams: fixture.tunnel, meter: fixture.meter, logger: slog.New(slog.DiscardHandler)}
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		frontend.proxy(writer, request, routeSelection{
			matches: []routes.HTTP{fixture.route},
			route:   fixture.route,
		}, requestMetadata{scheme: web.SchemeHTTP})
		fixture.served <- struct{}{}
	})
}

func (fixture *meteringFixture) waitServed(t *testing.T) traffic.Totals {
	t.Helper()
	select {
	case <-fixture.served:
	case <-time.After(meteringTestWait):
		t.Fatal("the proxied request did not finish")
	}
	return fixture.meter.totals(fixture.route.BackendID)
}

func (fixture *meteringFixture) waitForIngress(t *testing.T, want uint64) traffic.Totals {
	t.Helper()
	deadline := time.Now().Add(meteringTestWait)
	for {
		totals := fixture.meter.totals(fixture.route.BackendID)
		if totals.BytesIn >= want || time.Now().After(deadline) {
			return totals
		}
		time.Sleep(meteringTestPollPeriod)
	}
}
