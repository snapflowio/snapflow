// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build linux

package sockets

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"strconv"
	"strings"

	"golang.org/x/sys/unix"
)

const (
	udpSocketTablePath          = "/proc/net/udp"
	udp6SocketTablePath         = "/proc/net/udp6"
	socketTableMinimumFields    = 13
	socketTableQueuesField      = 4
	socketTableInodeField       = 9
	socketTableInodeHeader      = "inode"
	socketTableQueueSeparator   = ":"
	socketTableQueueParts       = 2
	socketTableReceiveQueuePart = 1
	decimalBase                 = 10
	hexadecimalBase             = 16
	counterBits                 = 64
)

type kernelStats struct {
	receiveQueueBytes uint64
	drops             uint64
}

func socketInode(socket *net.UDPConn) (uint64, error) {
	raw, err := socket.SyscallConn()
	if err != nil {
		return 0, fmt.Errorf("access UDP socket: %w", err)
	}
	var stat unix.Stat_t
	var statErr error
	if err := raw.Control(func(fileDescriptor uintptr) {
		statErr = unix.Fstat(int(fileDescriptor), &stat)
	}); err != nil {
		return 0, fmt.Errorf("inspect UDP socket inode: %w", err)
	}
	if statErr != nil {
		return 0, fmt.Errorf("inspect UDP socket inode: %w", statErr)
	}
	return stat.Ino, nil
}

func readKernelStats(
	inodes map[uint64]struct{},
) (map[uint64]kernelStats, error) {
	result := make(map[uint64]kernelStats, len(inodes))
	for _, path := range [...]string{udpSocketTablePath, udp6SocketTablePath} {
		file, err := os.Open(path)
		if err != nil {
			return nil, fmt.Errorf("open %s: %w", path, err)
		}
		scanErr := scanKernelStats(file, inodes, result)
		closeErr := file.Close()
		if scanErr != nil || closeErr != nil {
			return nil, errors.Join(scanErr, closeErr)
		}
	}
	return result, nil
}

func scanKernelStats(
	reader io.Reader,
	inodes map[uint64]struct{},
	result map[uint64]kernelStats,
) error {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < socketTableMinimumFields || fields[socketTableInodeField] == socketTableInodeHeader {
			continue
		}
		inode, err := strconv.ParseUint(fields[socketTableInodeField], decimalBase, counterBits)
		if err != nil {
			continue
		}
		if _, wanted := inodes[inode]; !wanted {
			continue
		}
		queues := strings.SplitN(fields[socketTableQueuesField], socketTableQueueSeparator, socketTableQueueParts)
		if len(queues) != socketTableQueueParts {
			return fmt.Errorf("parse UDP queues for inode %d", inode)
		}
		receiveQueue, err := strconv.ParseUint(queues[socketTableReceiveQueuePart], hexadecimalBase, counterBits)
		if err != nil {
			return fmt.Errorf("parse UDP receive queue for inode %d: %w", inode, err)
		}
		drops, err := strconv.ParseUint(fields[len(fields)-1], decimalBase, counterBits)
		if err != nil {
			return fmt.Errorf("parse UDP drops for inode %d: %w", inode, err)
		}
		result[inode] = kernelStats{
			receiveQueueBytes: receiveQueue,
			drops:             drops,
		}
	}
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("scan UDP socket stats: %w", err)
	}
	return nil
}
