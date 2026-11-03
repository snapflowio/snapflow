// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package admit

import (
	"context"
	"net/netip"
	"sync/atomic"
	"time"
)

type Result uint8

const (
	ResultAllowed Result = iota + 1
	ResultRateLimited
	ResultCapacity
	ResultDraining
)

type Counters struct {
	HTTPRequestActive      int64
	HTTPConnectionActive   int64
	HTTPStreamActive       int64
	TCPActive              int64
	RateRejected           uint64
	CapacityRejected       uint64
	DrainRejected          uint64
	SourceEntries          int
	SourceEvictions        uint64
	HTTPRequestHeadroom    int64
	HTTPConnectionHeadroom int64
	HTTPStreamHeadroom     int64
	TCPHeadroom            int64
	UDPFlowHeadroom        int64
}

type Controller struct {
	httpRate *protocolRate
	tcpRate  *protocolRate
	udpRate  *protocolRate

	httpRequest    *scopeLimiter
	httpConnection *scopeLimiter
	httpStream     *scopeLimiter
	tcp            *scopeLimiter
	udpFlow        *scopeLimiter

	rateRejected     atomic.Uint64
	capacityRejected atomic.Uint64
	drainRejected    atomic.Uint64
	draining         atomic.Bool
	limits           Limits
}

func New(opts ...Option) (*Controller, error) {
	configured := options{limits: ProductionLimits()}
	for _, apply := range opts {
		apply(&configured)
	}
	limits := configured.limits
	if err := limits.validate(); err != nil {
		return nil, err
	}
	return &Controller{
		limits: limits,
		httpRate: newProtocolRate(
			limits.HTTPSourceEntries,
			limits.HTTPPerSourceRate,
			limits.HTTPPerSourceBurst,
			limits.HTTPGlobalRate,
			limits.HTTPGlobalBurst,
		),
		tcpRate: newProtocolRate(
			limits.TCPSourceEntries,
			limits.TCPPerSourceRate,
			limits.TCPPerSourceBurst,
			limits.TCPGlobalRate,
			limits.TCPGlobalBurst,
		),
		udpRate: newProtocolRate(
			limits.UDPSourceEntries,
			limits.UDPPerSourceRate,
			limits.UDPPerSourceBurst,
			limits.UDPGlobalRate,
			limits.UDPGlobalBurst,
		),
		httpRequest: newScopeLimiter(scopeLimits{
			global:             limits.HTTPRequests,
			interactiveReserve: limits.HTTPRequestsInteractiveReserve,
			perSource:          limits.HTTPRequestsPerSource,
			perOwner:           limits.HTTPRequestsPerOwner,
			perRoute:           limits.HTTPRequestsPerRoute,
			perBinding:         limits.HTTPRequestsPerBinding,
		}),
		httpConnection: newScopeLimiter(scopeLimits{
			global:     limits.HTTPConnections,
			perSource:  limits.HTTPConnectionsPerSource,
			perOwner:   limits.HTTPConnections,
			perRoute:   limits.HTTPConnections,
			perBinding: limits.HTTPConnections,
		}),
		httpStream: newScopeLimiter(scopeLimits{
			global:             limits.HTTPStreams,
			interactiveReserve: limits.HTTPStreamsInteractiveReserve,
			perSource:          limits.HTTPStreamsPerSource,
			perOwner:           limits.HTTPStreamsPerOwner,
			perRoute:           limits.HTTPStreamsPerRoute,
			perBinding:         limits.HTTPStreamsPerBinding,
		}),
		tcp: newScopeLimiter(scopeLimits{
			global:     limits.TCPConnections,
			perSource:  limits.TCPPerSource,
			perOwner:   limits.TCPPerOwner,
			perRoute:   limits.TCPPerRoute,
			perBinding: limits.TCPPerBinding,
		}),
		udpFlow: newScopeLimiter(scopeLimits{
			global:     limits.UDPFlows,
			perSource:  limits.UDPFlowsPerSource,
			perOwner:   limits.UDPFlowsPerOwner,
			perRoute:   limits.UDPFlowsPerRoute,
			perBinding: limits.UDPFlowsPerBinding,
		}),
	}, nil
}

