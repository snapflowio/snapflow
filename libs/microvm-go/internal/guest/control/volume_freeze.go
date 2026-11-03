// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package control

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/labstack/echo/v5"
)

const (
	// volumeFreezeSafetyTimeout thaws frozen volumes on its own if the host
	// never sends the thaw, so a host crash between freeze and thaw cannot
	// leave the guest's writers blocked. A backup holds the freeze only for a
	// reflink clone, which takes milliseconds.
	volumeFreezeSafetyTimeout   = 30 * time.Second
	maxVolumeFreezeRequestBytes = 16 * 1024
)

type volumeFreeze struct {
	mu         sync.Mutex
	frozen     []filesystemQuiescer
	generation uint64
	autoThaw   *time.Timer
}

func (s *Server) freezeVolumes(c *echo.Context) error {
	request := FreezeVolumesRequest{}
	decoder := json.NewDecoder(http.MaxBytesReader(c.Response(), c.Request().Body, maxVolumeFreezeRequestBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		return writeProblem(c, http.StatusBadRequest, "VOLUME_FREEZE_INVALID", "Volume freeze request is invalid", false, nil)
	}
	if err := request.Validate(); err != nil {
		return writeProblem(c, http.StatusBadRequest, "VOLUME_FREEZE_INVALID", "Volume freeze request is invalid", false, nil)
	}
	s.volumes.mu.Lock()
	defer s.volumes.mu.Unlock()
	// A retried freeze replaces whatever an earlier, abandoned freeze left.
	if err := s.thawVolumesLocked(); err != nil {
		return internalError(fmt.Errorf("thaw previously frozen volumes: %w", err))
	}
	s.armVolumeAutoThawLocked()
	for _, path := range request.MountPaths {
		quiescer := s.volumeQuiescer(path)
		if err := quiescer.Freeze(); err != nil {
			return internalError(errors.Join(fmt.Errorf("freeze volume %s: %w", path, err), s.thawVolumesLocked()))
		}
		s.volumes.frozen = append(s.volumes.frozen, quiescer)
	}
	if err := writeReceipt(c, "frozen", request); err != nil {
		return errors.Join(err, s.thawVolumesLocked())
	}
	return nil
}

func (s *Server) thawVolumes(c *echo.Context) error {
	s.volumes.mu.Lock()
	defer s.volumes.mu.Unlock()
	if err := s.thawVolumesLocked(); err != nil {
		return internalError(fmt.Errorf("thaw volumes: %w", err))
	}
	return writeReceipt(c, "thawed", nil)
}

func (s *Server) armVolumeAutoThawLocked() {
	s.volumes.generation++
	generation := s.volumes.generation
	s.volumes.autoThaw = time.AfterFunc(volumeFreezeSafetyTimeout, func() {
		s.autoThawVolumes(generation)
	})
}

// autoThawVolumes ignores timers left over from an earlier freeze so it never
// thaws a newer freeze early.
func (s *Server) autoThawVolumes(generation uint64) {
	s.volumes.mu.Lock()
	defer s.volumes.mu.Unlock()
	if generation != s.volumes.generation || len(s.volumes.frozen) == 0 {
		return
	}
	err := s.thawVolumesLocked()
	slog.Warn("guest volumes thawed by the safety timer; the host never thawed them", "error", err)
}

// thawVolumesLocked keeps any filesystem that failed to thaw so a later thaw
// retries it.
func (s *Server) thawVolumesLocked() error {
	var remaining []filesystemQuiescer
	var thawErrors []error
	for _, quiescer := range s.volumes.frozen {
		if err := quiescer.Thaw(); err != nil {
			remaining = append(remaining, quiescer)
			thawErrors = append(thawErrors, err)
		}
	}
	s.volumes.frozen = remaining
	if len(remaining) == 0 && s.volumes.autoThaw != nil {
		s.volumes.autoThaw.Stop()
		s.volumes.autoThaw = nil
	}
	return errors.Join(thawErrors...)
}
