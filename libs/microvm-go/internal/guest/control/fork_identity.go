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
	"crypto/subtle"
	"errors"
	"fmt"
	"maps"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/snapflowio/microvm-go/guest"
	guestconfig "github.com/snapflowio/microvm-go/guest/config"
	"github.com/snapflowio/microvm-go/internal/atomicfile"
	"github.com/snapflowio/microvm-go/internal/filemode"
)

var machineIDPattern = regexp.MustCompile(`^[a-f0-9]{32}$`)

func (s *Server) prepareFork(c *echo.Context) error {
	s.quiesceMu.Lock()
	defer s.quiesceMu.Unlock()
	if s.filesystemFrozen {
		return writeReceipt(c, "quiesced", nil)
	}
	if err := callComponentHooks(c.Request().Context(), s.config.Snapshot().ComponentHooks, guest.LifecycleOperationQuiesce, nil); err != nil {
		resumeErr := callComponentHooks(c.Request().Context(), s.config.Snapshot().ComponentHooks, guest.LifecycleOperationResume, nil)
		return internalError(errors.Join(err, resumeErr))
	}
	if err := s.filesystem.Freeze(); err != nil {
		resumeErr := callComponentHooks(c.Request().Context(), s.config.Snapshot().ComponentHooks, guest.LifecycleOperationResume, nil)
		return internalError(errors.Join(fmt.Errorf("freeze root filesystem: %w", err), resumeErr))
	}
	s.filesystemFrozen = true
	if err := writeReceipt(c, "quiesced", nil); err != nil {
		thawErr := s.filesystem.Thaw()
		resumeErr := callComponentHooks(context.Background(), s.config.Snapshot().ComponentHooks, guest.LifecycleOperationResume, nil)
		if thawErr == nil {
			s.filesystemFrozen = false
		}
		return errors.Join(err, thawErr, resumeErr)
	}
	return nil
}

func (s *Server) resumeFork(c *echo.Context) error {
	s.quiesceMu.Lock()
	defer s.quiesceMu.Unlock()
	if s.filesystemFrozen {
		if err := s.filesystem.Thaw(); err != nil {
			return internalError(fmt.Errorf("thaw root filesystem: %w", err))
		}
		s.filesystemFrozen = false
	}
	if err := s.resumeComponents(c.Request().Context()); err != nil {
		return internalError(err)
	}
	return writeReceipt(c, "resumed", nil)
}

func (s *Server) thawFilesystemForIdentity() error {
	s.quiesceMu.Lock()
	defer s.quiesceMu.Unlock()
	if !s.filesystemFrozen {
		return nil
	}
	if err := s.filesystem.Thaw(); err != nil {
		return fmt.Errorf("thaw root filesystem for restored identity: %w", err)
	}
	s.filesystemFrozen = false
	return nil
}

func (s *Server) applyRestoredIdentity(ctx context.Context, request RestoredIdentity) error {
	if err := reseedRandom(request.RandomSeed); err != nil {
		return err
	}
	if err := s.thawFilesystemForIdentity(); err != nil {
		return err
	}
	nextGuestPublicKey, nextGuestPrivateKey, err := newGuestEphemeralKey()
	if err != nil {
		return err
	}
	guestKeyInstalled := false
	defer func() {
		if !guestKeyInstalled {
			clear(nextGuestPrivateKey)
		}
	}()
	previous := s.config.Snapshot()
	if err := ApplyHostIdentity(request.Hostname, request.MachineID); err != nil {
		return err
	}
	if err := syncGuestClock(time.Unix(0, request.HostUnixNano)); err != nil {
		return err
	}
	if err := s.sessions.ResetSessions(); err != nil {
		return fmt.Errorf("reset instance process sessions: %w", err)
	}
	nextIdentity := guest.Identity{InstanceID: request.InstanceID}
	if err := callComponentHooks(ctx, previous.ComponentHooks, guest.LifecycleOperationIdentity, nextIdentity); err != nil {
		rollbackErr := callComponentHooks(ctx, previous.ComponentHooks, guest.LifecycleOperationIdentity, guest.Identity{InstanceID: previous.InstanceID})
		return errors.Join(err, rollbackErr)
	}
	if err := s.persistIdentity(previous, request); err != nil {
		rollbackErr := callComponentHooks(ctx, previous.ComponentHooks, guest.LifecycleOperationIdentity, guest.Identity{InstanceID: previous.InstanceID})
		return errors.Join(err, rollbackErr)
	}
	s.sessionMu.Lock()
	clear(s.guestPrivateKey)
	s.guestPublicKey = nextGuestPublicKey
	s.guestPrivateKey = nextGuestPrivateKey
	clear(s.guestSessions)
	guestKeyInstalled = true
	s.sessionMu.Unlock()
	return nil
}

