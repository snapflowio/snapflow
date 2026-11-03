// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package microvm_test

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"os"
	"strings"
	"testing"
	"time"

	distributionreference "github.com/distribution/reference"
	"github.com/google/uuid"
	"github.com/opencontainers/go-digest"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/snapflowio/snapflow/internal/jobs/qualification"
	"github.com/snapflowio/snapflow/internal/release"
	"github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/runtime/microvm"
	"github.com/snapflowio/snapflow/internal/sandbox"
)

const (
	kvmIntegrationEnvironment = "SNAPFLOW_PLATFORM_KVM_INTEGRATION"
	releaseRootEnvironment    = "SNAPFLOW_RELEASE_ROOT"
	releaseDigestEnvironment  = "SNAPFLOW_RELEASE_DIGEST"
	guestRegistryEnvironment  = "SNAPFLOW_GUEST_REGISTRY_URL"
	canarySnapshotEnvironment = "SNAPFLOW_CANARY_SNAPSHOT"
	canaryTimeout             = 20 * time.Minute
	canaryCleanupTimeout      = 2 * time.Minute
	canaryNonceBytes          = 32
)

func TestSnapflowReleaseKVMCanary(t *testing.T) {
	if os.Getenv(kvmIntegrationEnvironment) != "1" {
		t.Skipf("set %s=1 to boot a Snapflow release on KVM", kvmIntegrationEnvironment)
	}
	releaseRoot := requiredEnvironment(t, releaseRootEnvironment)
	releaseDigest := requiredEnvironment(t, releaseDigestEnvironment)
	if parsed, err := digest.Parse(releaseDigest); err != nil || parsed.Algorithm() != digest.SHA256 {
		t.Fatalf("%s must be a SHA-256 digest, got %q", releaseDigestEnvironment, releaseDigest)
	}
	guestRegistryURL := requiredEnvironment(t, guestRegistryEnvironment)
	canarySnapshot := requiredEnvironment(t, canarySnapshotEnvironment)
	parsedSnapshot, err := distributionreference.ParseAnyReference(canarySnapshot)
	if err != nil {
		t.Fatalf("parse %s: %v", canarySnapshotEnvironment, err)
	}
	if _, immutable := parsedSnapshot.(distributionreference.Digested); !immutable {
		t.Fatalf("%s must use an immutable digest, got %q", canarySnapshotEnvironment, canarySnapshot)
	}

	verified, err := release.LoadVerified(releaseRoot, release.VerifyConfig{RequireRootOwnership: true})
	if err != nil {
		t.Fatalf("verify Snapflow release at %s: %v", releaseRoot, err)
	}
	verified.BundleDigest = releaseDigest

	ctx, cancel := context.WithTimeout(t.Context(), canaryTimeout)
	t.Cleanup(cancel)
	dataDir, err := os.MkdirTemp("", "snapflow-canary-")
	if err != nil {
		t.Fatalf("create microVM data directory: %v", err)
	}
	t.Cleanup(func() {
		if err := os.RemoveAll(dataDir); err != nil {
			t.Errorf("remove microVM data directory: %v", err)
		}
	})

	preflight, err := microvm.HostPreflight(dataDir, verified.Assets.MkfsErofs)
	if err != nil {
		t.Fatalf("run microVM host preflight: %v", err)
	}
	if err := runtime.RequireHost(preflight); err != nil {
		t.Fatal(err)
	}
	engine, err := microvm.Open(ctx, microvm.EngineConfig{
		DataDir: dataDir, Release: verified, GuestRegistryURL: guestRegistryURL,
		HostServicePorts: nil,
		Preflight:        preflight,
	})
	if err != nil {
		t.Fatalf("open microVM runtime from Snapflow release: %v", err)
	}
	sandboxRuntime := engine.Runtime
	t.Cleanup(func() { destroyLeakedSandboxes(t, sandboxRuntime) })

	manifest := verified.Manifest
	requireReleaseRuntime(ctx, t, sandboxRuntime, manifest, releaseDigest)

	if err := qualification.RunCanaryMicroVM(ctx, qualification.Config{
		Runtime: sandboxRuntime, LocalRuntimes: sandbox.NewLocalRuntimes(),
		Converger:     canaryConverger(t, sandboxRuntime, manifest.FileIdentity(release.RoleSnapflowd), releaseDigest),
		ReleaseDigest: releaseDigest,
	}, qualification.Request{
		ChallengeID: uuid.NewString(), MachineID: uuid.NewString(), Nonce: canaryNonce(t),
		Canary: qualification.Canary{Snapshot: canarySnapshot, CPU: 1, MemoryGiB: 1, StorageGiB: 1},
	}); err != nil {
		t.Fatalf("run canary microVM: %v", err)
	}
	inventory, err := sandboxRuntime.RuntimeInventory(ctx)
	if err != nil {
		t.Fatalf("inspect runtime inventory after canary: %v", err)
	}
	for _, observation := range inventory {
		t.Errorf("canary left runtime instance %s behind", observation.ID)
	}
}

