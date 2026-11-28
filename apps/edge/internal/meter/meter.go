// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"context"
	"errors"
	"log/slog"
	"math"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/control"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/traffic"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	flushInterval       = time.Minute
	flushRequestTimeout = 10 * time.Second
	maximumMeterRoutes  = maximumCheckpointSamples
)

type API interface {
	OpenUsageEpoch(context.Context) (*apiclient.EdgeUsageEpochDto, error)
	IngestUsageCheckpoint(
		context.Context,
		apiclient.EdgeUsageCheckpointDto,
	) (*apiclient.EdgeUsageCheckpointAcknowledgementDto, error)
}

type Routes interface {
	Load() *routes.Snapshot
}

type SessionSource interface {
	Credentials() control.Credentials
	Expiry() time.Time
}

type backendIdentity struct {
	assignmentGeneration int32
	protocol             apiclient.NetworkProtocol
}

type backendCounters struct {
	backendIdentity
	bytesIn        uint64
	bytesOut       uint64
	packetsIn      uint64
	packetsOut     uint64
	tcpConnections uint64
	udpFlows       uint64
}

func (counters backendCounters) empty() bool {
	return counters.bytesIn == 0 && counters.bytesOut == 0 &&
		counters.packetsIn == 0 && counters.packetsOut == 0 &&
		counters.tcpConnections == 0 && counters.udpFlows == 0
}

type Snapshot struct {
	QueueSnapshot
	DiscardedIntervals uint64
	DroppedRecords     uint64
}

type registration struct {
	backendID  uuid.UUID
	identity   backendIdentity
	attributed bool
}

type Meter struct {
	logger             *slog.Logger
	control            API
	routes             Routes
	signer             Signer
	session            SessionSource
	mu                 sync.Mutex
	window             sessionWindow
	intervalStart      time.Time
	counters           map[uuid.UUID]backendCounters
	liveMu             sync.Mutex
	live               map[*traffic.Counter]registration
	intervalDrops      uint64
	intervals          *intervalQueue
	discardedIntervals atomic.Uint64
	droppedRecords     atomic.Uint64
}

type Dependencies struct {
	API     API
	Routes  Routes
	Signer  Signer
	Session SessionSource
}

func Open(
	stateDirectory string,
	dependencies Dependencies,
	opts ...Option,
) (*Meter, error) {
	control, routes, signer, session := dependencies.API, dependencies.Routes, dependencies.Signer, dependencies.Session
	if !filepath.IsAbs(stateDirectory) || control == nil || routes == nil ||
		signer == nil || uuid.Validate(signer.EdgeID()) != nil || session == nil {
		return nil, errors.New(
			"usage meter requires an absolute state directory, control API, routes, identity, and session",
		)
	}
	window := currentSessionWindow(session)
	if window.generation < 1 {
		return nil, errors.New("usage meter requires an established Edge session")
	}
	intervals, err := openQueue(stateDirectory, signer.EdgeID())
	if err != nil {
		return nil, err
	}
	logger := newOptions(opts).logger
	usage := &Meter{
		logger:        logger,
		control:       control,
		routes:        routes,
		signer:        signer,
		session:       session,
		window:        window,
		intervalStart: canonicalTime(time.Now()),
		counters:      make(map[uuid.UUID]backendCounters),
		live:          make(map[*traffic.Counter]registration),
		intervals:     intervals,
	}
	if recovery := intervals.recovery; recovery.CursorReset || recovery.DiscardedIntervals > 0 {
		usage.discardedIntervals.Add(uint64(recovery.DiscardedIntervals))
		logger.Error(
			"discarded corrupt Edge usage state; unacknowledged usage it held is dropped rather than risk billing it twice",
			"state_directory", intervals.root,
			"cursor_reset", recovery.CursorReset,
			"discarded_intervals", recovery.DiscardedIntervals,
		)
	}
	return usage, nil
}

func (meter *Meter) OpenCounter(backendID uuid.UUID) *traffic.Counter {
	identity, attributed := meter.snapshotIdentity(backendID)
	counter := new(traffic.Counter)
	meter.liveMu.Lock()
	meter.live[counter] = registration{
		backendID:  backendID,
		identity:   identity,
		attributed: attributed,
	}
	meter.liveMu.Unlock()
	return counter
}

func (meter *Meter) harvest() {
	type harvested struct {
		registration
		totals traffic.Totals
	}
	meter.liveMu.Lock()
	collected := make([]harvested, 0, len(meter.live))
	for counter, registered := range meter.live {
		closed := counter.Closed()
		totals := counter.Harvest()
		if totals.Empty() {
			if closed {
				delete(meter.live, counter)
			}
			continue
		}
		collected = append(collected, harvested{registration: registered, totals: totals})
	}
	meter.liveMu.Unlock()
	for _, entry := range collected {
		meter.fold(entry.registration, entry.totals)
	}
}

func (meter *Meter) fold(registered registration, totals traffic.Totals) {
	counters, exists := meter.counters[registered.backendID]
	if !exists {
		identity, found := meter.snapshotIdentity(registered.backendID)
		if !found {
			identity, found = registered.identity, registered.attributed
		}
		if !found || len(meter.counters) >= maximumMeterRoutes {
			meter.intervalDrops++
			meter.droppedRecords.Add(1)
			return
		}
		counters.backendIdentity = identity
	}
	counters.bytesIn = addCounter(counters.bytesIn, totals.BytesIn)
	counters.bytesOut = addCounter(counters.bytesOut, totals.BytesOut)
	counters.packetsIn = addCounter(counters.packetsIn, totals.PacketsIn)
	counters.packetsOut = addCounter(counters.packetsOut, totals.PacketsOut)
	counters.tcpConnections = addCounter(counters.tcpConnections, totals.Connections)
	counters.udpFlows = addCounter(counters.udpFlows, totals.Flows)
	meter.counters[registered.backendID] = counters
}

func (meter *Meter) snapshotIdentity(backendID uuid.UUID) (backendIdentity, bool) {
	generation, routeProtocol, found := meter.routes.Load().UsageIdentity(backendID)
	if !found || generation <= 0 || generation > math.MaxInt32 {
		return backendIdentity{}, false
	}
	apiProtocol, err := usageNetworkProtocol(routeProtocol)
	if err != nil {
		return backendIdentity{}, false
	}
	return backendIdentity{assignmentGeneration: int32(generation), protocol: apiProtocol}, true
}

func (meter *Meter) Snapshot() Snapshot {
	return Snapshot{
		QueueSnapshot:      meter.intervals.snapshot(),
		DiscardedIntervals: meter.discardedIntervals.Load(),
		DroppedRecords:     meter.droppedRecords.Load(),
	}
}
