// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"github.com/snapflowio/edge/internal/proxy"
	"github.com/snapflowio/edge/internal/proxy/udp"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/tunnel"
)

type tunnelStatus interface {
	SessionCount() int32
	SessionHeadroom() int32
	BindingAcknowledgements() []tunnel.BindingAcknowledgement
	BindingAcknowledgementChanges() <-chan struct{}
	DatagramCounters() tunnel.DatagramCounters
	TunnelCounters() tunnel.TunnelCounters
}

type Tunnels interface {
	Component
	proxy.Streams
	udp.Sender
	tunnelStatus
	BeginDrain()
	BackendLoad(route routes.Base) (int64, bool)
}