func requiredEnvironment(t *testing.T, name string) string {
	t.Helper()
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		t.Fatalf("%s is required when %s=1", name, kvmIntegrationEnvironment)
	}
	return value
}

func canaryNonce(t *testing.T) string {
	t.Helper()
	nonce := make([]byte, canaryNonceBytes)
	if _, err := rand.Read(nonce); err != nil {
		t.Fatalf("generate canary nonce: %v", err)
	}
	return hex.EncodeToString(nonce)
}

func destroyLeakedSandboxes(t *testing.T, sandboxRuntime *microvm.Runtime) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), canaryCleanupTimeout)
	defer cancel()
	inventory, err := sandboxRuntime.RuntimeInventory(ctx)
	if err != nil {
		t.Errorf("inspect runtime inventory during cleanup: %v", err)
		return
	}
	for _, observation := range inventory {
		if err := sandboxRuntime.Stop(ctx, runtime.Assignment{
			SandboxID: observation.ID, Generation: uint32(observation.Identity.AssignmentGeneration),
		}, true); err != nil {
			t.Logf("force-stop leaked canary instance %s: %v", observation.ID, err)
		}
		if err := sandboxRuntime.Destroy(ctx, observation.ID); err != nil {
			t.Errorf("destroy leaked canary instance %s: %v", observation.ID, err)
		}
	}
}

type unusedSecrets struct {
	sandbox.SecretSource
}

type unusedMeter struct {
	sandbox.UsageMeter
}

type pulledSnapshots struct{}

func (pulledSnapshots) Ensure(ctx context.Context, ref string) (func(), error) {
	return func() {}, ctx.Err()
}

func canaryConverger(t *testing.T, sandboxRuntime *microvm.Runtime, runtimeIdentity, releaseIdentity string) *sandbox.Converger {
	t.Helper()
	metrics, err := sandbox.NewMetrics(prometheus.NewRegistry())
	if err != nil {
		t.Fatalf("NewMetrics() error = %v", err)
	}
	converger, err := sandbox.NewConverger(
		sandbox.ConvergerConfig{RuntimeIdentity: runtimeIdentity, ReleaseIdentity: releaseIdentity},
		sandbox.ConvergerDependencies{
			Runtime: sandboxRuntime, Secrets: unusedSecrets{}, Snapshots: pulledSnapshots{}, Meter: unusedMeter{}, Metrics: metrics,
		},
	)
	if err != nil {
		t.Fatalf("NewConverger() error = %v", err)
	}
	return converger
}

func requireReleaseRuntime(ctx context.Context, t *testing.T, sandboxRuntime *microvm.Runtime, manifest release.Manifest, releaseDigest string) {
	t.Helper()
	for _, health := range sandboxRuntime.Health(ctx) {
		if !health.Healthy {
			t.Fatalf("runtime service %s is unhealthy: %v", health.Name, health.Error)
		}
	}
	capabilities, err := sandboxRuntime.Capabilities(ctx)
	if err != nil {
		t.Fatalf("inspect runtime capabilities: %v", err)
	}
	if capabilities.MachineReleaseDigest != releaseDigest {
		t.Fatalf("runtime reports release %s, expected %s", capabilities.MachineReleaseDigest, releaseDigest)
	}
	if capabilities.MachineReleaseVersion != manifest.Version {
		t.Fatalf("runtime reports release %s, manifest declares %s", capabilities.MachineReleaseVersion, manifest.Version)
	}
	if !strings.HasSuffix(manifest.Guest.Reference, "@"+capabilities.GuestReleaseDigest) {
		t.Fatalf("runtime prepared guest release %s, manifest pins %s", capabilities.GuestReleaseDigest, manifest.Guest.Reference)
	}
}
