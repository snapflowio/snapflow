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
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/snapflowio/common-go/pkg/deployment"
	"github.com/snapflowio/snapflow/internal/tuf"
)

type ProfileName = deployment.Profile

const (
	Development = deployment.Development
	Production  = deployment.Production

	DevelopmentInstallationRoot = "/opt/snapflow-development"
	productionInstallationRoot  = "/opt/snapflow"

	DevelopmentReleaseStateRoot = "/var/lib/snapflow/releases-development"
	productionReleaseStateRoot  = "/var/lib/snapflow/releases"

	DevelopmentRuntimeRoot = "/run/snapflow-development"
	productionRuntimeRoot  = "/run/snapflow"

	developmentGuestRegistryOrigin = "http://registry:5000"
	developmentObjectStorageOrigin = "http://rustfs:9000"
	DevelopmentGuestRepository     = "registry:5000/snapflowio/platform"
	ProductionAPIOrigin            = "https://snapflow.io"
	productionGuestRegistryOrigin  = "https://ghcr.io"
	DevelopmentResetConfirmation   = "remove-development-runtime"

	developmentDashboardURL = "http://127.0.0.1:3000/dashboard/machines"

	developmentAPIURL = "http://127.0.0.1:3001/api"
	apiBasePath       = "/api"

	productionDashboardURL = "https://snapflow.io/dashboard/machines"
	productionCommandLink  = "/usr/local/bin/snapflow"
	developmentAssetsPath  = "/assets/"
	maximumBootstrapBytes  = 512 * 1024
)

type RepositorySource struct {
	Origin        string
	BootstrapRoot string
}

func (profile Profile) ValidateGuestRegistry(policyURL, immutableReference string) error {
	registry, err := url.Parse(strings.TrimSpace(policyURL))
	if err != nil || registry.Host == "" || registry.Path != "" || registry.User != nil ||
		registry.RawQuery != "" || registry.Fragment != "" {
		return errors.New("guest registry policy must be an absolute origin without a path, credentials, query, or fragment")
	}
	if !strings.Contains(immutableReference, "@sha256:") {
		return errors.New("guest release must be an immutable SHA-256 digest reference")
	}
	referenceHost := strings.Split(immutableReference, "/")[0]
	if !strings.EqualFold(referenceHost, registry.Host) {
		return errors.New("signed guest release and control policy registry origins differ")
	}
	if profile.Name == Development {
		if registry.Scheme != "http" || registry.Host != "registry:5000" {
			return errors.New("development profile requires the local registry origin")
		}
		return nil
	}
	if profile.Name != Production {
		return fmt.Errorf("unsupported Snapflow profile %q", profile.Name)
	}
	if registry.Scheme != "https" {
		return errors.New("production guest registries must use HTTPS")
	}
	return nil
}

func (profile Profile) ValidateAPIURL(value string) error {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return errors.New("control-plane API URL must be an absolute URL without credentials, query, or fragment")
	}
	switch profile.Name {
	case Development:
		if parsed.Scheme != "http" || !loopbackHost(parsed.Hostname()) {
			return errors.New("development control-plane API must use HTTP on a loopback host")
		}
	case Production:
		if !sameOrigin(parsed, ProductionAPIOrigin) {
			return errors.New("production profile requires the Snapflow production API origin")
		}
	default:
		return fmt.Errorf("unsupported Snapflow profile %q", profile.Name)
	}
	return nil
}

func sameOrigin(candidate *url.URL, expected string) bool {
	origin, err := url.Parse(expected)
	return err == nil && candidate.Scheme == "https" &&
		strings.EqualFold(candidate.Host, origin.Host)
}

func loopbackHost(host string) bool {
	if strings.EqualFold(strings.TrimSpace(host), "localhost") {
		return true
	}
	address := net.ParseIP(strings.TrimSpace(host))
	return address != nil && address.IsLoopback()
}

type Profile struct {
	Name                        ProfileName
	Channel                     tuf.Channel
	InstallationRoot            string
	ReleaseStateRoot            string
	RuntimeRoot                 string
	RepositoryOrigin            string
	AssetOrigin                 string
	BootstrapRoot               string
	CommandLink                 string
	RepositoryTransport         tuf.TransportPolicy
	GuestRegistryOrigin         string
	DashboardURL                string
	APIURL                      string
	TrustedObjectStorageOrigins []string
	ProductionSecurity          bool
}

