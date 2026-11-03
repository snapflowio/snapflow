// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package interpreter

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
	common_errors "github.com/snapflowio/common-go/pkg/errors"
	"github.com/snapflowio/guest/internal/childreap"
)

type Manager struct {
	logger     *slog.Logger
	reaper     *childreap.Reaper
	defaultCwd string
	mu         sync.RWMutex
	contexts   map[string]*Context
}

func NewManager(logger *slog.Logger, reaper *childreap.Reaper, defaultCwd string) *Manager {
	return &Manager{logger: logger, reaper: reaper, defaultCwd: defaultCwd, contexts: make(map[string]*Context)}
}

func (m *Manager) Create(ctx context.Context, cwd, language string) (*Context, error) {
	return m.create(ctx, uuid.NewString(), cwd, language)
}

func (m *Manager) create(ctx context.Context, id, cwd, language string) (*Context, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.contexts[id]; exists {
		return nil, fmt.Errorf("context with ID '%s' already exists", id)
	}
	if language == "" {
		language = LanguagePython
	}
	if language != LanguagePython {
		return nil, fmt.Errorf("unsupported language: %s (only '%s' is supported)", language, LanguagePython)
	}
	if cwd == "" {
		cwd = m.defaultCwd
	}
	created := &Context{
		info:   ContextInfo{ID: id, Cwd: cwd, CreatedAt: time.Now(), Language: language},
		logger: m.logger.With(slog.String("context_id", id)),
		reaper: m.reaper,
	}
	if err := created.start(ctx); err != nil {
		return nil, fmt.Errorf("failed to start context: %w", err)
	}
	m.contexts[id] = created
	return created, nil
}

func (m *Manager) Get(ctx context.Context, id string) (*Context, error) {
	m.mu.RLock()
	found, exists := m.contexts[id]
	m.mu.RUnlock()
	if !exists {
		return nil, fmt.Errorf("context with ID '%s' not found", id)
	}
	if err := found.start(ctx); err != nil {
		return nil, fmt.Errorf("failed to restart context '%s': %w", id, err)
	}
	return found, nil
}

func (m *Manager) GetOrCreateDefault(ctx context.Context) (*Context, error) {
	m.mu.RLock()
	_, exists := m.contexts[defaultContextID]
	m.mu.RUnlock()
	if exists {
		return m.Get(ctx, defaultContextID)
	}
	return m.create(ctx, defaultContextID, m.defaultCwd, LanguagePython)
}

func (m *Manager) Delete(id string) error {
	m.mu.Lock()
	found, exists := m.contexts[id]
	delete(m.contexts, id)
	m.mu.Unlock()
	if !exists {
		return common_errors.NewNotFoundError(fmt.Errorf("context with ID '%s' not found", id))
	}
	found.shutdown()
	return nil
}

func (m *Manager) List() []ContextInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()
	contexts := make([]ContextInfo, 0, len(m.contexts))
	for _, found := range m.contexts {
		contexts = append(contexts, found.Info())
	}
	return contexts
}
