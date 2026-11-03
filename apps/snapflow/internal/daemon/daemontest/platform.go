// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemontest

import (
	"context"
	"errors"
	"slices"
	"sync"

	"github.com/snapflowio/microvm-go/host"
	"github.com/snapflowio/snapflow/internal/daemon"
	"github.com/snapflowio/snapflow/internal/release"
	"github.com/snapflowio/snapflow/internal/state"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const (
	guestRegistryURL    = "http://registry:5000"
	guestReference      = "registry:5000/snapflow/guest@sha256:" + zeroDigestHex
	zeroDigestHex       = "0000000000000000000000000000000000000000000000000000000000000000"
	bundleDigest        = "sha256:" + zeroDigestHex
	machineFileIdentity = "sha256:1111111111111111111111111111111111111111111111111111111111111111"
	releaseVersion      = "0.0.0-daemontest"
	vaultBackend        = "daemontest-memory"
	controlProtocol     = 1
)

var errSecretNotFound = errors.New("daemontest vault has no such secret")

func loadRelease(installationRoot string) (release.VerifiedRelease, error) {
	return release.VerifiedRelease{
		Root:         installationRoot,
		BundleDigest: bundleDigest,
		Manifest: release.Manifest{
			Guest: release.GuestRelease{Reference: guestReference, ControlProtocolVersion: controlProtocol},
			Files: []release.File{{Role: release.RoleSnapflowd, SHA256: machineFileIdentity}},
		},
	}, nil
}

func preflight(string, string) (host.PreflightReport, error) {
	return host.PreflightReport{
		KVMAvailable: true, NetworkPolicyAvailable: true, IPv4ForwardingEnabled: true,
		HostToolsAvailable: true, JailCgroupAvailable: true, SystemdAvailable: true, FirecrackerTemplateAvailable: true,
	}, nil
}

func probeHost(context.Context) (host.HostGPUInfo, daemon.HostInventory) {
	return host.HostGPUInfo{}, func(context.Context) (*machinev1alpha1.HostInventory, error) {
		return &machinev1alpha1.HostInventory{}, nil
	}
}

type Vault struct {
	mu      sync.Mutex
	secrets map[string][]byte
}

func newVault() *Vault {
	return &Vault{secrets: make(map[string][]byte)}
}

func (vault *Vault) Backend() string {
	return vaultBackend
}

func (vault *Vault) Put(ctx context.Context, reference string, value []byte) error {
	vault.mu.Lock()
	defer vault.mu.Unlock()
	vault.secrets[reference] = slices.Clone(value)
	return ctx.Err()
}

func (vault *Vault) Get(ctx context.Context, reference string) ([]byte, error) {
	vault.mu.Lock()
	defer vault.mu.Unlock()
	value, found := vault.secrets[reference]
	if !found {
		return nil, errSecretNotFound
	}
	return slices.Clone(value), ctx.Err()
}

func (vault *Vault) Delete(ctx context.Context, reference string) error {
	vault.mu.Lock()
	defer vault.mu.Unlock()
	delete(vault.secrets, reference)
	return ctx.Err()
}

func (vault *Vault) open(string) (state.Vault, error) {
	return vault, nil
}
