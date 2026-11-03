// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package benchmark

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"encoding/json"
	"slices"
	"strings"
	"testing"
	"time"

	microvmtypes "github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/jobs/benchmark/suite"
	"github.com/snapflowio/snapflow/internal/jobs/canary"
	"github.com/snapflowio/snapflow/internal/state"
	"github.com/snapflowio/snapflow/internal/workload"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"github.com/snapflowio/tunnel-go/canonicaljson"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/timestamppb"
)

const (
	testMachineID   = "8a3c1f9e-5f0c-4c55-9d43-3b8f2f4f1f11"
	testOwnerID     = "3f6c2a1e-9b7d-4c58-8e21-6a0d4b9f7c13"
	testBenchmarkID = "d4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a"
	testAPIURL      = "https://api.snapflow.io/api"
	testNonce       = "6a09e667f3bcc908bb67ae8584caa73b3c6ef372fe94f82ba54ff53a5f1d36f1"
	testImage       = "registry:5000/snapflowio/platform@sha256:5555555555555555555555555555555555555555555555555555555555555555"
	testSpeedtest   = "https://edge.example.com/_snapflow/speedtest"
	testToken       = testBenchmarkID + ".dG9rZW4"
	testShapeCPU    = 8
	testShapeMemory = 64
	testShapeDisk   = 200
	testShapeGPU    = 1
	testLifetime    = time.Hour
	testInventory   = "4c4c4544004235108051b4c04f565432"
)

func testIdentity(t *testing.T) *state.Identity {
	t.Helper()
	publicKey, privateKey, err := state.GenerateSigningKey()
	if err != nil {
		t.Fatal(err)
	}
	keyID, err := state.KeyID(publicKey)
	if err != nil {
		t.Fatal(err)
	}
	return &state.Identity{APIURL: testAPIURL, MachineID: testMachineID, OwnerID: testOwnerID, KeyID: keyID, SigningKey: privateKey}
}

func testChallenge(now time.Time) *machinev1alpha1.BenchmarkMachinePayload {
	return &machinev1alpha1.BenchmarkMachinePayload{
		BenchmarkId: testBenchmarkID, Nonce: testNonce, SuiteVersion: suite.SuiteVersion,
		Shape: &machinev1alpha1.BenchmarkShape{
			Cpu: testShapeCPU, MemoryGib: testShapeMemory, DiskGib: testShapeDisk, Gpu: testShapeGPU,
		},
		SpeedtestUrl: testSpeedtest, SpeedtestToken: testToken,
		IssuedAt: timestamppb.New(now), ExpiresAt: timestamppb.New(now.Add(testLifetime)),
	}
}

func encodedJob(t *testing.T, resourceID string, challenge *machinev1alpha1.BenchmarkMachinePayload) Job {
	t.Helper()
	encoded, err := protojson.Marshal(challenge)
	if err != nil {
		t.Fatal(err)
	}
	return Job{ResourceID: resourceID, Payload: string(encoded)}
}

func TestDecodeChallengeAcceptsAValidChallenge(t *testing.T) {
	now := time.Now()
	challenge, err := decodeChallenge(encodedJob(t, testMachineID, testChallenge(now)), testMachineID, now)
	if err != nil {
		t.Fatal(err)
	}
	spec := benchmarkSpec(challenge, testImage, testMachineID)
	resources := spec.GetResources()
	if spec.GetMode() != string(workload.SandboxModeStandard) || resources.GetCpuQuota() != testShapeCPU ||
		resources.GetMemoryQuota() != testShapeMemory || resources.GetStorageQuota() != testShapeDisk ||
		resources.GetGpuQuota() != testShapeGPU || spec.GetImage().GetRef() != testImage ||
		!slices.Contains(spec.GetCapabilities(), string(workload.SandboxCapabilityDirectIO)) {
		t.Fatalf("benchmark spec = %v", spec)
	}
}

