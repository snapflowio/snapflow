// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"encoding/binary"
	"fmt"
	"time"
)

// The GEMM helper writes, little-endian: a uint64 window count, then per window a
// uint64 GEMM count and a uint64 elapsed nanoseconds, then the FP32 product row-major.
const (
	gemmWindowCountBytes  = uint64Bytes
	gemmWindowRecordBytes = 2 * uint64Bytes
)

type gemmWindow struct {
	iterations uint64
	elapsed    time.Duration
}

func parseGEMMOutput(output []byte, dimension int) ([]gemmWindow, [][]byte, error) {
	if len(output) < gemmWindowCountBytes {
		return nil, nil, fmt.Errorf("the GEMM output of %d bytes has no window count", len(output))
	}
	count := binary.LittleEndian.Uint64(output)
	rowBytes := dimension * GEMMElementBytes
	headerBytes := gemmWindowCountBytes + count*gemmWindowRecordBytes
	if count > uint64(len(output)) || uint64(len(output)) != headerBytes+uint64(dimension*rowBytes) {
		return nil, nil, fmt.Errorf("the GEMM output of %d bytes does not hold %d windows and the product", len(output), count)
	}
	windows := make([]gemmWindow, count)
	for index := range windows {
		record := output[gemmWindowCountBytes+index*gemmWindowRecordBytes:]
		windows[index] = gemmWindow{
			iterations: binary.LittleEndian.Uint64(record),
			elapsed:    time.Duration(binary.LittleEndian.Uint64(record[uint64Bytes:])),
		}
	}
	rows := make([][]byte, dimension)
	for row := range rows {
		start := int(headerBytes) + row*rowBytes
		rows[row] = output[start : start+rowBytes]
	}
	return windows, rows, nil
}
