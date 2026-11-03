// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package pty

import (
	"fmt"

	cmap "github.com/orcaman/concurrent-map/v2"
)

func NewPTYManager() *PTYManager {
	return &PTYManager{sessions: cmap.New[*PTYSession]()}
}

func (m *PTYManager) Add(s *PTYSession) bool {
	return m.sessions.SetIfAbsent(s.info.ID, s)
}

func (m *PTYManager) Get(id string) (*PTYSession, bool) {
	return m.sessions.Get(id)
}

func (m *PTYManager) Delete(id string) (*PTYSession, bool) {
	return m.sessions.Pop(id)
}

func (m *PTYManager) List() []PTYSessionInfo {
	out := make([]PTYSessionInfo, 0, m.sessions.Count())
	for _, s := range m.sessions.Items() {
		out = append(out, s.Info())
	}
	return out
}

func (m *PTYManager) VerifyPTYSessionReady(id string) (*PTYSession, error) {
	session, ok := m.Get(id)
	if !ok {
		return nil, fmt.Errorf("PTY session %s not found", id)
	}
	info := session.Info()
	if info.Active {
		return session, nil
	}
	if !info.LazyStart {
		return nil, fmt.Errorf("PTY session '%s' has terminated and is no longer available", id)
	}
	if err := session.start(); err != nil {
		return nil, fmt.Errorf("failed to start PTY session: %w", err)
	}
	return session, nil
}

func (m *PTYManager) VerifyPTYSessionForResize(id string) (*PTYSession, error) {
	session, ok := m.Get(id)
	if !ok {
		return nil, fmt.Errorf("PTY session %s not found", id)
	}
	info := session.Info()
	if !info.Active && !info.LazyStart {
		return nil, fmt.Errorf("PTY session '%s' has terminated and cannot be resized", id)
	}
	return session, nil
}
