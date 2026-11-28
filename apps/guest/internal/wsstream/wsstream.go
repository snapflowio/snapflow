// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package wsstream

import (
	"errors"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

const controlWriteTimeout = time.Second

func Upgrade(writer http.ResponseWriter, request *http.Request) (*websocket.Conn, error) {
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}
	return upgrader.Upgrade(writer, request, nil)
}

func ReadInbound(conn *websocket.Conn, ignore func(messageType int, payload []byte)) <-chan error {
	closed := make(chan error, 1)
	go func() {
		for {
			messageType, payload, err := conn.ReadMessage()
			if err != nil {
				closed <- err
				return
			}
			ignore(messageType, payload)
		}
	}()
	return closed
}

func Close(conn *websocket.Conn, code int, reason string) error {
	message := websocket.FormatCloseMessage(code, reason)
	writeErr := conn.WriteControl(websocket.CloseMessage, message, time.Now().Add(controlWriteTimeout))
	if errors.Is(writeErr, websocket.ErrCloseSent) {
		writeErr = nil
	}
	return errors.Join(writeErr, conn.Close())
}
