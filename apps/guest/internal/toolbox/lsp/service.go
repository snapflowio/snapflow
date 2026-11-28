// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package lsp

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
)

type serverKey struct {
	languageID    string
	pathToProject string
}

type Service struct {
	logger  *slog.Logger
	mu      sync.Mutex
	servers map[serverKey]*languageServer
}

func NewService(logger *slog.Logger) *Service {
	return &Service{logger: logger, servers: make(map[serverKey]*languageServer)}
}

func (s *Service) server(languageID, pathToProject string) (*languageServer, error) {
	spec, supported := languageSpecs()[languageID]
	if !supported {
		return nil, fmt.Errorf("unsupported language: %s", languageID)
	}
	key := serverKey{languageID: languageID, pathToProject: pathToProject}
	s.mu.Lock()
	defer s.mu.Unlock()
	if existing, ok := s.servers[key]; ok {
		return existing, nil
	}
	created := newLanguageServer(languageID, spec, s.logger)
	s.servers[key] = created
	return created, nil
}

func (s *Service) Client(languageID, pathToProject string) (*Client, error) {
	server, err := s.server(languageID, pathToProject)
	if err != nil {
		return nil, err
	}
	return server.running()
}

func (s *Service) Start(ctx context.Context, languageID, pathToProject string) error {
	server, err := s.server(languageID, pathToProject)
	if err != nil {
		return err
	}
	return server.Initialize(ctx, pathToProject)
}

func (s *Service) Shutdown(ctx context.Context, languageID, pathToProject string) error {
	key := serverKey{languageID: languageID, pathToProject: pathToProject}
	s.mu.Lock()
	server, ok := s.servers[key]
	delete(s.servers, key)
	s.mu.Unlock()
	if !ok {
		return fmt.Errorf("no server for language: %s", languageID)
	}
	return server.Shutdown(ctx)
}
