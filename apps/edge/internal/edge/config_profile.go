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
	developmentEdgeRoot           = deployment.DevelopmentStateRoot + "/edge"
	developmentTLSDirectory       = developmentEdgeRoot + "/tls"
	developmentStateDir           = developmentEdgeRoot + "/state"
	developmentTunnelListen       = ":4443"
	developmentHTTPListen         = ":8082"
	developmentHTTPSListen        = ":8444"
	developmentTLSCertificateFile = developmentTLSDirectory + "/edge-server.pem"
	developmentTLSPrivateKeyFile  = developmentTLSDirectory + "/edge-server-key.pem"
	developmentOriginClientCAFile = developmentTLSDirectory + "/origin-client-ca.pem"
	developmentTunnelClientCAFile = deployment.DevelopmentStateRoot + "/openbao/tunnel-client-ca.pem"
	developmentLogLevel           = slog.LevelDebug
)

const (
	hostedStateDir           = "/var/lib/snapflow-edge"
	hostedTunnelListen       = ":8443"
	hostedHTTPListen         = ":80"
	hostedHTTPSListen        = ":443"
	hostedTLSCertificateFile = "/etc/snapflow/tls/fullchain.pem"
	hostedTLSPrivateKeyFile  = "/etc/snapflow/tls/private-key.pem"
	hostedOriginClientCAFile = "/etc/snapflow/trust/origin-client-ca.pem"
	hostedTunnelClientCAFile = "/etc/snapflow/trust/tunnel-client-ca.pem"
	hostedLogLevel           = slog.LevelInfo
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
			TLS: certs.Config{
				CertificateFile:    developmentTLSCertificateFile,
				PrivateKeyFile:     developmentTLSPrivateKeyFile,
				OriginClientCAFile: developmentOriginClientCAFile,
				TunnelClientCAFile: developmentTunnelClientCAFile,
			},
		}, nil
	case deployment.Production:
		return Config{
			Profile:   profile,
			LogLevel:  hostedLogLevel,
			StateDir:  hostedStateDir,
			Tunnel:    tunnel.Config{ListenAddress: hostedTunnelListen},
			HTTP:      httpproxy.Config{HTTPAddress: hostedHTTPListen, HTTPSAddress: hostedHTTPSListen},
			Telemetry: telemetry.Config{ListenAddress: metricsListen},
			TLS: certs.Config{
				CertificateFile:    hostedTLSCertificateFile,
				PrivateKeyFile:     hostedTLSPrivateKeyFile,
				OriginClientCAFile: hostedOriginClientCAFile,
				TunnelClientCAFile: hostedTunnelClientCAFile,
			},
		}, nil
	default:
		return Config{}, fmt.Errorf("unsupported edge profile %q", profile)
	}
}
