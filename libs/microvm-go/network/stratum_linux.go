// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

//go:build linux

package network

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync/atomic"

	"github.com/florianl/go-nfqueue/v2"
	"github.com/snapflowio/microvm-go/internal/netrules"
	"github.com/vishvananda/netns"
	"golang.org/x/sys/unix"
)

const (
	stratumQueue        = uint16(7)
	stratumMaxQueueLen  = 1024
	stratumCaptureBytes = 512
	ipv4VersionShift    = 4
	ipv4HeaderWordMask  = 0x0f
	tcpOffsetShift      = 4
	headerWordBytes     = 4
	tcpDataOffsetIndex  = 12
	ipv4Version         = 4
	hookContinue        = 0
)

func stratumMarkers() [][]byte {
	return [][]byte{
		[]byte(`"mining.subscribe"`),
		[]byte(`"mining.authorize"`),
		[]byte(`"mining.extranonce.subscribe"`),
		[]byte(`"method":"login"`),
		[]byte(`"method": "login"`),
		[]byte(`"method":"eth_submitLogin"`),
	}
}

type stratumInspector struct {
	queue  *nfqueue.Nfqueue
	cancel context.CancelFunc
	hits   atomic.Uint64
}

func startStratumInspector(parent context.Context, namespace string) (*stratumInspector, error) {
	ns, err := netns.GetFromName(namespace)
	if err != nil {
		return nil, fmt.Errorf("open network namespace %s: %w", namespace, err)
	}
	defer ns.Close()
	queue, err := nfqueue.Open(&nfqueue.Config{
		NetNS:        int(ns),
		NfQueue:      stratumQueue,
		MaxQueueLen:  stratumMaxQueueLen,
		MaxPacketLen: stratumCaptureBytes,
		Copymode:     nfqueue.NfQnlCopyPacket,
		AfFamily:     unix.AF_INET,
		Flags:        nfqueue.NfQaCfgFlagFailOpen,
	})
	if err != nil {
		return nil, fmt.Errorf("open stratum inspection queue in %s: %w", namespace, err)
	}
	ctx, cancel := context.WithCancel(context.WithoutCancel(parent))
	inspector := &stratumInspector{queue: queue, cancel: cancel}
	if err := queue.RegisterWithErrorFunc(ctx, inspector.inspect, inspector.failed(namespace)); err != nil {
		cancel()
		return nil, errors.Join(fmt.Errorf("register stratum inspection in %s: %w", namespace, err), queue.Close())
	}
	return inspector, nil
}

func (inspector *stratumInspector) inspect(attribute nfqueue.Attribute) int {
	if attribute.PacketID == nil {
		return hookContinue
	}
	verdict, mark := nfqueue.NfAccept, netrules.StratumMarkInspected
	if attribute.Payload != nil && carriesStratum(*attribute.Payload) {
		verdict, mark = nfqueue.NfDrop, netrules.StratumMarkInspected|netrules.StratumMarkMatched
		inspector.hits.Add(1)
	}
	if err := inspector.queue.SetVerdictWithOption(*attribute.PacketID, verdict, nfqueue.WithConnMark(mark)); err != nil {
		slog.Debug("could not return a stratum inspection verdict", "error", err)
	}
	return hookContinue
}

func (inspector *stratumInspector) failed(namespace string) nfqueue.ErrorFunc {
	return func(err error) int {
		slog.Debug("stratum inspection queue reported an error", "namespace", namespace, "error", err)
		return hookContinue
	}
}

func (inspector *stratumInspector) stop() error {
	inspector.cancel()
	if err := inspector.queue.Close(); err != nil {
		return fmt.Errorf("close stratum inspection queue: %w", err)
	}
	return nil
}

func carriesStratum(packet []byte) bool {
	payload := tcpPayload(packet)
	if len(payload) == 0 {
		return false
	}
	for _, marker := range stratumMarkers() {
		if bytes.Contains(payload, marker) {
			return true
		}
	}
	return false
}

func tcpPayload(packet []byte) []byte {
	if len(packet) == 0 || packet[0]>>ipv4VersionShift != ipv4Version {
		return nil
	}
	ipHeader := int(packet[0]&ipv4HeaderWordMask) * headerWordBytes
	if len(packet) <= ipHeader+tcpDataOffsetIndex {
		return nil
	}
	tcpHeader := int(packet[ipHeader+tcpDataOffsetIndex]>>tcpOffsetShift) * headerWordBytes
	start := ipHeader + tcpHeader
	if start >= len(packet) {
		return nil
	}
	return packet[start:]
}
