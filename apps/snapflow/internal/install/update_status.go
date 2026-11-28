// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package install

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/snapflowio/snapflow/internal/foundation/config"
	"github.com/snapflowio/snapflow/internal/foundation/state"
)

const (
	updateStatusSchema        = "snapflow.machine-update-status.v1"
	updateStatusFilename      = "update-status.json"
	maximumUpdateStatusBytes  = 1024 * 1024
	updateStatusDirectoryMode = 0o700
	updateStatusFileMode      = 0o600
	maximumFailureRunes       = 2048
)

type UpdatePhase string

const (
	UpdatePhaseIdle       UpdatePhase = "idle"
	UpdatePhaseStaged     UpdatePhase = "staged"
	UpdatePhaseDraining   UpdatePhase = "draining"
	UpdatePhaseActivating UpdatePhase = "activating"
	UpdatePhaseReady      UpdatePhase = "ready"
	UpdatePhaseFailed     UpdatePhase = "failed"
)

type UpdateStatus struct {
	Schema            string             `json:"schema"`
	Profile           config.ProfileName `json:"profile"`
	Channel           string             `json:"channel"`
	MaintenanceWindow string             `json:"maintenanceWindow"`
	Phase             UpdatePhase        `json:"phase"`
	Candidate         *ReleaseRecord     `json:"candidate,omitempty"`
	Active            *ReleaseRecord     `json:"active,omitempty"`
	Previous          *ReleaseRecord     `json:"previous,omitempty"`
	LastFailure       string             `json:"lastFailure,omitempty"`
	UpdatedAt         time.Time          `json:"updatedAt"`
}

func InspectUpdateStatus(profile config.Profile) (UpdateStatus, error) {
	var status UpdateStatus
	path := filepath.Join(profile.ReleaseStateRoot, updateStatusFilename)
	found, err := state.ReadJSONFile(path, maximumUpdateStatusBytes, &status)
	if err != nil {
		return UpdateStatus{}, fmt.Errorf("load Snapflow update status: %w", err)
	}
	if !found {
		return releaseUpdateStatus(profile, UpdatePhaseIdle, nil, "")
	}
	if status.Schema != updateStatusSchema || status.Profile != profile.Name {
		return UpdateStatus{}, errors.New("the Snapflow update status does not belong to the selected profile")
	}
	return status, nil
}

func SaveUpdateStatus(profile config.Profile, phase UpdatePhase, candidate *ReleaseRecord, failure string) error {
	failure = strings.TrimSpace(failure)
	failureRunes := []rune(failure)
	if len(failureRunes) > maximumFailureRunes {
		failure = string(failureRunes[:maximumFailureRunes])
	}
	status, err := releaseUpdateStatus(profile, phase, candidate, failure)
	if err != nil {
		return err
	}
	path := filepath.Join(profile.ReleaseStateRoot, updateStatusFilename)
	if err := state.WriteJSONFile(path, status, updateStatusDirectoryMode, updateStatusFileMode); err != nil {
		return fmt.Errorf("save Snapflow update status: %w", err)
	}
	return nil
}

func releaseUpdateStatus(profile config.Profile, phase UpdatePhase, candidate *ReleaseRecord, failure string) (UpdateStatus, error) {
	journal, err := InspectJournal(profile.ReleaseStateRoot)
	if err != nil {
		return UpdateStatus{}, err
	}
	window, err := EffectiveMaintenanceWindow(profile)
	if err != nil {
		return UpdateStatus{}, err
	}
	channel := profile.Channel
	switch {
	case candidate != nil:
		channel = candidate.Channel
	case journal.Active != nil:
		channel = journal.Active.Channel
	}
	return UpdateStatus{
		Schema: updateStatusSchema, Profile: profile.Name, Channel: string(channel),
		MaintenanceWindow: window.String(), Phase: phase, Candidate: candidate,
		Active: journal.Active, Previous: journal.Previous,
		LastFailure: failure, UpdatedAt: time.Now().UTC(),
	}, nil
}
