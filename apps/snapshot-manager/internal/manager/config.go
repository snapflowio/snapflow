// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package manager

import (
	"log/slog"

	"github.com/snapflowio/common-go/pkg/deployment"
	"github.com/snapflowio/snapshot-manager/internal/registry"
)

const (
	environmentPrefix           = "SNAPSHOT_MANAGER_"
	S3RegionEnvironment         = environmentPrefix + "STORAGE_S3_REGION"
	S3BucketEnvironment         = environmentPrefix + "STORAGE_S3_BUCKET"
	S3RegionEndpointEnvironment = environmentPrefix + "STORAGE_S3_REGIONENDPOINT"
	TLSCertificateEnvironment   = environmentPrefix + "HTTP_TLS_CERTIFICATE"
	TLSKeyEnvironment           = environmentPrefix + "HTTP_TLS_KEY"
	AuthJWKSURLEnvironment      = environmentPrefix + "AUTH_JWKS_URL"
	AuthDeniedEnvironment       = environmentPrefix + "AUTH_DENIED_SUBJECTS"
	HTTPSecretEnvironment       = environmentPrefix + "HTTP_SECRET"
	DrainTimeoutEnvironment     = environmentPrefix + "HTTP_DRAIN_TIMEOUT"
)

func environmentVariables() []string {
	return []string{
		S3RegionEnvironment,
		S3BucketEnvironment,
		S3RegionEndpointEnvironment,
		TLSCertificateEnvironment,
		TLSKeyEnvironment,
		AuthJWKSURLEnvironment,
		AuthDeniedEnvironment,
		HTTPSecretEnvironment,
		DrainTimeoutEnvironment,
	}
}

type Config struct {
	Profile  deployment.Profile
	LogLevel slog.Level
	Registry registry.Config
}
