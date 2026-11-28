// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build linux

package sockets

import (
	"errors"
	"net"

	"github.com/snapflowio/tunnel-go/protocol"
	"golang.org/x/net/ipv4"
	"golang.org/x/net/ipv6"
)

type xnetBatchConn interface {
	ReadBatch([]ipv6.Message, int) (int, error)
	WriteBatch([]ipv6.Message, int) (int, error)
}

type BatchConn struct {
	conn          xnetBatchConn
	readMessages  []ipv6.Message
	readPackets   []Packet
	writeMessages []ipv6.Message
}

func NewBatchConn(socket *net.UDPConn) (*BatchConn, error) {
	local, valid := socket.LocalAddr().(*net.UDPAddr)
	if !valid {
		return nil, errors.New("machine UDP socket has an invalid local address")
	}
	var batch xnetBatchConn
	if local.IP.To4() != nil {
		batch = ipv4.NewPacketConn(socket)
	} else {
		batch = ipv6.NewPacketConn(socket)
	}
	readMessages := make([]ipv6.Message, BatchSize)
	writeMessages := make([]ipv6.Message, BatchSize)
	for index := range readMessages {
		readMessages[index].Buffers = [][]byte{
			make([]byte, protocol.MaxUDPApplicationPayloadBytes+1),
		}
		writeMessages[index].Buffers = make([][]byte, 1)
	}
	return &BatchConn{
		conn:          batch,
		readMessages:  readMessages,
		readPackets:   make([]Packet, BatchSize),
		writeMessages: writeMessages,
	}, nil
}

func (connection *BatchConn) ReadBatch() ([]Packet, error) {
	for index := range connection.readMessages {
		message := &connection.readMessages[index]
		message.N = 0
		message.Addr = nil
		message.Buffers[0] = message.Buffers[0][:cap(message.Buffers[0])]
	}
	count, err := connection.conn.ReadBatch(connection.readMessages, 0)
	if err != nil {
		return nil, err
	}
	packets := connection.readPackets[:0]
	for index := range count {
		message := &connection.readMessages[index]
		peer, valid := message.Addr.(*net.UDPAddr)
		if !valid {
			continue
		}
		packets = append(packets, Packet{
			Payload: message.Buffers[0][:message.N],
			Peer:    *peer,
		})
	}
	return packets, nil
}

func (connection *BatchConn) WriteBatch(packets []Packet) (int, error) {
	if len(packets) > len(connection.writeMessages) {
		packets = packets[:len(connection.writeMessages)]
	}
	for index := range packets {
		message := &connection.writeMessages[index]
		message.Buffers[0] = packets[index].Payload
		message.Addr = &packets[index].Peer
	}
	return connection.conn.WriteBatch(
		connection.writeMessages[:len(packets)],
		0,
	)
}
