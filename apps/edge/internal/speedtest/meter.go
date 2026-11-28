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
}

func (reader meteredReader) Read(buffer []byte) (int, error) {
	read, err := reader.source.Read(buffer)
	reader.meter.add(read, time.Now())
	return read, err
}
