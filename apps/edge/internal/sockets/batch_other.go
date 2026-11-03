// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build !linux

package sockets

import (
	"io"
	"net"

	"github.com/snapflowio/tunnel-go/protocol"
)

type BatchConn struct {
	socket  *net.UDPConn
	buffer  []byte
	packets [1]Packet
}

func NewBatchConn(socket *net.UDPConn) (*BatchConn, error) {
	return &BatchConn{
		socket: socket,
		buffer: make([]byte, protocol.MaxUDPApplicationPayloadBytes+1),
	}, nil
}

func (connection *BatchConn) ReadBatch() ([]Packet, error) {
	read, peer, err := connection.socket.ReadFromUDP(connection.buffer)
	if err != nil {
		return nil, err
	}
	connection.packets[0] = Packet{
		Payload: connection.buffer[:read],
		Peer:    *peer,
	}
	return connection.packets[:], nil
}

func (connection *BatchConn) WriteBatch(packets []Packet) (int, error) {
	for index := range packets {
		written, err := connection.socket.WriteToUDP(
			packets[index].Payload,
			&packets[index].Peer,
		)
		if err != nil {
			return index, err
		}
		if written != len(packets[index].Payload) {
			return index, io.ErrShortWrite
		}
	}
	return len(packets), nil
}
