// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tunnel

import (
	"sync"
	"sync/atomic"

	"github.com/snapflowio/tunnel-go/transport"
)

type trackedStream struct {
	transport.Stream
	active  *atomic.Int32
	release func()
	once    sync.Once
}

func newTrackedStream(
	stream transport.Stream,
	active *atomic.Int32,
	release func(),
) transport.Stream {
	return &trackedStream{Stream: stream, active: active, release: release}
}

func (stream *trackedStream) Close() error {
	err := stream.Stream.Close()
	stream.once.Do(func() {
		stream.active.Add(-1)
		if stream.release != nil {
			stream.release()
		}
	})
	return err
}
