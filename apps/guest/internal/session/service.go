// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package session

import (
	"errors"
	"fmt"
	"log/slog"
	"path/filepath"
	"strings"
	"time"

	cmap "github.com/orcaman/concurrent-map/v2"
	common_errors "github.com/snapflowio/common-go/pkg/errors"
	"github.com/snapflowio/guest/internal/childreap"
	"github.com/snapflowio/guest/internal/common"
)

const (
	sessionsDirectory = "sessions"
	maximumIDLength   = 128
	EntrypointID      = "entrypoint"
	EntrypointCommand = "entrypoint_command"
	idPunctuation     = "._-"
)

type Config struct {
	ConfigDir                string
	TerminationGracePeriod   time.Duration
	TerminationCheckInterval time.Duration
}

type Dependencies struct {
	Logger *slog.Logger
	Reaper *childreap.Reaper
}

type Service struct {
	cfg      Config
	logger   *slog.Logger
	reaper   *childreap.Reaper
	root     string
	sessions cmap.ConcurrentMap[string, *session]
}

func New(cfg Config, deps Dependencies) *Service {
	return &Service{
		cfg:      cfg,
		logger:   deps.Logger.With(slog.String("component", "session_service")),
		reaper:   deps.Reaper,
		root:     filepath.Join(cfg.ConfigDir, sessionsDirectory),
		sessions: cmap.New[*session](),
	}
}

func ValidateID(id string) error {
	if len(id) > maximumIDLength || strings.IndexFunc(id, invalidIDCharacter) >= 0 || strings.Trim(id, ".") == "" {
		return common_errors.NewBadRequestError(fmt.Errorf("identifier %q must be 1 to %d letters, digits, dots, underscores or hyphens and not only dots", id, maximumIDLength))
	}
	return nil
}

func invalidIDCharacter(character rune) bool {
	switch {
	case character >= 'a' && character <= 'z', character >= 'A' && character <= 'Z', character >= '0' && character <= '9':
		return false
	default:
		return !strings.ContainsRune(idPunctuation, character)
	}
}

func (s *Service) directory(elements ...string) (string, error) {
	path := filepath.Join(append([]string{s.root}, elements...)...)
	if !common.Within(s.root, path) {
		return "", common_errors.NewBadRequestError(fmt.Errorf("path %q escapes the sessions directory", path))
	}
	return path, nil
}

func (s *Service) lookup(sessionID string) (*session, error) {
	if err := ValidateID(sessionID); err != nil {
		return nil, err
	}
	found, ok := s.sessions.Get(sessionID)
	if !ok {
		return nil, common_errors.NewNotFoundError(errors.New("session not found"))
	}
	return found, nil
}

func (s *Service) lookupCommand(sessionID, commandID string) (*session, *command, error) {
	found, err := s.lookup(sessionID)
	if err != nil {
		return nil, nil, err
	}
	if err := ValidateID(commandID); err != nil {
		return nil, nil, err
	}
	target, ok := found.commands.Get(commandID)
	if !ok {
		return nil, nil, common_errors.NewNotFoundError(errors.New("command not found"))
	}
	return found, target, nil
}
