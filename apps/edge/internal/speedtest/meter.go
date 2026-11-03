// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package speedtest

import (
	"io"
	"time"
)

// meter counts every byte of a transfer and, separately, the bytes moved after
// the ramp, so throughput skips TCP slow start while audits still see the total.
type meter struct {
	rampEnd  time.Time
	total    uint64
	measured uint64
}

func (counter *meter) add(bytes int, at time.Time) {
	counter.total += uint64(bytes)
	if !at.Before(counter.rampEnd) {
		counter.measured += uint64(bytes)
	}
}

type meteredReader struct {
	source io.Reader
	meter  *meter
	now    func() time.Time
}

func (reader meteredReader) Read(buffer []byte) (int, error) {
	read, err := reader.source.Read(buffer)
	reader.meter.add(read, reader.now())
	return read, err
}
