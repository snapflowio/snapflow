// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build linux

package speedtest

import (
	"errors"
	"fmt"
	"syscall"

	"golang.org/x/sys/unix"
)

func readTCPStats(connection syscall.Conn) (tcpStats, error) {
	raw, err := connection.SyscallConn()
	if err != nil {
		return tcpStats{}, fmt.Errorf("access the speedtest socket: %w", err)
	}
	var info *unix.TCPInfo
	var infoErr error
	controlErr := raw.Control(func(fileDescriptor uintptr) {
		info, infoErr = unix.GetsockoptTCPInfo(int(fileDescriptor), unix.IPPROTO_TCP, unix.TCP_INFO)
	})
	if err := errors.Join(controlErr, infoErr); err != nil {
		return tcpStats{}, fmt.Errorf("read the speedtest TCP_INFO: %w", err)
	}
	return tcpStats{
		minRTTMicros:          info.Min_rtt,
		smoothedRTTMicros:     info.Rtt,
		rttVarianceMicros:     info.Rttvar,
		retransmittedSegments: uint64(info.Total_retrans),
		sentSegments:          uint64(info.Segs_out),
	}, nil
}