func (controller *Controller) Run(ctx context.Context) error {
	ticker := time.NewTicker(pruneInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case now := <-ticker.C:
			controller.httpRate.prune(now)
			controller.tcpRate.prune(now)
			controller.udpRate.prune(now)
		}
	}
}

func (controller *Controller) BeginDrain() {
	controller.draining.Store(true)
}

func (controller *Controller) IsDraining() bool {
	return controller.draining.Load()
}

func (controller *Controller) AdmitHTTP(
	source netip.Addr,
	scope Scope,
	streaming bool,
) (*Permit, Result) {
	limiter := controller.httpRequest
	if streaming {
		limiter = controller.httpStream
	}
	return controller.admit(controller.httpRate, limiter, source, scope)
}

func (controller *Controller) AdmitHTTPConnection(
	source netip.Addr,
) (*Permit, Result) {
	return controller.admit(nil, controller.httpConnection, source, Scope{})
}

func (controller *Controller) AdmitTCP(
	source netip.Addr,
	scope Scope,
) (*Permit, Result) {
	return controller.admit(controller.tcpRate, controller.tcp, source, scope)
}

func (controller *Controller) AllowUDP(source netip.Addr, newFlow bool) Result {
	if newFlow && controller.rejectWhileDraining() {
		return ResultDraining
	}
	if !controller.udpRate.allow(source.Unmap(), time.Now()) {
		controller.rateRejected.Add(1)
		return ResultRateLimited
	}
	return ResultAllowed
}

func (controller *Controller) AdmitUDPFlow(
	source netip.Addr,
	scope Scope,
) (*Permit, Result) {
	return controller.admit(nil, controller.udpFlow, source, scope)
}

func (controller *Controller) admit(
	rate *protocolRate,
	limiter *scopeLimiter,
	source netip.Addr,
	scope Scope,
) (*Permit, Result) {
	if controller.rejectWhileDraining() {
		return nil, ResultDraining
	}
	source = source.Unmap()
	if rate != nil && !rate.allow(source, time.Now()) {
		controller.rateRejected.Add(1)
		return nil, ResultRateLimited
	}
	permit, admitted := limiter.acquire(source, scope)
	if !admitted {
		controller.capacityRejected.Add(1)
		return nil, ResultCapacity
	}
	return permit, ResultAllowed
}

func (controller *Controller) rejectWhileDraining() bool {
	if !controller.draining.Load() {
		return false
	}
	controller.drainRejected.Add(1)
	return true
}

func (controller *Controller) Snapshot() Counters {
	return Counters{
		HTTPRequestActive:      controller.httpRequest.active.Load(),
		HTTPConnectionActive:   controller.httpConnection.active.Load(),
		HTTPStreamActive:       controller.httpStream.active.Load(),
		TCPActive:              controller.tcp.active.Load(),
		RateRejected:           controller.rateRejected.Load(),
		CapacityRejected:       controller.capacityRejected.Load(),
		DrainRejected:          controller.drainRejected.Load(),
		SourceEntries:          controller.httpRate.size() + controller.tcpRate.size() + controller.udpRate.size(),
		SourceEvictions:        controller.httpRate.evictions() + controller.tcpRate.evictions() + controller.udpRate.evictions(),
		HTTPRequestHeadroom:    controller.httpRequest.headroom(controller.limits.HTTPRequests),
		HTTPConnectionHeadroom: controller.httpConnection.headroom(controller.limits.HTTPConnections),
		HTTPStreamHeadroom:     controller.httpStream.headroom(controller.limits.HTTPStreams),
		TCPHeadroom:            controller.tcp.headroom(controller.limits.TCPConnections),
		UDPFlowHeadroom:        controller.udpFlow.headroom(controller.limits.UDPFlows),
	}
}
