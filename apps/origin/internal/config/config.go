// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package config

import (
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/snapflowio/common-go/pkg/deployment"
	"github.com/snapflowio/common-go/pkg/logging"
	"github.com/snapflowio/tunnel-go/protocol"
)

const (
	SiteEnvironmentVariable             = "SNAPFLOW_ORIGIN_SITE"
	EdgesEnvironmentVariable            = "SNAPFLOW_ORIGIN_EDGES"
	UpstreamEnvironmentVariable         = "SNAPFLOW_ORIGIN_UPSTREAM"
	OpenBaoAddressEnvironmentVariable   = "SNAPFLOW_ORIGIN_OPENBAO_ADDR"
	OpenBaoAuthEnvironmentVariable      = "SNAPFLOW_ORIGIN_OPENBAO_AUTH"
	OpenBaoTokenFileEnvironmentVariable = "SNAPFLOW_ORIGIN_OPENBAO_TOKEN_FILE"
	EdgeCertificateAuthorityEnvVariable = "SNAPFLOW_ORIGIN_EDGE_CA_FILE"
	HealthAddressEnvironmentVariable    = "SNAPFLOW_ORIGIN_HEALTH_ADDRESS"
	environmentVariablePrefix           = "SNAPFLOW_ORIGIN_"
	listSeparator                       = ","
	defaultOpenBaoTokenFile             = "/var/run/secrets/openbao/token"
	defaultHealthAddress                = ":8080"
	maxEdges                            = 64
)

type OpenBaoAuth string

const (
	OpenBaoAuthKubernetes OpenBaoAuth = "kubernetes"
	OpenBaoAuthProxy      OpenBaoAuth = "proxy"
)

type Config struct {
	LogLevel                 slog.Level
	Site                     string
	Edges                    []string
	Upstream                 string
	OpenBaoAddress           string
	OpenBaoAuth              OpenBaoAuth
	OpenBaoTokenFile         string
	EdgeCertificateAuthority string
	HealthAddress            string
}

func environmentVariables() []string {
	return []string{
		SiteEnvironmentVariable,
		EdgesEnvironmentVariable,
		UpstreamEnvironmentVariable,
		OpenBaoAddressEnvironmentVariable,
		OpenBaoAuthEnvironmentVariable,
		OpenBaoTokenFileEnvironmentVariable,
		EdgeCertificateAuthorityEnvVariable,
		HealthAddressEnvironmentVariable,
	}
}

func Load() (Config, error) {
	if err := deployment.RejectUnknownEnvironment(environmentVariablePrefix, environmentVariables()); err != nil {
		return Config{}, fmt.Errorf("origin environment: %w", err)
	}
	level, err := logging.EnvironmentLevel(slog.LevelInfo)
	if err != nil {
		return Config{}, err
	}
	loaded := Config{
		LogLevel:                 level,
		Site:                     strings.TrimSpace(os.Getenv(SiteEnvironmentVariable)),
		Edges:                    parseList(os.Getenv(EdgesEnvironmentVariable)),
		Upstream:                 strings.TrimSpace(os.Getenv(UpstreamEnvironmentVariable)),
		OpenBaoAddress:           strings.TrimRight(strings.TrimSpace(os.Getenv(OpenBaoAddressEnvironmentVariable)), "/"),
		OpenBaoAuth:              OpenBaoAuth(deployment.EnvironmentOr(OpenBaoAuthEnvironmentVariable, string(OpenBaoAuthKubernetes))),
		OpenBaoTokenFile:         deployment.EnvironmentOr(OpenBaoTokenFileEnvironmentVariable, defaultOpenBaoTokenFile),
		EdgeCertificateAuthority: strings.TrimSpace(os.Getenv(EdgeCertificateAuthorityEnvVariable)),
		HealthAddress:            deployment.EnvironmentOr(HealthAddressEnvironmentVariable, defaultHealthAddress),
	}
	return loaded, loaded.Validate()
}

func parseList(value string) []string {
	var entries []string
	for entry := range strings.SplitSeq(value, listSeparator) {
		trimmed := strings.TrimSpace(entry)
		if trimmed != "" && !slices.Contains(entries, trimmed) {
			entries = append(entries, trimmed)
		}
	}
	return entries
}

func (config Config) Validate() error {
	if err := protocol.ValidateOriginSite(config.Site); err != nil {
		return fmt.Errorf("%s: %w", SiteEnvironmentVariable, err)
	}
	if len(config.Edges) == 0 || len(config.Edges) > maxEdges {
		return fmt.Errorf("%s must list 1-%d edge tunnel addresses", EdgesEnvironmentVariable, maxEdges)
	}
	for _, address := range append(slices.Clone(config.Edges), config.Upstream, config.HealthAddress) {
		if _, _, err := net.SplitHostPort(address); err != nil {
			return fmt.Errorf("%q must be a host:port address: %w", address, err)
		}
	}
	openBao, err := url.Parse(config.OpenBaoAddress)
	if err != nil || !openBao.IsAbs() || openBao.Host == "" {
		return fmt.Errorf("%s must be an absolute URL", OpenBaoAddressEnvironmentVariable)
	}
	switch config.OpenBaoAuth {
	case OpenBaoAuthKubernetes:
		if !filepath.IsAbs(config.OpenBaoTokenFile) {
			return fmt.Errorf("%s must be an absolute path", OpenBaoTokenFileEnvironmentVariable)
		}
	case OpenBaoAuthProxy:
	default:
		return fmt.Errorf("%s must be %q or %q", OpenBaoAuthEnvironmentVariable, OpenBaoAuthKubernetes, OpenBaoAuthProxy)
	}
	if config.EdgeCertificateAuthority != "" && !filepath.IsAbs(config.EdgeCertificateAuthority) {
		return errors.New(EdgeCertificateAuthorityEnvVariable + " must be an absolute path")
	}
	return nil
}
