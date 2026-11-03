// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package manager

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/snapflowio/common-go/pkg/deployment"
	"github.com/snapflowio/common-go/pkg/logging"
)

const listSeparator = ","

func LoadConfig(profile deployment.Profile) (Config, error) {
	cfg, err := profileConfig(profile)
	if err != nil {
		return Config{}, err
	}
	if err := deployment.RejectUnknownEnvironment(environmentPrefix, environmentVariables()); err != nil {
		return Config{}, fmt.Errorf("snapshot manager environment: %w", err)
	}
	cfg.LogLevel, err = logging.EnvironmentLevel(cfg.LogLevel)
	if err != nil {
		return Config{}, err
	}
	registryConfig := &cfg.Registry
	registryConfig.Storage.S3Region = deployment.EnvironmentOr(S3RegionEnvironment, registryConfig.Storage.S3Region)
	registryConfig.Storage.S3Bucket = deployment.EnvironmentOr(S3BucketEnvironment, registryConfig.Storage.S3Bucket)
	registryConfig.Storage.S3RegionEndpoint = deployment.EnvironmentOr(
		S3RegionEndpointEnvironment,
		registryConfig.Storage.S3RegionEndpoint,
	)
	registryConfig.TLS.Certificate = deployment.EnvironmentOr(TLSCertificateEnvironment, registryConfig.TLS.Certificate)
	registryConfig.TLS.Key = deployment.EnvironmentOr(TLSKeyEnvironment, registryConfig.TLS.Key)
	registryConfig.Auth.JWKSURL = strings.TrimSpace(os.Getenv(AuthJWKSURLEnvironment))
	registryConfig.Auth.DeniedSubjects = listEnvironment(AuthDeniedEnvironment)
	registryConfig.HTTPSecret = strings.TrimSpace(os.Getenv(HTTPSecretEnvironment))
	registryConfig.DrainTimeout, err = environmentDuration(DrainTimeoutEnvironment, registryConfig.DrainTimeout)
	if err != nil {
		return Config{}, err
	}
	if err := cfg.Validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func environmentDuration(key string, fallback time.Duration) (time.Duration, error) {
	value := deployment.EnvironmentOr(key, "")
	if value == "" {
		return fallback, nil
	}
	duration, err := time.ParseDuration(value)
	if err != nil {
		return 0, fmt.Errorf("parse %s: %w", key, err)
	}
	return duration, nil
}

// listEnvironment splits a comma-separated variable, dropping empty entries.
func listEnvironment(key string) []string {
	var values []string
	for value := range strings.SplitSeq(os.Getenv(key), listSeparator) {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			values = append(values, trimmed)
		}
	}
	return values
}
