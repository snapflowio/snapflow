// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package workload

import (
	"errors"
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
)

func contractFixtures() string {
	return filepath.Join("..", "..", "..", "..", "libs", "machine-proto", "testdata")
}

const (
	fixturePackage            = "machine.v1alpha1."
	desiredStateFixture       = "MachineDesiredState.json"
	tamperedDigest            = "0000000000000000000000000000000000000000000000000000000000000000"
	fixtureEgressBandwidthBPS = 1_000_000
)

func readFixture(t *testing.T, name string) string {
	t.Helper()
	payload, err := os.ReadFile(filepath.Join(contractFixtures(), name))
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	return string(payload)
}

func TestDecodeAcceptsEveryContractFixture(t *testing.T) {
	fixtures, err := filepath.Glob(filepath.Join(contractFixtures(), "*.json"))
	if err != nil || len(fixtures) == 0 {
		t.Fatalf("list contract fixtures: %v (found %d)", err, len(fixtures))
	}
	for _, fixture := range fixtures {
		name := strings.TrimSuffix(filepath.Base(fixture), filepath.Ext(fixture))
		t.Run(name, func(t *testing.T) {
			messageType, err := protoregistry.GlobalTypes.FindMessageByName(protoreflect.FullName(fixturePackage + name))
			if err != nil {
				t.Fatalf("find message type: %v", err)
			}
			message := messageType.New().Interface()
			if !hasValidationRules(message) {
				return
			}
			if err := Decode(readFixture(t, filepath.Base(fixture)), message); err != nil {
				t.Fatalf("decode contract fixture: %v", err)
			}
		})
	}
}

func hasValidationRules(message proto.Message) bool {
	switch message.(type) {
	case *machinev1alpha1.SandboxObservedStatusReport, *machinev1alpha1.MachineSnapshotInventory:
		return false
	default:
		return true
	}
}

func TestDesiredStateDigestMatchesTheAPI(t *testing.T) {
	document := &machinev1alpha1.MachineDesiredState{}
	if err := Decode(readFixture(t, desiredStateFixture), document); err != nil {
		t.Fatalf("decode desired state: %v", err)
	}
	if got := document.GetSandboxes()[1].GetSpec().GetNetwork().GetEgressBandwidthBps(); got != fixtureEgressBandwidthBPS {
		t.Fatalf("egress bandwidth decoded as %d", got)
	}
}

func TestDecodeRejectsTamperedDesiredState(t *testing.T) {
	tests := map[string]func(*machinev1alpha1.MachineDesiredState){
		"document digest": func(document *machinev1alpha1.MachineDesiredState) { document.Digest = tamperedDigest },
		"spec content":    func(document *machinev1alpha1.MachineDesiredState) { document.Sandboxes[0].Spec.OsUser = "root" },
		"missing source":  func(document *machinev1alpha1.MachineDesiredState) { document.Sandboxes[0].Spec.Source = nil },
		"duplicate sandbox": func(document *machinev1alpha1.MachineDesiredState) {
			document.Sandboxes = append(document.Sandboxes, document.Sandboxes[0])
		},
		"unspecified lifecycle": func(document *machinev1alpha1.MachineDesiredState) {
			document.Sandboxes[0].Lifecycle = machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_UNSPECIFIED
		},
		"duplicate snapshot": func(document *machinev1alpha1.MachineDesiredState) {
			document.Snapshots = append(document.Snapshots, document.Snapshots[0])
		},
		"snapshot without source": func(document *machinev1alpha1.MachineDesiredState) { document.Snapshots[0].Source = nil },
	}
	for name, tamper := range tests {
		t.Run(name, func(t *testing.T) {
			document := &machinev1alpha1.MachineDesiredState{}
			if err := protojson.Unmarshal([]byte(readFixture(t, desiredStateFixture)), document); err != nil {
				t.Fatalf("decode fixture: %v", err)
			}
			tamper(document)
			encoded, err := protojson.Marshal(document)
			if err != nil {
				t.Fatalf("encode document: %v", err)
			}
			assertInvalidRequest(t, Decode(string(encoded), &machinev1alpha1.MachineDesiredState{}))
		})
	}
}

func TestDecodeRejectsUnknownFields(t *testing.T) {
	err := Decode(`{"targetSizeGiB":1,"skipStart":true}`, &machinev1alpha1.ResizeVolumePayload{})
	assertInvalidRequest(t, err)
}

func TestDecodeRejectsMissingPayload(t *testing.T) {
	err := Decode("", &machinev1alpha1.ResizeVolumePayload{})
	assertInvalidRequest(t, err)
	if !errors.Is(err, errPayloadRequired) {
		t.Fatalf("expected the missing payload error, got %v", err)
	}
}

func TestDecodeRequiresJobAssignmentGeneration(t *testing.T) {
	err := Decode(`{"name":"snapshot","registry":{"url":"https://registry.example.com"}}`, &machinev1alpha1.SnapshotSandboxPayload{})
	assertInvalidRequest(t, err)
}

func TestDecodeRejectsMessagesWithoutRules(t *testing.T) {
	assertInvalidRequest(t, Decode(`{}`, &machinev1alpha1.SandboxObservedStatusReport{}))
}

func TestDecodeDecodesUint64Strings(t *testing.T) {
	payload := &machinev1alpha1.MachineDesiredState{}
	err := protojson.Unmarshal([]byte(`{"revision":"18446744073709551615"}`), payload)
	if err != nil || payload.GetRevision() != math.MaxUint64 {
		t.Fatalf("revision decoded as %d: %v", payload.GetRevision(), err)
	}
}

func assertInvalidRequest(t *testing.T, err error) {
	t.Helper()
	var coded interface{ ErrorCode() string }
	if !errors.As(err, &coded) || coded.ErrorCode() != InvalidRequestErrorCode {
		t.Fatalf("expected an %s error, got %v", InvalidRequestErrorCode, err)
	}
}
