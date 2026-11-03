// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package benchmark

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"

	"github.com/snapflowio/snapflow/internal/state"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"github.com/snapflowio/tunnel-go/canonicaljson"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/timestamppb"
)

const signatureField = "signature"

func resultEncoder() protojson.MarshalOptions {
	return protojson.MarshalOptions{EmitDefaultValues: true}
}

func sign(
	identity *state.Identity,
	challenge *machinev1alpha1.BenchmarkMachinePayload,
	benchmarkImage string,
	measurements *machinev1alpha1.BenchmarkMeasurements,
	inventory *machinev1alpha1.HostInventory,
	signedAt time.Time,
) (json.RawMessage, error) {
	result := &machinev1alpha1.BenchmarkMachineResult{
		BenchmarkId: challenge.GetBenchmarkId(), Measurements: measurements, HostInventory: inventory,
		MachineKeyId: identity.KeyID, SignedAt: timestamppb.New(signedAt), BenchmarkImage: benchmarkImage,
	}
	payload, err := SignedPayload(result)
	if err != nil {
		return nil, err
	}
	encodedSignature, err := identity.SignPayload(payload)
	if err != nil {
		return nil, fmt.Errorf("sign the machine benchmark result: %w", err)
	}
	if result.Signature, err = base64.RawURLEncoding.DecodeString(encodedSignature); err != nil {
		return nil, fmt.Errorf("decode the machine benchmark signature: %w", err)
	}
	encoded, err := resultEncoder().Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("encode the machine benchmark result: %w", err)
	}
	return encoded, nil
}

func SignedPayload(result *machinev1alpha1.BenchmarkMachineResult) ([]byte, error) {
	encoded, err := resultEncoder().Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("encode the machine benchmark result: %w", err)
	}
	decoder := json.NewDecoder(bytes.NewReader(encoded))
	decoder.UseNumber()
	fields := map[string]any{}
	if err := decoder.Decode(&fields); err != nil {
		return nil, fmt.Errorf("decode the machine benchmark result: %w", err)
	}
	delete(fields, signatureField)
	payload, err := canonicaljson.Marshal(fields)
	if err != nil {
		return nil, fmt.Errorf("canonicalize the machine benchmark result: %w", err)
	}
	return payload, nil
}
