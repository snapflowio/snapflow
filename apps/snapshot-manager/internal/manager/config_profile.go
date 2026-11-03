// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package manager

import (
	"fmt"
	"log/slog"
	"time"

	"github.com/snapflowio/common-go/pkg/deployment"
	"github.com/snapflowio/snapshot-manager/internal/registry"
)

const (
	developmentAddr         = ":5001"
	developmentStorageDir   = deployment.DevelopmentStateRoot + "/snapshot-manager"
	developmentLogLevel     = slog.LevelDebug
	developmentDrainTimeout = 5 * time.Second

	hostedAddr         = ":5000"
	hostedStorageDir   = "/var/lib/snapflow-snapshot-manager"
	hostedLogLevel     = slog.LevelInfo
	hostedDrainTimeout = 25 * time.Second
)

func profileConfig(profile deployment.Profile) (Config, error) {
	switch profile {
	case deployment.Development:
		return profileDefaults(profile, developmentAddr, developmentLogLevel, developmentStorageDir, developmentDrainTimeout), nil
	case deployment.Production:
		return profileDefaults(profile, hostedAddr, hostedLogLevel, hostedStorageDir, hostedDrainTimeout), nil
	default:
		return Config{}, fmt.Errorf("unsupported snapshot manager profile %q", profile)
	}
}

func profileDefaults(
	profile deployment.Profile,
	addr string,
	logLevel slog.Level,
	storageDir string,
	drainTimeout time.Duration,
) Config {
	return Config{
		Profile:  profile,
		LogLevel: logLevel,
		Registry: registry.Config{
			Addr:         addr,
			DrainTimeout: drainTimeout,
			Storage:      registry.Storage{Directory: storageDir},
		},
	}
}
