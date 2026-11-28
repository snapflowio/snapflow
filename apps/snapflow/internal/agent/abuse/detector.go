// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package abuse

import (
	"fmt"
	"math"

	"github.com/snapflowio/microvm-go/types"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

type trafficDelta struct {
	egress      uint64
	ingress     uint64
	hostIngress uint64
}

type history struct {
	previous types.AbuseSample
	cpu      []float64
	traffic  []trafficDelta
	streaks  map[apiclient.AbuseSignalKind]int
}

type counterRule struct {
	kind      apiclient.AbuseSignalKind
	count     func(types.GuardCounters) uint64
	minimum   uint64
	hard      uint64
	sustained bool
	detail    string
}

func counterRules() []counterRule {
	return []counterRule{
		{
			kind: apiclient.AbuseSignalKindMiningPoolConnection, count: func(c types.GuardCounters) uint64 { return c.PoolBlocked },
			minimum: 1, hard: 1, detail: "%d packets to known mining pool addresses were dropped",
		},
		{
			kind: apiclient.AbuseSignalKindSmtpAttempts, count: func(c types.GuardCounters) uint64 { return c.SMTPBlocked },
			minimum: 1, hard: massSMTPAttempts, detail: "%d outbound mail connections were refused",
		},
		{
			kind: apiclient.AbuseSignalKindBruteForce, count: func(c types.GuardCounters) uint64 { return c.BruteForce },
			minimum: 1, detail: "%d login-port connections exceeded the per-target rate",
		},
		{
			kind: apiclient.AbuseSignalKindReflectionAttempts, count: func(c types.GuardCounters) uint64 { return c.ReflectionBlocked },
			minimum: reflectionAttemptsPerWindow, detail: "%d packets to reflection-prone UDP services were dropped",
		},
		{kind: apiclient.AbuseSignalKindConnectionFlood, count: func(c types.GuardCounters) uint64 {
			return c.NewConnectionLimited + c.DestinationLimited + c.ConnectionCapped + c.UDPLimited
		}, minimum: floodDropsPerWindow, sustained: true, detail: "%d new connections exceeded the connection limits"},
		{
			kind: apiclient.AbuseSignalKindPacketFlood, count: func(c types.GuardCounters) uint64 { return c.PacketsLimited + c.ICMPLimited },
			minimum: packetFloodDropsPerWindow, sustained: true, detail: "%d packets exceeded the packet rate limits",
		},
	}
}

func newHistory(sample types.AbuseSample) *history {
	return &history{previous: sample, streaks: make(map[apiclient.AbuseSignalKind]int)}
}

func (h *history) evaluate(sample types.AbuseSample) []apiclient.MachineAbuseFinding {
	previous := h.previous
	h.previous = sample
	counters := counterDeltas(sample.Guard.Counters, previous.Guard.Counters)
	var findings []apiclient.MachineAbuseFinding
	for _, rule := range counterRules() {
		count := rule.count(counters)
		if count < rule.minimum {
			delete(h.streaks, rule.kind)
			continue
		}
		h.streaks[rule.kind]++
		if rule.sustained && h.streaks[rule.kind] < sustainedWindows {
			continue
		}
		severity := apiclient.AbuseSignalSeveritySoft
		if rule.hard > 0 && count >= rule.hard {
			severity = apiclient.AbuseSignalSeverityHard
		}
		findings = append(findings, finding(rule.kind, severity, count, fmt.Sprintf(rule.detail, count)))
	}
	if hits := delta(sample.Guard.StratumHits, previous.Guard.StratumHits); hits > 0 {
		findings = append(findings, finding(apiclient.AbuseSignalKindStratumHandshake, apiclient.AbuseSignalSeverityHard,
			hits, fmt.Sprintf("%d mining protocol handshakes were blocked", hits)))
	}
	if queries := delta(sample.Guard.Resolver.BlockedQueries, previous.Guard.Resolver.BlockedQueries); queries > 0 {
		findings = append(findings, finding(apiclient.AbuseSignalKindMiningPoolDns, apiclient.AbuseSignalSeveritySoft,
			queries, fmt.Sprintf("%d lookups of mining pool domains were refused", queries)))
	}
	findings = append(findings, scanFindings(sample.Guard.Endpoints, counters)...)
	findings = append(findings, h.profileFindings(sample, previous)...)
	return findings
}

func scanFindings(endpoints types.EndpointSummary, counters types.GuardCounters) []apiclient.MachineAbuseFinding {
	var findings []apiclient.MachineAbuseFinding
	switch {
	case endpoints.Saturated:
		findings = append(findings, finding(apiclient.AbuseSignalKindHorizontalScan, apiclient.AbuseSignalSeverityHard,
			uint64(endpoints.Endpoints), fmt.Sprintf("the sandbox reached %d distinct endpoints in one minute", endpoints.Endpoints)))
	case endpoints.NonWebDestinations > horizontalScanDestinations:
		findings = append(findings, finding(apiclient.AbuseSignalKindHorizontalScan, apiclient.AbuseSignalSeveritySoft,
			uint64(endpoints.NonWebDestinations),
			fmt.Sprintf("the sandbox contacted %d distinct hosts on non-web ports in one minute", endpoints.NonWebDestinations)))
	}
	if endpoints.MaxPortsPerDestination > verticalScanPorts {
		findings = append(findings, finding(apiclient.AbuseSignalKindVerticalScan, apiclient.AbuseSignalSeveritySoft,
			uint64(endpoints.MaxPortsPerDestination),
			fmt.Sprintf("the sandbox probed %d ports on one host in one minute", endpoints.MaxPortsPerDestination)))
	}
	attemptsPerMinute := counters.TCPAttempts * secondsPerMinute / uint64(Window.Seconds())
	if attemptsPerMinute > failedConnectionsPerMinute &&
		float64(counters.TCPRefused) > failedConnectionRatio*float64(counters.TCPAttempts) {
		findings = append(findings, finding(apiclient.AbuseSignalKindFailedConnections, apiclient.AbuseSignalSeveritySoft,
			counters.TCPRefused, fmt.Sprintf("%d of %d connection attempts were refused", counters.TCPRefused, counters.TCPAttempts)))
	}
	return findings
}

func (h *history) profileFindings(sample, previous types.AbuseSample) []apiclient.MachineAbuseFinding {
	traffic := trafficDelta{
		egress:      delta(sample.InternetEgressBytes, previous.InternetEgressBytes),
		ingress:     delta(sample.InternetIngressBytes, previous.InternetIngressBytes),
		hostIngress: delta(sample.HostIngressBytes, previous.HostIngressBytes),
	}
	h.traffic = appendBounded(h.traffic, traffic, proxyHistoryWindows)
	var findings []apiclient.MachineAbuseFinding
	if utilization, ok := cpuUtilization(sample, previous); ok {
		h.cpu = appendBounded(h.cpu, utilization, miningProfileWindows)
		if h.miningProfile(traffic, sample.Guard.Endpoints) {
			findings = append(findings, finding(apiclient.AbuseSignalKindMiningProfile, apiclient.AbuseSignalSeveritySoft, 1,
				fmt.Sprintf("every vCPU stayed near %.0f%% for %d windows while holding %d low-traffic connections to mining ports",
					utilization*percentScale, len(h.cpu), sample.Guard.Endpoints.MiningPortFlows)))
		}
	} else {
		h.cpu = nil
	}
	if domains := sample.Guard.Resolver.DistinctDomains; domains > proxyDistinctDomains && h.proxyRelay() {
		findings = append(findings, finding(apiclient.AbuseSignalKindProxyRelay, apiclient.AbuseSignalSeveritySoft, uint64(domains),
			fmt.Sprintf("the sandbox resolved %d unrelated sites in an hour while relaying balanced traffic", domains)))
	}
	return findings
}

func (h *history) miningProfile(traffic trafficDelta, endpoints types.EndpointSummary) bool {
	if len(h.cpu) < miningProfileWindows || traffic.egress+traffic.ingress > miningMaximumTrafficBytes ||
		endpoints.MiningPortFlows < miningMinimumPortFlows {
		return false
	}
	var sum float64
	for _, value := range h.cpu {
		if value < miningCPUUtilization {
			return false
		}
		sum += value
	}
	mean := sum / float64(len(h.cpu))
	var variance float64
	for _, value := range h.cpu {
		variance += (value - mean) * (value - mean)
	}
	return math.Sqrt(variance/float64(len(h.cpu))) <= miningCPUDeviation
}

func (h *history) proxyRelay() bool {
	var total trafficDelta
	for _, window := range h.traffic {
		total.egress += window.egress
		total.ingress += window.ingress
		total.hostIngress += window.hostIngress
	}
	if total.egress+total.ingress < proxyMinimumHourlyBytes || total.ingress == 0 {
		return false
	}
	balance := float64(total.egress) / float64(total.ingress)
	return balance >= proxyBalanceLow && balance <= proxyBalanceHigh &&
		float64(total.hostIngress) <= proxyMaximumHostIngressShare*float64(total.ingress)
}

func cpuUtilization(sample, previous types.AbuseSample) (float64, bool) {
	elapsed := sample.SampledAt.Sub(previous.SampledAt).Microseconds()
	if !sample.Running || !previous.Running || sample.VCPUs <= 0 || elapsed <= 0 || sample.CPUUsageMicros < previous.CPUUsageMicros {
		return 0, false
	}
	return float64(sample.CPUUsageMicros-previous.CPUUsageMicros) / float64(elapsed*sample.VCPUs), true
}

func counterDeltas(current, previous types.GuardCounters) types.GuardCounters {
	return types.GuardCounters{
		PacketsLimited:       delta(current.PacketsLimited, previous.PacketsLimited),
		NewConnectionLimited: delta(current.NewConnectionLimited, previous.NewConnectionLimited),
		DestinationLimited:   delta(current.DestinationLimited, previous.DestinationLimited),
		ConnectionCapped:     delta(current.ConnectionCapped, previous.ConnectionCapped),
		UDPLimited:           delta(current.UDPLimited, previous.UDPLimited),
		ICMPLimited:          delta(current.ICMPLimited, previous.ICMPLimited),
		SMTPBlocked:          delta(current.SMTPBlocked, previous.SMTPBlocked),
		DoTBlocked:           delta(current.DoTBlocked, previous.DoTBlocked),
		PoolBlocked:          delta(current.PoolBlocked, previous.PoolBlocked),
		ReflectionBlocked:    delta(current.ReflectionBlocked, previous.ReflectionBlocked),
		BruteForce:           delta(current.BruteForce, previous.BruteForce),
		TCPAttempts:          delta(current.TCPAttempts, previous.TCPAttempts),
		TCPRefused:           delta(current.TCPRefused, previous.TCPRefused),
	}
}

func delta(current, previous uint64) uint64 {
	if current < previous {
		return current
	}
	return current - previous
}

func appendBounded[T any](values []T, value T, limit int) []T {
	values = append(values, value)
	if len(values) > limit {
		values = values[len(values)-limit:]
	}
	return values
}

func finding(kind apiclient.AbuseSignalKind, severity apiclient.AbuseSignalSeverity, count uint64, detail string) apiclient.MachineAbuseFinding {
	return apiclient.MachineAbuseFinding{Kind: kind, Severity: severity, Count: int(min(count, math.MaxInt32)), Detail: detail}
}
