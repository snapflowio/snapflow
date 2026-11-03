// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package pty

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

func (s *PTYSession) attachWebSocket(ws *websocket.Conn) {
	cl := &wsClient{
		id:     uuid.NewString(),
		conn:   ws,
		logger: s.logger,
		send:   make(chan []byte, clientSendCapacity),
		done:   make(chan struct{}),
	}

	s.clients.Set(cl.id, cl)
	count := s.clients.Count()
	s.logger.Debug("Client attached to PTY session", "clientId", cl.id, "sessionId", s.info.ID, "clientCount", count)

	go s.clientWriter(cl)

	successMsg := map[string]interface{}{
		"type":   "control",
		"status": "connected",
	}
	successJSON, err := json.Marshal(successMsg)
	if err != nil {
		s.logger.Error("failed to serialize PTY connection message", "error", err)
	} else if err := cl.writeMessage(websocket.TextMessage, successJSON); err != nil {
		s.logger.Debug("failed to send PTY connection message", "error", err)
	}

	s.clientReader(cl)

	s.clients.Remove(cl.id)

	cl.close()

	remaining := s.clients.Count()
	s.logger.Debug("Client detached from PTY session", "clientId", cl.id, "sessionId", s.info.ID, "clientCount", remaining)
}

func (s *PTYSession) clientWriter(cl *wsClient) {
	s.mu.Lock()
	stopped := s.stopped
	s.mu.Unlock()
	for {
		select {
		case <-stopped:
			return
		case <-cl.done:
			return
		case b := <-cl.send:
			cl.writeMu.Lock()
			err := cl.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err == nil {
				err = cl.conn.WriteMessage(websocket.BinaryMessage, b)
			}
			cl.writeMu.Unlock()
			if err != nil {
				return
			}
		}
	}
}

func (s *PTYSession) clientReader(cl *wsClient) {
	conn := cl.conn
	conn.SetReadLimit(readLimit)

	for {
		messageType, data, err := conn.ReadMessage()
		if err != nil {
			if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				s.logger.Debug("ws read error", "error", err)
			}
			return
		}
		if messageType != websocket.TextMessage && messageType != websocket.BinaryMessage {
			continue
		}
		if err := s.sendToPTY(data); err != nil {
			if writeErr := cl.writeMessage(websocket.CloseMessage, websocket.FormatCloseMessage(
				websocket.CloseInternalServerErr, "PTY session unavailable",
			)); writeErr != nil {
				s.logger.Debug("failed to send PTY unavailable message", "error", writeErr)
			}
			return
		}
	}
}

func (s *PTYSession) broadcast(b []byte) {
	s.clientsMu.RLock()
	for id, cl := range s.clients.Items() {
		select {
		case cl.send <- b:
		case <-cl.done:
		default:
			go func(id string, cl *wsClient) {
				if err := cl.writeMessage(websocket.CloseMessage, websocket.FormatCloseMessage(
					websocket.ClosePolicyViolation, "slow consumer",
				)); err != nil {
					s.logger.Debug("failed to close slow PTY consumer", "clientId", id, "error", err)
				}
				cl.close()
			}(id, cl)
		}
	}
	s.clientsMu.RUnlock()
}

func (s *PTYSession) closeClientsWithExitCode(exitCode int) {
	wsCloseCode := websocket.CloseInternalServerErr
	var exitReasonStr *string
	if exitCode == 0 {
		wsCloseCode = websocket.CloseNormalClosure
	} else {
		reason := exitReason(exitCode)
		exitReasonStr = &reason
	}

	type CloseData struct {
		ExitCode   int     `json:"exitCode"`
		ExitReason *string `json:"exitReason,omitempty"`
	}

	closeData := CloseData{
		ExitCode:   exitCode,
		ExitReason: exitReasonStr,
	}

	closeJSON, err := json.Marshal(closeData)
	if err != nil {
		s.logger.Error("failed to serialize PTY close message", "error", err)
		return
	}

	s.clientsMu.Lock()
	for id, cl := range s.clients.Items() {
		if err := cl.writeMessage(websocket.CloseMessage, websocket.FormatCloseMessage(
			wsCloseCode, string(closeJSON),
		)); err != nil {
			s.logger.Debug("failed to send PTY close message", "clientId", id, "error", err)
		}
		cl.close()
		s.clients.Remove(id)
	}
	s.clientsMu.Unlock()
}
