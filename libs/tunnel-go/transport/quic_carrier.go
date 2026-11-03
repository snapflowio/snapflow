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

package transport

import (
	"context"
	"crypto/tls"

	"github.com/quic-go/quic-go"
)

type quicCarrier struct {
	connection *quic.Conn
}

func (carrier *quicCarrier) openStream(ctx context.Context) (Stream, error) {
	return carrier.connection.OpenStreamSync(ctx)
}

func (carrier *quicCarrier) acceptStream(ctx context.Context) (Stream, error) {
	return carrier.connection.AcceptStream(ctx)
}

func (carrier *quicCarrier) sendDatagram(frame []byte) error {
	return carrier.connection.SendDatagram(frame)
}

func (carrier *quicCarrier) receiveDatagram(ctx context.Context) ([]byte, error) {
	return carrier.connection.ReceiveDatagram(ctx)
}

func (carrier *quicCarrier) close(code quic.ApplicationErrorCode, reason string) error {
	return carrier.connection.CloseWithError(code, reason)
}

func (carrier *quicCarrier) context() context.Context {
	return carrier.connection.Context()
}

func (carrier *quicCarrier) metrics() Metrics {
	stats := carrier.connection.ConnectionStats()
	return Metrics{
		MinimumRTT:      stats.MinRTT,
		LatestRTT:       stats.LatestRTT,
		SmoothedRTT:     stats.SmoothedRTT,
		RTTDeviation:    stats.MeanDeviation,
		BytesSent:       stats.BytesSent,
		BytesReceived:   stats.BytesReceived,
		PacketsSent:     stats.PacketsSent,
		PacketsReceived: stats.PacketsReceived,
		PacketsLost:     stats.PacketsLost,
	}
}

func (carrier *quicCarrier) tlsState() tls.ConnectionState {
	return carrier.connection.ConnectionState().TLS
}
