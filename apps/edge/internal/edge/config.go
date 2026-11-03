// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"log/slog"

	"github.com/snapflowio/common-go/pkg/deployment"
	"github.com/snapflowio/edge/internal/certs"
	"github.com/snapflowio/edge/internal/control"
	httpproxy "github.com/snapflowio/edge/internal/proxy/http"
	"github.com/snapflowio/edge/internal/telemetry"
	"github.com/snapflowio/edge/internal/tunnel"
)

const (
	APIURLEnvironmentVariable           = "SNAPFLOW_EDGE_API_URL"
	EdgeIDEnvironmentVariable           = "SNAPFLOW_EDGE_ID"
	EnrollmentSecretEnvironmentVariable = "SNAPFLOW_EDGE_ENROLLMENT_SECRET"
	environmentVariablePrefix           = "SNAPFLOW_EDGE_"
	RequiredAPIBasePath                 = "/api"
)

func environmentVariables() []string {
	return []string{
		APIURLEnvironmentVariable,
		EdgeIDEnvironmentVariable,
		EnrollmentSecretEnvironmentVariable,
	}
}

type Config struct {
	Profile   deployment.Profile
	LogLevel  slog.Level
	EdgeID    string
	StateDir  string
	Control   control.Config
	Tunnel    tunnel.Config
	HTTP      httpproxy.Config
	Telemetry telemetry.Config
	TLS       certs.Config
}
