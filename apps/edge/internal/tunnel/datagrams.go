// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tunnel

import (
	"context"
	"time"

	"github.com/snapflowio/tunnel-go/dispatch"
	"github.com/snapflowio/tunnel-go/protocol"
)

func (registry *Registry) readDatagrams(
	ctx context.Context,
	session *machineSession,
	reassembler *protocol.Reassembler,
	dispatcher *dispatch.DatagramDispatcher,
) error {
	for {
		fragment, err := session.transport.ReceiveUDP(ctx)
		if err != nil {
			return err
		}
		if fragment.Direction != protocol.DatagramToEdge {
			continue
		}
		if !session.acknowledged.Load() ||
			!registry.routes.Load().AcceptsMachineDatagram(
				session.machineID,
				session.machineSessionGeneration,
				session.binding,
				fragment.BackendID,
				fragment.AssignmentGeneration,
				time.Now(),
			) {
			registry.bindingFenceRejections.Add(1)
			continue
		}
		payload, complete, err := reassembler.Add(fragment, time.Now())
		if err != nil {
			registry.logger.Debug(
				"discarded invalid Machine UDP fragment",
				"machine_id", session.machineID,
				"backend_id", fragment.BackendID,
				"error", err,
			)
			continue
		}
		if !complete {
			continue
		}
		if !dispatcher.Dispatch(dispatch.Datagram{
			BackendID:            fragment.BackendID,
			AssignmentGeneration: fragment.AssignmentGeneration,
			FlowID:               fragment.FlowID,
			Payload:              payload,
		}) {
			registry.datagrams.Dropped.Add(1)
		}
	}
}

func (registry *Registry) newDatagramDispatcher(
	ctx context.Context,
	session *machineSession,
) (*dispatch.DatagramDispatcher, error) {
	return dispatch.NewDatagramDispatcher(
		ctx,
		dispatch.DatagramDispatcherConfig{
			Stripes:        datagramDispatchStripes,
			QueueDepth:     datagramDispatchDepth,
			MaxQueuedBytes: datagramDispatchByteLimit,
		},
		func(handlerContext context.Context, datagram dispatch.Datagram) error {
			err := registry.receiver.HandleMachineDatagram(
				handlerContext,
				session.machineID,
				datagram.BackendID,
				datagram.FlowID,
				datagram.Payload,
			)
			if err == nil {
				registry.datagrams.Delivered.Add(1)
			}
			return err
		},
		func(datagram dispatch.Datagram, err error) {
			registry.datagrams.Failed.Add(1)
			registry.logger.Debug(
				"could not deliver Machine UDP datagram",
				"machine_id", session.machineID,
				"backend_id", datagram.BackendID,
				"error", err,
			)
		},
	)
}
