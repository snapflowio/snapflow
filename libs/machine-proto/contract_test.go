// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package machineproto_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
)

const (
	fixtureDirectory = "testdata"
	fixtureExtension = ".json"
	payloadSuffix    = "Payload"
)

func controlDocuments() map[protoreflect.FileDescriptor]map[protoreflect.Name]bool {
	return map[protoreflect.FileDescriptor]map[protoreflect.Name]bool{
		machinev1alpha1.File_machine_v1alpha1_desired_state_proto: {
			"MachineDesiredState":               true,
			"SandboxObservedStatusReport":       true,
			"SandboxObservedStatusReportResult": true,
			"SandboxSecrets":                    true,
		},
		machinev1alpha1.File_machine_v1alpha1_snapshot_proto: {
			"MachineSnapshotInventory":    true,
			"SnapshotRegistryCredentials": true,
		},
	}
}

func contractMessages() map[string]protoreflect.MessageDescriptor {
	contract := make(map[string]protoreflect.MessageDescriptor)
	jobMessages := machinev1alpha1.File_machine_v1alpha1_job_proto.Messages()
	for index := range jobMessages.Len() {
		descriptor := jobMessages.Get(index)
		if name := string(descriptor.Name()); strings.HasSuffix(name, payloadSuffix) {
			contract[name] = descriptor
		}
	}
	for file, documents := range controlDocuments() {
		messages := file.Messages()
		for index := range messages.Len() {
			descriptor := messages.Get(index)
			if documents[descriptor.Name()] {
				contract[string(descriptor.Name())] = descriptor
			}
		}
	}
	return contract
}

func TestEveryContractMessageHasAFixture(t *testing.T) {
	fixtures, err := filepath.Glob(filepath.Join(fixtureDirectory, "*"+fixtureExtension))
	if err != nil {
		t.Fatalf("list fixtures: %v", err)
	}
	names := make(map[string]bool, len(fixtures))
	for _, fixture := range fixtures {
		names[strings.TrimSuffix(filepath.Base(fixture), fixtureExtension)] = true
	}
	contract := contractMessages()
	if len(contract) != len(names) {
		t.Errorf("found %d contract messages and %d fixtures", len(contract), len(names))
	}
	for name := range contract {
		if !names[name] {
			t.Errorf("contract message %s has no %s fixture", name, filepath.Join(fixtureDirectory, name+fixtureExtension))
		}
	}
	for name := range names {
		if _, ok := contract[name]; !ok {
			t.Errorf("fixture %s does not name a contract message", name)
		}
	}
}

func TestEveryControlDocumentExists(t *testing.T) {
	for file, documents := range controlDocuments() {
		for name := range documents {
			if file.Messages().ByName(name) == nil {
				t.Errorf("control document %s is not defined in %s", name, file.Path())
			}
		}
	}
}

func TestFixturesRoundTripThroughGeneratedTypes(t *testing.T) {
	for name, descriptor := range contractMessages() {
		t.Run(name, func(t *testing.T) {
			fixture, err := os.ReadFile(filepath.Join(fixtureDirectory, name+fixtureExtension))
			if err != nil {
				t.Fatalf("read fixture: %v", err)
			}
			messageType, err := protoregistry.GlobalTypes.FindMessageByName(descriptor.FullName())
			if err != nil {
				t.Fatalf("find generated type: %v", err)
			}
			message := messageType.New().Interface()
			if err := protojson.Unmarshal(fixture, message); err != nil {
				t.Fatalf("decode fixture with the generated schema: %v", err)
			}
			encoded, err := protojson.Marshal(message)
			if err != nil {
				t.Fatalf("encode message: %v", err)
			}
			assertSameJSON(t, fixture, encoded)
		})
	}
}

func TestDesiredStateSpecSourceIsExclusive(t *testing.T) {
	fixture, err := os.ReadFile(filepath.Join(fixtureDirectory, "MachineDesiredState"+fixtureExtension))
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	document := &machinev1alpha1.MachineDesiredState{}
	if err := protojson.Unmarshal(fixture, document); err != nil {
		t.Fatalf("decode fixture: %v", err)
	}
	if len(document.GetSandboxes()) == 0 {
		t.Fatal("fixture lists no sandboxes")
	}
	for _, sandbox := range document.GetSandboxes() {
		if sandbox.GetSpec().GetSource() == nil {
			t.Errorf("sandbox %s declares no runtime source", sandbox.GetSandboxId())
		}
		if sandbox.GetLifecycle() == machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_UNSPECIFIED {
			t.Errorf("sandbox %s declares no lifecycle", sandbox.GetSandboxId())
		}
	}
}

func assertSameJSON(t *testing.T, expected, actual []byte) {
	t.Helper()
	var expectedValue, actualValue any
	if err := json.Unmarshal(expected, &expectedValue); err != nil {
		t.Fatalf("parse fixture JSON: %v", err)
	}
	if err := json.Unmarshal(actual, &actualValue); err != nil {
		t.Fatalf("parse encoded JSON: %v", err)
	}
	if !reflect.DeepEqual(expectedValue, actualValue) {
		t.Fatalf("fixture does not survive a round trip\nfixture: %s\nencoded: %s", expected, actual)
	}
}