func ParseProfile(value string) (ProfileName, error) {
	profile, err := deployment.ParseProfile(value)
	if err != nil {
		return "", fmt.Errorf("machine %w", err)
	}
	return profile, nil
}

func RuntimeProfile(name ProfileName) (Profile, error) {
	switch name {
	case Development:
		return Profile{
			Name: Development, Channel: tuf.BetaChannel,
			InstallationRoot:            DevelopmentInstallationRoot,
			ReleaseStateRoot:            DevelopmentReleaseStateRoot,
			RuntimeRoot:                 DevelopmentRuntimeRoot,
			RepositoryTransport:         tuf.LoopbackHTTPTransport,
			GuestRegistryOrigin:         developmentGuestRegistryOrigin,
			DashboardURL:                developmentDashboardURL,
			APIURL:                      developmentAPIURL,
			TrustedObjectStorageOrigins: []string{developmentObjectStorageOrigin},
		}, nil
	case Production:
		return Profile{
			Name: Production, Channel: tuf.StableChannel,
			InstallationRoot:    productionInstallationRoot,
			ReleaseStateRoot:    productionReleaseStateRoot,
			RuntimeRoot:         productionRuntimeRoot,
			RepositoryOrigin:    tuf.DefaultRepositoryOrigin,
			AssetOrigin:         tuf.DefaultAssetOrigin,
			CommandLink:         productionCommandLink,
			RepositoryTransport: tuf.HTTPSOnlyTransport,
			GuestRegistryOrigin: productionGuestRegistryOrigin,
			DashboardURL:        productionDashboardURL,
			APIURL:              ProductionAPIOrigin + apiBasePath,
			ProductionSecurity:  true,
		}, nil
	default:
		return Profile{}, fmt.Errorf("unsupported Snapflow profile %q", name)
	}
}

func ReleaseProfile(name ProfileName, source RepositorySource) (Profile, error) {
	profile, err := RuntimeProfile(name)
	if err != nil {
		return Profile{}, err
	}
	providedOrigin := strings.TrimSpace(source.Origin)
	providedRoot := strings.TrimSpace(source.BootstrapRoot)
	if name != Development {
		if providedOrigin != "" || providedRoot != "" {
			return Profile{}, errors.New("repository overrides are accepted only by the development profile")
		}
		return profile, nil
	}
	if providedOrigin == "" || providedRoot == "" {
		return Profile{}, errors.New("development repository origin and bootstrap root are required")
	}
	if !filepath.IsAbs(providedRoot) {
		return Profile{}, errors.New("development bootstrap root must be absolute")
	}
	profile.RepositoryOrigin = strings.TrimRight(providedOrigin, "/")
	profile.AssetOrigin = profile.RepositoryOrigin + developmentAssetsPath
	profile.BootstrapRoot = filepath.Clean(providedRoot)
	return profile, nil
}

func (profile Profile) RepositoryConfig(client *http.Client) (tuf.ClientConfig, error) {
	root, err := profile.bootstrapRoot()
	if err != nil {
		return tuf.ClientConfig{}, err
	}
	return tuf.ClientConfig{
		Origin: profile.RepositoryOrigin, AssetOrigin: profile.AssetOrigin, BootstrapRoot: root,
		StateRoot: profile.ReleaseStateRoot, HTTPClient: client,
		Transport: profile.RepositoryTransport,
	}, nil
}

func (profile Profile) bootstrapRoot() ([]byte, error) {
	if profile.BootstrapRoot == "" {
		return tuf.EmbeddedRoot()
	}
	file, err := os.Open(profile.BootstrapRoot)
	if err != nil {
		return nil, fmt.Errorf("open bootstrap TUF root: %w", err)
	}
	root, err := io.ReadAll(io.LimitReader(file, maximumBootstrapBytes+1))
	if err = errors.Join(err, file.Close()); err != nil {
		return nil, fmt.Errorf("read bootstrap TUF root: %w", err)
	}
	if len(root) > maximumBootstrapBytes {
		return nil, errors.New("bootstrap TUF root exceeds its size limit")
	}
	return root, nil
}
