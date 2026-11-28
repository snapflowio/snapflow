// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package session

import (
	"log/slog"

	"github.com/snapflowio/guest/internal/session"
)

type SessionController struct {
	logger   *slog.Logger
	sessions *session.Service
}

func NewSessionController(logger *slog.Logger, sessions *session.Service) *SessionController {
	return &SessionController{
		logger:   logger.With(slog.String("component", "session_controller")),
		sessions: sessions,
	}
}
