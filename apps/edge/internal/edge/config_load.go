// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"fmt"
	"os"
	"strings"

	"github.com/snapflowio/common-go/pkg/deployment"
	"github.com/snapflowio/common-go/pkg/logging"
)

func LoadConfig(profile deployment.Profile) (Config, error) {
	result, err := profileConfig(profile)
	if err != nil {
		return Config{}, err
	}
	if err := deployment.RejectUnknownEnvironment(environmentVariablePrefix, environmentVariables()); err != nil {
		return Config{}, fmt.Errorf("edge environment: %w", err)
	}
	result.LogLevel, err = logging.EnvironmentLevel(result.LogLevel)
	if err != nil {
		return Config{}, err
	}
	result.Control.APIURL = normalizedURL(deployment.EnvironmentOr(APIURLEnvironmentVariable, result.Control.APIURL))
	result.EdgeID = deployment.EnvironmentOr(EdgeIDEnvironmentVariable, result.EdgeID)
	result.Control.EnrollmentSecret = strings.TrimSpace(os.Getenv(EnrollmentSecretEnvironmentVariable))
	if err := result.Validate(); err != nil {
		return Config{}, err
	}
	return result, nil
}

func normalizedURL(value string) string {
	return strings.TrimRight(strings.TrimSpace(value), "/")
}
