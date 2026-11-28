// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package interpreter

import (
	"encoding/json"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/snapflowio/guest/internal/wsstream"
)

func (c *Context) attachWebSocket(ws *websocket.Conn) {
	clientID := uuid.NewString()
	client := &wsClient{
		id:     clientID,
		conn:   ws,
		send:   make(chan wsFrame, clientSendCapacity),
		done:   make(chan struct{}),
		logger: c.logger.With(slog.String("clientId", clientID)),
	}

	c.mu.Lock()
	previous := c.client
	c.client = client
	c.mu.Unlock()
	if previous != nil {
		previous.close()
	}

	c.logger.Debug("Client attached to interpreter context", "clientId", client.id, "contextId", c.info.ID)
	go client.writeLoop()
	go func() {
		readErr := <-wsstream.ReadInbound(ws, func(messageType int, payload []byte) {
			client.logger.Debug("Ignored inbound interpreter WebSocket message", "messageType", messageType, "bytes", len(payload))
		})
		client.logger.Debug("Interpreter WebSocket read ended", "error", readErr)
		client.close()
	}()
	go func() {
		<-client.done
		c.mu.Lock()
		if c.client == client {
			c.client = nil
		}
		c.mu.Unlock()
		c.logger.Debug("Client detached from interpreter context", "clientId", client.id, "contextId", c.info.ID)
	}()
}

func (c *Context) emitOutput(message *OutputMessage) {
	c.mu.Lock()
	client := c.client
	c.mu.Unlock()
	if client == nil {
		return
	}
	select {
	case client.send <- wsFrame{output: message}:
	case <-client.done:
	default:
		c.logger.Debug("Client send channel full - closing slow consumer")
		c.mu.Lock()
		if c.client == client {
			c.client = nil
		}
		c.mu.Unlock()
		client.requestClose(websocket.ClosePolicyViolation, "slow consumer")
	}
}

func (cl *wsClient) writeLoop() {
	defer cl.close()
	for {
		select {
		case <-cl.done:
			return
		case frame := <-cl.send:
			if err := cl.writeFrame(frame); err != nil {
				cl.logger.Debug("Failed to write frame", "error", err)
				return
			}
			if frame.close != nil {
				return
			}
		}
	}
}

func (cl *wsClient) close() {
	cl.closeOnce.Do(func() {
		close(cl.done)
		if err := cl.conn.Close(); err != nil {
			cl.logger.Debug("failed to close interpreter WebSocket", "error", err)
		}
	})
}

func (cl *wsClient) writeFrame(frame wsFrame) error {
	if err := cl.conn.SetWriteDeadline(time.Now().Add(writeWait)); err != nil {
		return err
	}
	if frame.close != nil {
		return cl.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(frame.close.code, frame.close.message))
	}
	data, err := json.Marshal(frame.output)
	if err != nil {
		return err
	}
	return cl.conn.WriteMessage(websocket.TextMessage, data)
}

func (cl *wsClient) requestClose(code int, message string) {
	select {
	case cl.send <- wsFrame{close: &closeRequest{code: code, message: message}}:
	case <-cl.done:
	default:
		cl.logger.Debug("Couldn't send close frame to client - closing connection")
		cl.close()
	}
}
