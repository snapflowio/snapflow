// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	microvmtypes "github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	signatureDomain        = "snapflow.machine-usage.v5"
	pendingSignature       = "pending"
	genesisDigestCharacter = "0"
	decimalBase            = 10
)

func genesisDigest() string {
	return strings.Repeat(genesisDigestCharacter, hex.EncodedLen(sha256.Size))
}

type signedReceipt struct {
	receipt apiclient.MachineUsageReceiptDto
	chain   state.UsageChainKey
	digest  string
}

func signReceipt(
	identity *state.Identity,
	placement apiclient.MachineReportablePlacementDto,
	sample microvmtypes.RuntimeUsageSample,
	previousDigest string,
) (signedReceipt, error) {
	receipt, err := newReceipt(placement, sample, previousDigest)
	if err != nil {
		return signedReceipt{}, fmt.Errorf("%w: %w", ErrUnreportableReading, err)
	}
	payload := signaturePayload(identity.MachineID, receipt)
	signature, err := identity.SignPayload([]byte(payload))
	if err != nil {
		return signedReceipt{}, fmt.Errorf("sign usage receipt: %w", err)
	}
	receipt.Signature = signature
	return signedReceipt{
		receipt: *receipt,
		chain:   state.UsageChainKey{PlacementID: receipt.PlacementId.String(), GenerationID: receipt.GenerationId.String()},
		digest:  payloadDigest(payload),
	}, nil
}

func newReceipt(
	placement apiclient.MachineReportablePlacementDto,
	sample microvmtypes.RuntimeUsageSample,
	previousDigest string,
) (*apiclient.MachineUsageReceiptDto, error) {
	runtimeState := apiclient.MachineUsageRuntimeState(sample.State)
	if !runtimeState.Valid() {
		return nil, fmt.Errorf("map runtime state %q: unsupported value", sample.State)
	}
	generationID, err := uuid.Parse(sample.GenerationID)
	if err != nil {
		return nil, fmt.Errorf("parse usage generation ID: %w", err)
	}
	cpu, err := exactInt32(sample.CPUVCPUs, "CPU allocation")
	if err != nil {
		return nil, err
	}
	memory, err := exactInt32(sample.MemoryGiB, "memory allocation")
	if err != nil {
		return nil, err
	}
	disk, err := exactInt32(sample.StorageGiB, "disk allocation")
	if err != nil {
		return nil, err
	}
	gpu, err := exactInt32(sample.GPUCount, "GPU allocation")
	if err != nil {
		return nil, err
	}
	return &apiclient.MachineUsageReceiptDto{
		PlacementId:          placement.PlacementId,
		SandboxId:            placement.SandboxId,
		AssignmentGeneration: placement.AssignmentGeneration,
		FencingToken:         placement.FencingToken,
		GenerationId:         generationID,
		Sequence:             strconv.FormatUint(sample.Sequence, decimalBase),
		PreviousDigest:       previousDigest,
		SampledAt:            sample.SampledAt.UTC(),
		State:                runtimeState,
		RunningMillis:        strconv.FormatUint(sample.RunningMillis, decimalBase),
		InternetEgressBytes:  strconv.FormatUint(sample.InternetEgressBytes, decimalBase),
		InternetIngressBytes: strconv.FormatUint(sample.InternetIngressBytes, decimalBase),
		HostEgressBytes:      strconv.FormatUint(sample.HostEgressBytes, decimalBase),
		HostIngressBytes:     strconv.FormatUint(sample.HostIngressBytes, decimalBase),
		TapEgressBytes:       strconv.FormatUint(sample.TapEgressBytes, decimalBase),
		TapIngressBytes:      strconv.FormatUint(sample.TapIngressBytes, decimalBase),
		Cpu:                  cpu,
		MemoryGiB:            memory,
		DiskGiB:              disk,
		Gpu:                  gpu,
		Signature:            pendingSignature,
	}, nil
}

func exactInt32(value int64, name string) (int, error) {
	if value < 0 || value > math.MaxInt32 {
		return 0, fmt.Errorf("%s is outside the supported range", name)
	}
	return int(value), nil
}

func signaturePayload(machineID string, receipt *apiclient.MachineUsageReceiptDto) string {
	return frameSignatureFields([]string{
		signatureDomain,
		machineID,
		receipt.PlacementId.String(),
		receipt.SandboxId,
		strconv.FormatInt(int64(receipt.AssignmentGeneration), 10),
		receipt.FencingToken.String(),
		receipt.GenerationId.String(),
		receipt.Sequence,
		receipt.PreviousDigest,
		receipt.SampledAt.UTC().Format(time.RFC3339Nano),
		string(receipt.State),
		receipt.RunningMillis,
		receipt.InternetEgressBytes,
		receipt.InternetIngressBytes,
		receipt.HostEgressBytes,
		receipt.HostIngressBytes,
		receipt.TapEgressBytes,
		receipt.TapIngressBytes,
		strconv.FormatInt(int64(receipt.Cpu), 10),
		strconv.FormatInt(int64(receipt.MemoryGiB), 10),
		strconv.FormatInt(int64(receipt.DiskGiB), 10),
		strconv.FormatInt(int64(receipt.Gpu), 10),
	})
}

func frameSignatureFields(fields []string) string {
	var payload strings.Builder
	for _, field := range fields {
		payload.WriteString(strconv.Itoa(len([]byte(field))))
		payload.WriteByte(':')
		payload.WriteString(field)
	}
	return payload.String()
}

func payloadDigest(payload string) string {
	sum := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(sum[:])
}
