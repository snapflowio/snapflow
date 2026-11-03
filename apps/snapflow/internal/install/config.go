// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package install

import (
	"errors"
	"path/filepath"
	"strings"

	"github.com/snapflowio/snapflow/internal/config"
)

const (
	JournalFileName    = "release-journal.json"
	ManagementLockName = "release.lock"
	DaemonPIDFileName  = "snapflowd.pid"
	DaemonLockName     = "snapflowd-active.lock"
)

type Config struct {
	InstallationRoot string
	StateRoot        string
	RuntimeRoot      string
	CommandLink      string
	RequireRoot      bool
	AllowReset       bool
}

func ProfileConfig(selected config.Profile) Config {
	return Config{
		InstallationRoot: selected.InstallationRoot,
		StateRoot:        selected.ReleaseStateRoot,
		RuntimeRoot:      selected.RuntimeRoot,
		CommandLink:      selected.CommandLink,
		RequireRoot:      true,
		AllowReset:       selected.Name == config.Development,
	}
}

func (cfg Config) validate() (Config, error) {
	values := []struct {
		name  string
		value *string
	}{
		{name: "installation root", value: &cfg.InstallationRoot},
		{name: "release state root", value: &cfg.StateRoot},
		{name: "runtime root", value: &cfg.RuntimeRoot},
	}
	for _, candidate := range values {
		value := filepath.Clean(strings.TrimSpace(*candidate.value))
		if value == "." || !filepath.IsAbs(value) {
			return Config{}, errors.New(candidate.name + " must be absolute")
		}
		*candidate.value = value
	}
	return cfg, nil
}