func TestDecodeChallengeRejectsOtherMachinesAndExpiredChallenges(t *testing.T) {
	now := time.Now()
	if _, err := decodeChallenge(encodedJob(t, testOwnerID, testChallenge(now)), testMachineID, now); err == nil {
		t.Fatal("a challenge addressed to another Machine was accepted")
	}
	expired := testChallenge(now.Add(-2 * testLifetime))
	if _, err := decodeChallenge(encodedJob(t, testMachineID, expired), testMachineID, now); err == nil {
		t.Fatal("an expired challenge was accepted")
	}
	unsupported := testChallenge(now)
	unsupported.SuiteVersion = suite.SuiteVersion + 1
	if _, err := decodeChallenge(encodedJob(t, testMachineID, unsupported), testMachineID, now); err == nil {
		t.Fatal("an unsupported suite version was accepted")
	}
	malformed := testChallenge(now)
	malformed.Nonce = "short"
	if _, err := decodeChallenge(encodedJob(t, testMachineID, malformed), testMachineID, now); err == nil {
		t.Fatal("a malformed nonce was accepted")
	}
}

func TestSignedResultVerifiesTheWayTheAPIChecksIt(t *testing.T) {
	identity := testIdentity(t)
	now := time.Now()
	measurements := &machinev1alpha1.BenchmarkMeasurements{
		Cpu:    &machinev1alpha1.CpuMeasurement{Threads: testShapeCPU, IterationsPerThread: 1 << 40, Root: bytes.Repeat([]byte{1}, 32)},
		Memory: &machinev1alpha1.MemoryMeasurement{Bytes: 1 << 20},
	}
	inventory := &machinev1alpha1.HostInventory{InventoryDigest: testInventory}
	encoded, err := sign(identity, testChallenge(now), testImage, measurements, inventory, now)
	if err != nil {
		t.Fatal(err)
	}
	received := map[string]any{}
	decoder := json.NewDecoder(bytes.NewReader(encoded))
	decoder.UseNumber()
	if err := decoder.Decode(&received); err != nil {
		t.Fatal(err)
	}
	result := &machinev1alpha1.BenchmarkMachineResult{}
	if err := protojson.Unmarshal(encoded, result); err != nil {
		t.Fatal(err)
	}
	delete(received, signatureField)
	payload, err := canonicaljson.Marshal(received)
	if err != nil {
		t.Fatal(err)
	}
	publicKey, isEd25519 := identity.SigningKey.Public().(ed25519.PublicKey)
	if !isEd25519 || !ed25519.Verify(publicKey, payload, result.GetSignature()) {
		t.Fatal("the signature does not verify over the canonical result without its signature")
	}
	if result.GetMachineKeyId() != identity.KeyID || result.GetBenchmarkId() != testBenchmarkID ||
		!strings.Contains(string(payload), `"bandwidthMibps":0`) {
		t.Fatalf("signed result = %s", payload)
	}
}

type startedRuntime struct {
	canary.Runtime
	states []microvmtypes.RuntimeState
}

func (runtime startedRuntime) RuntimeInventory(context.Context) ([]microvmtypes.RuntimeObservation, error) {
	observations := make([]microvmtypes.RuntimeObservation, 0, len(runtime.states))
	for _, observed := range runtime.states {
		observations = append(observations, microvmtypes.RuntimeObservation{Info: microvmtypes.RuntimeInfo{State: observed}})
	}
	return observations, nil
}

func TestAssertIdleRefusesWhileSandboxesRun(t *testing.T) {
	if err := assertIdle(context.Background(), startedRuntime{states: []microvmtypes.RuntimeState{microvmtypes.RuntimeStateStopped}}); err != nil {
		t.Fatalf("a machine with only stopped sandboxes is not idle: %v", err)
	}
	if err := assertIdle(context.Background(), startedRuntime{states: []microvmtypes.RuntimeState{microvmtypes.RuntimeStateStarted}}); err == nil {
		t.Fatal("a machine with a running sandbox passed the idle check")
	}
}
