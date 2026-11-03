// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/snapflowio/common-go/pkg/deployment"
)

const (
	httpScheme       = "http"
	httpsScheme      = "https"
	loopbackHostname = "localhost"
	portBase         = 10
	portBits         = 16
)

const (
	stateDirSetting       = "edge state directory"
	tunnelListenSetting   = "tunnel listener"
	httpListenSetting     = "HTTP listener"
	httpsListenSetting    = "HTTPS listener"
	metricsListenSetting  = "metrics listener"
	tlsCertificateSetting = "TLS certificate file"
	tlsPrivateKeySetting  = "TLS private key file"
	originClientCASetting = "origin client CA file"
	tunnelClientCASetting = "tunnel client CA file"
)

func (config Config) Validate() error {
	validators := [...]func() error{
		config.validateAPIURL,
		config.validateEdgeID,
		config.validateHostedIdentity,
		config.validateRequiredValues,
		config.validateAbsolutePaths,
		config.validateListenAddresses,
	}
	for _, validate := range validators {
		if err := validate(); err != nil {
			return err
		}
	}
	return nil
}

func (config Config) validateAPIURL() error {
	apiURL, err := url.Parse(config.Control.APIURL)
	if err != nil || !apiURL.IsAbs() || apiURL.Host == "" ||
		(apiURL.Scheme != httpsScheme && apiURL.Scheme != httpScheme) {
		return fmt.Errorf(
			"%s must be an absolute HTTP or HTTPS URL",
			APIURLEnvironmentVariable,
		)
	}
	if strings.TrimRight(apiURL.Path, "/") != RequiredAPIBasePath ||
		apiURL.User != nil || apiURL.RawQuery != "" || apiURL.Fragment != "" {
		return fmt.Errorf(
			"%s must be an API base URL ending in %s without credentials, query parameters, or a fragment",
			APIURLEnvironmentVariable,
			RequiredAPIBasePath,
		)
	}
	return nil
}

func (config Config) validateEdgeID() error {
	if uuid.Validate(config.EdgeID) != nil {
		return fmt.Errorf("%s must be a UUID", EdgeIDEnvironmentVariable)
	}
	return nil
}

func (config Config) validateHostedIdentity() error {
	if config.Profile != deployment.Production {
		return nil
	}
	for key, development := range map[string]bool{
		APIURLEnvironmentVariable: config.Control.APIURL == DevelopmentAPIURL,
		EdgeIDEnvironmentVariable: config.EdgeID == DevelopmentEdgeID,
	} {
		if development {
			return fmt.Errorf("%s must not use the development value in the %s profile", key, config.Profile)
		}
	}
	return nil
}

func (config Config) validateRequiredValues() error {
	for key, value := range map[string]string{
		stateDirSetting:       config.StateDir,
		tunnelListenSetting:   config.Tunnel.ListenAddress,
		httpListenSetting:     config.HTTP.HTTPAddress,
		httpsListenSetting:    config.HTTP.HTTPSAddress,
		metricsListenSetting:  config.Telemetry.ListenAddress,
		tlsCertificateSetting: config.TLS.CertificateFile,
		tlsPrivateKeySetting:  config.TLS.PrivateKeyFile,
		originClientCASetting: config.TLS.OriginClientCAFile,
		tunnelClientCASetting: config.TLS.TunnelClientCAFile,
	} {
		if strings.TrimSpace(value) == "" {
			return fmt.Errorf("%s is required", key)
		}
	}
	return nil
}

func (config Config) validateAbsolutePaths() error {
	for _, path := range [...]string{
		config.StateDir,
		config.TLS.CertificateFile,
		config.TLS.PrivateKeyFile,
		config.TLS.OriginClientCAFile,
		config.TLS.TunnelClientCAFile,
	} {
		if !filepath.IsAbs(path) {
			return errors.New("edge state and TLS paths must be absolute")
		}
	}
	return nil
}

func (config Config) validateListenAddresses() error {
	for key, address := range map[string]string{
		tunnelListenSetting:  config.Tunnel.ListenAddress,
		httpListenSetting:    config.HTTP.HTTPAddress,
		httpsListenSetting:   config.HTTP.HTTPSAddress,
		metricsListenSetting: config.Telemetry.ListenAddress,
	} {
		if err := validateListenAddress(address); err != nil {
			return fmt.Errorf("%s: %w", key, err)
		}
	}
	if err := validateLoopbackListenAddress(config.Telemetry.ListenAddress); err != nil {
		return fmt.Errorf("%s: %w", metricsListenSetting, err)
	}
	return nil
}

func validateListenAddress(address string) error {
	_, portValue, err := net.SplitHostPort(address)
	if err != nil {
		return fmt.Errorf("must be a host:port listen address: %w", err)
	}
	port, err := strconv.ParseUint(portValue, portBase, portBits)
	if err != nil || port == 0 {
		return errors.New("must use a port between 1 and 65535")
	}
	return nil
}

func validateLoopbackListenAddress(address string) error {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return fmt.Errorf("must be a host:port listen address: %w", err)
	}
	if strings.EqualFold(host, loopbackHostname) {
		return nil
	}
	ip := net.ParseIP(host)
	if ip == nil || !ip.IsLoopback() {
		return errors.New("must bind a loopback address")
	}
	return nil
}
