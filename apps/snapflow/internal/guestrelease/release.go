// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package guestrelease

import (
	"errors"
	"fmt"
	"strings"

	"github.com/distribution/reference"
	"github.com/opencontainers/go-digest"
	"github.com/snapflowio/common-go/pkg/guestspec"
	"github.com/snapflowio/microvm-go/guest"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
)

const (
	BenchmarkArtifactName         = "benchmark"
	ToolboxVersionPath            = "/version"
	desktopAuthorizationHeader    = "Authorization"
	desktopProjectEnvironment     = "SNAPFLOW_DESKTOP_PROJECT_DIR"
	desktopSandboxUserEnvironment = "SNAPFLOW_SANDBOX_USER"
)

type releaseConfig struct {
	Version        string
	Digest         string
	Platform       string
	CoreImage      string
	DesktopImage   string
	BenchmarkImage string
}

type Release struct {
	Digest         string
	Version        string
	Platform       string
	Bundles        []guest.Bundle
	Artifacts      []sandboxruntime.PlatformArtifact
	BenchmarkImage string
}

func newRelease(cfg releaseConfig) (*Release, error) {
	version := strings.TrimSpace(cfg.Version)
	if version == "" {
		return nil, errors.New("guest release version is required")
	}
	releaseDigest, err := parseSHA256Digest(cfg.Digest)
	if err != nil {
		return nil, fmt.Errorf("guest release digest: %w", err)
	}
	platform := strings.TrimSpace(cfg.Platform)
	if platform == "" {
		return nil, errors.New("guest release platform is required")
	}
	coreDigest, err := immutableImageDigest(cfg.CoreImage)
	if err != nil {
		return nil, fmt.Errorf("core artifact: %w", err)
	}
	if _, err := immutableImageDigest(cfg.BenchmarkImage); err != nil {
		return nil, fmt.Errorf("benchmark artifact: %w", err)
	}
	desktopImage := strings.TrimSpace(cfg.DesktopImage)
	bundles := []guest.Bundle{coreBundle(version, releaseDigest.String(), strings.TrimSpace(cfg.CoreImage), desktopImage)}
	artifacts := []sandboxruntime.PlatformArtifact{{
		Name: guestspec.CoreArtifactName, Digest: coreDigest.String(), Platform: platform,
		Capabilities:    []string{string(guest.SandboxCapabilityDeveloperTools)},
		ProtocolVersion: guest.ControlProtocolVersion,
	}}
	if desktopImage != "" {
		desktopDigest, err := immutableImageDigest(desktopImage)
		if err != nil {
			return nil, fmt.Errorf("desktop artifact: %w", err)
		}
		bundles = append(bundles, desktopBundle(version, releaseDigest.String(), desktopImage))
		artifacts = append(artifacts, sandboxruntime.PlatformArtifact{
			Name: guestspec.DesktopArtifactName, Digest: desktopDigest.String(), Platform: platform,
			Capabilities: []string{
				string(guest.SandboxCapabilityDesktop),
				string(guest.SandboxCapabilityDeveloperTools),
			},
			ProtocolVersion: guest.ControlProtocolVersion,
		})
	}
	if err := guest.ValidateBundles(bundles); err != nil {
		return nil, fmt.Errorf("validate guest release bundles: %w", err)
	}

	return &Release{
		Digest: releaseDigest.String(), Version: version, Platform: platform,
		Bundles:        bundles,
		Artifacts:      artifacts,
		BenchmarkImage: strings.TrimSpace(cfg.BenchmarkImage),
	}, nil
}

func coreBundle(version, releaseDigest, image, desktopImage string) guest.Bundle {
	return guest.Bundle{
		Name: guestspec.CoreArtifactName, Version: version, ReleaseDigest: releaseDigest,
		Image: image, Required: true,
		Capabilities: []guest.SandboxCapability{guest.SandboxCapabilityDeveloperTools},
		MountPath:    guestspec.CoreMountPath,
		Components: []guest.Manifest{{
			Name: guestspec.CoreArtifactName, Version: version, GuestPath: guestspec.GuestDaemonPath,
			Activation: guest.ActivationRequired, ControlProtocolVersion: guest.ControlProtocolVersion,
			LifecycleSocket: guestspec.LifecycleSocket,
			Capabilities:    []guest.Capability{guest.CapabilityWorkloadInit},
			Env: map[string]string{
				guestspec.BindAddressEnvironment: guest.ServiceLoopbackAddress,
			},
			Services: []guest.Service{
				{
					Name: guestspec.ToolboxService, Port: guestspec.ToolboxPort,
					AuthHeader: guestspec.AuthHeader, Credential: true,
					HealthPath: ToolboxVersionPath,
				},
				{Name: guestspec.SSHService, Port: guestspec.SSHPort, Credential: true},
				{
					Name: guestspec.TerminalService, Port: guestspec.TerminalPort,
					AuthHeader: guestspec.AuthHeader, Credential: true,
				},
			},
			CapabilityExtensions: coreCapabilityExtensions(desktopImage),
		}},
	}
}

func desktopBundle(version, releaseDigest, image string) guest.Bundle {
	return guest.Bundle{
		Name: guestspec.DesktopArtifactName, Version: version, ReleaseDigest: releaseDigest,
		Image: image,
		Capabilities: []guest.SandboxCapability{
			guest.SandboxCapabilityDesktop,
			guest.SandboxCapabilityDeveloperTools,
		},
		MountPath: guestspec.DesktopMountPath,
		Components: []guest.Manifest{{
			Name: guestspec.DesktopArtifactName, Version: version, GuestPath: guestspec.ComputerUsePluginPath,
			Activation:             guest.ActivationOnDemand,
			SandboxCapability:      guest.SandboxCapabilityDesktop,
			ControlProtocolVersion: guest.ControlProtocolVersion,
		}},
	}
}

func coreCapabilityExtensions(desktopImage string) []guest.CapabilityExtension {
	if desktopImage == "" {
		return nil
	}
	return []guest.CapabilityExtension{{
		SandboxCapability: guest.SandboxCapabilityDesktop,
		EnvSources: map[string]guest.EnvironmentSource{
			desktopProjectEnvironment:     guest.EnvironmentSourceSandboxWorkdir,
			desktopSandboxUserEnvironment: guest.EnvironmentSourceSandboxOSUser,
		},
		Services: []guest.Service{{
			Name: guestspec.DesktopService, Port: guestspec.DesktopPort,
			AuthHeader: desktopAuthorizationHeader,
			AuthScheme: guest.ServiceAuthBasic,
			Credential: true,
		}},
	}}
}

func immutableImageDigest(image string) (digest.Digest, error) {
	named, err := reference.ParseNormalizedNamed(strings.TrimSpace(image))
	if err != nil {
		return "", fmt.Errorf("parse OCI image reference: %w", err)
	}
	digested, ok := named.(reference.Digested)
	if !ok {
		return "", errors.New("image OCI reference must be digest-pinned")
	}
	return parseSHA256Digest(digested.Digest().String())
}

func parseSHA256Digest(value string) (digest.Digest, error) {
	parsed, err := digest.Parse(strings.TrimSpace(value))
	if err != nil {
		return "", err
	}
	if parsed.Algorithm() != digest.SHA256 {
		return "", fmt.Errorf("digest algorithm must be %s", digest.SHA256)
	}
	if err := parsed.Validate(); err != nil {
		return "", err
	}
	return parsed, nil
}
