// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package passthrough

import (
	"bytes"
	"io"
	"net"
)

type replayConn struct {
	net.Conn
	reader io.Reader
}

func newReplayConn(connection net.Conn, consumed []byte) net.Conn {
	if len(consumed) == 0 {
		return connection
	}
	return &replayConn{
		Conn:   connection,
		reader: io.MultiReader(bytes.NewReader(bytes.Clone(consumed)), connection),
	}
}

func (connection *replayConn) Read(buffer []byte) (int, error) {
	return connection.reader.Read(buffer)
}

func (connection *replayConn) NetConn() net.Conn {
	return connection.Conn
}
