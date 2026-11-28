// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"fmt"
	"log/slog"

	"github.com/snapflowio/common-go/pkg/deployment"
	"github.com/snapflowio/edge/internal/certs"
	"github.com/snapflowio/edge/internal/control"
	httpproxy "github.com/snapflowio/edge/internal/proxy/http"
	"github.com/snapflowio/edge/internal/telemetry"
	"github.com/snapflowio/edge/internal/tunnel"
)

const (
	DevelopmentAPIURL = "http://127.0.0.1:3001/api"
	DevelopmentEdgeID = "ab457b3e-8a13-4b2c-b837-f9ccc29c1a95"
)

const (
	developmentEdgeRoot     = deployment.DevelopmentStateRoot + "/edge"
	developmentStateDir     = developmentEdgeRoot + "/state"
	developmentTunnelListen = ":4443"
	developmentHTTPListen   = ":8082"
	developmentHTTPSListen  = ":8444"
	developmentLogLevel     = slog.LevelDebug
)

const (
	hostedStateDir     = "/var/lib/snapflow-edge"
	hostedTunnelListen = ":8443"
	hostedHTTPListen   = ":80"
	hostedHTTPSListen  = ":443"
	hostedLogLevel     = slog.LevelInfo
)

const metricsListen = "127.0.0.1:9090"

func profileConfig(profile deployment.Profile) (Config, error) {
	switch profile {
	case deployment.Development:
		return Config{
			Profile:   profile,
			LogLevel:  developmentLogLevel,
			EdgeID:    DevelopmentEdgeID,
			StateDir:  developmentStateDir,
			Control:   control.Config{APIURL: DevelopmentAPIURL},
			Tunnel:    tunnel.Config{ListenAddress: developmentTunnelListen},
			HTTP:      httpproxy.Config{HTTPAddress: developmentHTTPListen, HTTPSAddress: developmentHTTPSListen},
			Telemetry: telemetry.Config{ListenAddress: metricsListen},
			TLS:       certs.StateConfig(developmentStateDir),
		}, nil
	case deployment.Production:
		return Config{
			Profile:   profile,
			LogLevel:  hostedLogLevel,
			StateDir:  hostedStateDir,
			Tunnel:    tunnel.Config{ListenAddress: hostedTunnelListen},
			HTTP:      httpproxy.Config{HTTPAddress: hostedHTTPListen, HTTPSAddress: hostedHTTPSListen},
			Telemetry: telemetry.Config{ListenAddress: metricsListen},
			TLS:       certs.StateConfig(hostedStateDir),
		}, nil
	default:
		return Config{}, fmt.Errorf("unsupported edge profile %q", profile)
	}
}