func (s *Server) resumeComponents(ctx context.Context) error {
	return callComponentHooks(ctx, s.config.Snapshot().ComponentHooks, guest.LifecycleOperationResume, nil)
}

func (r RestoredIdentity) Validate() error {
	if strings.TrimSpace(r.InstanceID) == "" {
		return fmt.Errorf("instanceId is required")
	}
	if strings.TrimSpace(r.GenerationID) == "" {
		return fmt.Errorf("generationId is required")
	}
	if len(r.ControlAuthToken) < minimumControlTokenLength {
		return fmt.Errorf("control authentication token must contain at least 32 characters")
	}
	for name, token := range r.GuestServiceTokens {
		if strings.TrimSpace(name) == "" || len(token) < 32 {
			return fmt.Errorf("guest service tokens require a name and at least 32 characters")
		}
	}
	if strings.TrimSpace(r.Hostname) == "" || len(r.Hostname) > 63 {
		return fmt.Errorf("hostname must contain between 1 and 63 characters")
	}
	if !machineIDPattern.MatchString(r.MachineID) {
		return fmt.Errorf("machineId must be 32 lowercase hexadecimal characters")
	}
	if r.HostUnixNano <= 0 {
		return fmt.Errorf("hostUnixNano must be positive")
	}
	if len(r.RandomSeed) != RandomSeedBytes {
		return fmt.Errorf("randomSeed must contain %d bytes", RandomSeedBytes)
	}
	return nil
}

func (s *Server) persistIdentity(previous guestconfig.Config, request RestoredIdentity) error {
	if err := advanceWorkloadGenerationReceipt(
		s.secretPaths.started,
		previous.DeferredWorkload,
		previous.GenerationID,
		request.GenerationID,
	); err != nil {
		return err
	}
	rollbackCredentials, err := replaceServiceCredentials(
		s.credentialRoot,
		previous.GuestServiceTokens,
		request.GuestServiceTokens,
	)
	if err != nil {
		return fmt.Errorf("replace guest service credentials: %w", err)
	}
	if err := s.config.Update(func(cfg *guestconfig.Config) error {
		cfg.InstanceID = request.InstanceID
		cfg.GenerationID = request.GenerationID
		cfg.GuestServiceTokens = maps.Clone(request.GuestServiceTokens)
		cfg.ControlAuthToken = request.ControlAuthToken
		return nil
	}); err != nil {
		return errors.Join(
			fmt.Errorf("persist guest identity: %w", err),
			rollbackCredentials(),
		)
	}
	return nil
}

func advanceWorkloadGenerationReceipt(path string, deferred bool, previousGeneration, nextGeneration string) error {
	receipt, err := os.ReadFile(path)
	if err != nil {
		if deferred && errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return fmt.Errorf("read workload start receipt before identity rotation: %w", err)
	}
	previousMatches := subtle.ConstantTimeCompare(receipt, []byte(previousGeneration)) == 1
	nextMatches := subtle.ConstantTimeCompare(receipt, []byte(nextGeneration)) == 1
	if !previousMatches && !nextMatches {
		return fmt.Errorf("workload start receipt does not match the current or requested generation")
	}
	if nextMatches {
		return nil
	}
	if err := atomicfile.Replace(path, []byte(nextGeneration), filemode.PrivateFile); err != nil {
		return fmt.Errorf("advance workload start receipt: %w", err)
	}
	if err := atomicfile.Commit(path); err != nil {
		return fmt.Errorf("advance workload start receipt: %w", err)
	}
	return nil
}
