// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build !linux

package sockets

import "net"

type kernelStats struct {
	receiveQueueBytes uint64
	drops             uint64
}

func socketInode(*net.UDPConn) (uint64, error) {
	return 0, nil
}

func readKernelStats(
	map[uint64]struct{},
) (map[uint64]kernelStats, error) {
	return map[uint64]kernelStats{}, nil
}
