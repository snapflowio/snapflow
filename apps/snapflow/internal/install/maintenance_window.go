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
	"os"
	"path/filepath"
	"time"

	"github.com/snapflowio/snapflow/internal/foundation/config"
	"github.com/snapflowio/snapflow/internal/foundation/state"
)

const (
	maintenanceWindowSchema          = "snapflow.machine-maintenance-window.v1"
	maintenanceWindowFilename        = "maintenance-window.json"
	maximumWindowFileBytes           = 4 * 1024
	minutesPerHour                   = 60
	minutesPerDay                    = 24 * minutesPerHour
	MinimumMaintenanceMinutes        = minutesPerHour
	MaximumMaintenanceMinutes        = minutesPerDay / 2
	defaultMaintenanceStartMinute    = 4 * minutesPerHour
	defaultMaintenanceDurationMinute = 2 * minutesPerHour
)

type MaintenanceWindow struct {
	StartMinuteUTC  int `json:"startMinuteUtc"`
	DurationMinutes int `json:"durationMinutes"`
}

func DefaultMaintenanceWindow() MaintenanceWindow {
	return MaintenanceWindow{StartMinuteUTC: defaultMaintenanceStartMinute, DurationMinutes: defaultMaintenanceDurationMinute}
}

func (window MaintenanceWindow) Validate() error {
	if window.StartMinuteUTC < 0 || window.StartMinuteUTC >= minutesPerDay {
		return fmt.Errorf("the maintenance window must start within the UTC day, not at minute %d", window.StartMinuteUTC)
	}
	if window.DurationMinutes < MinimumMaintenanceMinutes || window.DurationMinutes > MaximumMaintenanceMinutes {
		return fmt.Errorf("the maintenance window must last %d to %d minutes, not %d",
			MinimumMaintenanceMinutes, MaximumMaintenanceMinutes, window.DurationMinutes)
	}
	return nil
}

func (window MaintenanceWindow) Contains(at time.Time) bool {
	utc := at.UTC()
	minute := utc.Hour()*minutesPerHour + utc.Minute()
	return (minute-window.StartMinuteUTC+minutesPerDay)%minutesPerDay < window.DurationMinutes
}

func (window MaintenanceWindow) String() string {
	end := (window.StartMinuteUTC + window.DurationMinutes) % minutesPerDay
	return fmt.Sprintf("%s-%s UTC", clock(window.StartMinuteUTC), clock(end))
}

func clock(minute int) string {
	return fmt.Sprintf("%02d:%02d", minute/minutesPerHour, minute%minutesPerHour)
}

type maintenanceWindowFile struct {
	Schema string            `json:"schema"`
	Window MaintenanceWindow `json:"window"`
}

func SaveMaintenanceWindow(profile config.Profile, window *MaintenanceWindow) error {
	path := filepath.Join(profile.ReleaseStateRoot, maintenanceWindowFilename)
	if window == nil {
		if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("remove the Snapflow maintenance window: %w", err)
		}
		return nil
	}
	if err := window.Validate(); err != nil {
		return err
	}
	file := maintenanceWindowFile{Schema: maintenanceWindowSchema, Window: *window}
	if err := state.WriteJSONFile(path, file, updateStatusDirectoryMode, updateStatusFileMode); err != nil {
		return fmt.Errorf("save the Snapflow maintenance window: %w", err)
	}
	return nil
}

func EffectiveMaintenanceWindow(profile config.Profile) (MaintenanceWindow, error) {
	var stored maintenanceWindowFile
	path := filepath.Join(profile.ReleaseStateRoot, maintenanceWindowFilename)
	found, err := state.ReadJSONFile(path, maximumWindowFileBytes, &stored)
	if err != nil {
		return MaintenanceWindow{}, fmt.Errorf("load the Snapflow maintenance window: %w", err)
	}
	if !found {
		return DefaultMaintenanceWindow(), nil
	}
	if stored.Schema != maintenanceWindowSchema {
		return MaintenanceWindow{}, fmt.Errorf("the Snapflow maintenance window has unknown schema %q", stored.Schema)
	}
	if err := stored.Window.Validate(); err != nil {
		return MaintenanceWindow{}, err
	}
	return stored.Window, nil
}
