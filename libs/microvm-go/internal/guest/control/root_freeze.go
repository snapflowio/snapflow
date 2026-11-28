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
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"
)

const (
	rootFreezeSafetyTimeout = 2 * time.Minute
	rootFreezeTick          = time.Second
)

type rootFreezeGuard struct {
	generation uint64
	stop       chan struct{}
}

func (s *Server) armRootAutoThawLocked() {
	s.stopRootAutoThawLocked()
	s.rootFreeze.generation++
	stop := make(chan struct{})
	s.rootFreeze.stop = stop
	go s.watchRootFreeze(s.rootFreeze.generation, stop)
}

func (s *Server) stopRootAutoThawLocked() {
	if s.rootFreeze.stop != nil {
		close(s.rootFreeze.stop)
		s.rootFreeze.stop = nil
	}
}

func (s *Server) watchRootFreeze(generation uint64, stop <-chan struct{}) {
	ticker := time.NewTicker(rootFreezeTick)
	defer ticker.Stop()
	for running := time.Duration(0); running < rootFreezeSafetyTimeout; running += rootFreezeTick {
		select {
		case <-stop:
			return
		case <-ticker.C:
		}
	}
	s.autoThawRoot(generation)
}

func (s *Server) thawRootLocked() error {
	s.stopRootAutoThawLocked()
	if !s.filesystemFrozen {
		return nil
	}
	if err := s.filesystem.Thaw(); err != nil {
		return fmt.Errorf("thaw root filesystem: %w", err)
	}
	s.filesystemFrozen = false
	return nil
}

func (s *Server) autoThawRoot(generation uint64) {
	s.quiesceMu.Lock()
	defer s.quiesceMu.Unlock()
	if generation != s.rootFreeze.generation || !s.filesystemFrozen {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), componentHookRequestTimeout)
	defer cancel()
	err := errors.Join(s.thawRootLocked(), s.resumeComponents(ctx))
	slog.Warn("guest root filesystem thawed by the safety timer after the host never resumed it", "error", err)
}
