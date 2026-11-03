// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package update

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/snapflowio/common-go/pkg/atomicfile"
	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/install"
)

const (
	statusSchema         = "snapflow.machine-update-status.v1"
	statusFilename       = "update-status.json"
	maximumStatusBytes   = 1024 * 1024
	statusDirectoryMode  = 0o700
	statusFileMode       = 0o600
	MaintenanceWindowUTC = "04:00-06:00 UTC"
	maximumFailureRunes  = 2048
)

type Phase string

const (
	PhaseIdle       Phase = "idle"
	PhaseStaged     Phase = "staged"
	PhaseDraining   Phase = "draining"
	PhaseActivating Phase = "activating"
	PhaseReady      Phase = "ready"
	PhaseFailed     Phase = "failed"
)

type Status struct {
	Schema            string                 `json:"schema"`
	Profile           config.ProfileName     `json:"profile"`
	Channel           string                 `json:"channel"`
	MaintenanceWindow string                 `json:"maintenanceWindow"`
	Phase             Phase                  `json:"phase"`
	Candidate         *install.ReleaseRecord `json:"candidate,omitempty"`
	Active            *install.ReleaseRecord `json:"active,omitempty"`
	Previous          *install.ReleaseRecord `json:"previous,omitempty"`
	LastFailure       string                 `json:"lastFailure,omitempty"`
	UpdatedAt         time.Time              `json:"updatedAt"`
}

func Inspect(profile config.Profile) (Status, error) {
	path := filepath.Join(profile.ReleaseStateRoot, statusFilename)
	payload, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return releaseStatus(profile, PhaseIdle, nil, "")
	}
	if err != nil {
		return Status{}, fmt.Errorf("read Snapflow update status: %w", err)
	}
	if len(payload) > maximumStatusBytes {
		return Status{}, errors.New("the Snapflow update status exceeds its size limit")
	}
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.DisallowUnknownFields()
	var status Status
	if err := decoder.Decode(&status); err != nil {
		return Status{}, fmt.Errorf("decode Snapflow update status: %w", err)
	}
	var trailing json.RawMessage
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return Status{}, errors.New("the Snapflow update status contains trailing JSON")
	}
	if status.Schema != statusSchema || status.Profile != profile.Name {
		return Status{}, errors.New("the Snapflow update status does not belong to the selected profile")
	}
	return status, nil
}

func saveStatus(profile config.Profile, phase Phase, candidate *install.ReleaseRecord, failure string) error {
	failure = strings.TrimSpace(failure)
	failureRunes := []rune(failure)
	if len(failureRunes) > maximumFailureRunes {
		failure = string(failureRunes[:maximumFailureRunes])
	}
	status, err := releaseStatus(profile, phase, candidate, failure)
	if err != nil {
		return err
	}
	payload, err := json.MarshalIndent(status, "", "  ")
	if err != nil {
		return fmt.Errorf("encode Snapflow update status: %w", err)
	}
	payload = append(payload, '\n')
	if err := os.MkdirAll(profile.ReleaseStateRoot, statusDirectoryMode); err != nil {
		return fmt.Errorf("create Snapflow update state directory: %w", err)
	}
	if err := atomicfile.WriteFile(filepath.Join(profile.ReleaseStateRoot, statusFilename), payload, statusFileMode); err != nil {
		return fmt.Errorf("commit Snapflow update status: %w", err)
	}
	return nil
}

func releaseStatus(profile config.Profile, phase Phase, candidate *install.ReleaseRecord, failure string) (Status, error) {
	journal, err := install.InspectJournal(profile.ReleaseStateRoot)
	if err != nil {
		return Status{}, err
	}
	channel := profile.Channel
	switch {
	case candidate != nil:
		channel = candidate.Channel
	case journal.Active != nil:
		channel = journal.Active.Channel
	}
	return Status{
		Schema: statusSchema, Profile: profile.Name, Channel: string(channel),
		MaintenanceWindow: MaintenanceWindowUTC, Phase: phase, Candidate: candidate,
		Active: journal.Active, Previous: journal.Previous,
		LastFailure: failure, UpdatedAt: time.Now().UTC(),
	}, nil
}
