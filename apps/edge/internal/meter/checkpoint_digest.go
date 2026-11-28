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
	"slices"
	"strings"
	"time"

	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"github.com/snapflowio/tunnel-go/canonicaljson"
)

const (
	timestampLayout = "2006-01-02T15:04:05.000Z"
	digestHexLength = sha256.Size * 2
)

type digestSample struct {
	AssignmentGeneration int32                     `json:"assignmentGeneration"`
	BackendID            string                    `json:"backendId"`
	BytesIn              string                    `json:"bytesIn"`
	BytesOut             string                    `json:"bytesOut"`
	PacketsIn            string                    `json:"packetsIn"`
	PacketsOut           string                    `json:"packetsOut"`
	Protocol             apiclient.NetworkProtocol `json:"protocol"`
	TCPConnections       int32                     `json:"tcpConnections"`
	UDPFlows             int32                     `json:"udpFlows"`
}

type digestDocument struct {
	EdgeID                string         `json:"edgeId"`
	EdgeSessionGeneration int32          `json:"edgeSessionGeneration"`
	IntervalEndedAt       string         `json:"intervalEndedAt"`
	IntervalStartedAt     string         `json:"intervalStartedAt"`
	PreviousDigest        *string        `json:"previousDigest"`
	Samples               []digestSample `json:"samples"`
	Sequence              string         `json:"sequence"`
	UsageEpoch            int32          `json:"usageEpoch"`
}

func calculateDigest(
	edgeID string,
	checkpoint apiclient.EdgeUsageCheckpointDto,
) (string, error) {
	samples := make([]digestSample, 0, len(checkpoint.Samples))
	for _, sample := range checkpoint.Samples {
		samples = append(samples, digestSample{
			AssignmentGeneration: sample.AssignmentGeneration,
			BackendID:            sample.BackendId.String(),
			BytesIn:              sample.BytesIn,
			BytesOut:             sample.BytesOut,
			PacketsIn:            sample.PacketsIn,
			PacketsOut:           sample.PacketsOut,
			Protocol:             sample.Protocol,
			TCPConnections:       sample.TcpConnections,
			UDPFlows:             sample.UdpFlows,
		})
	}
	slices.SortFunc(samples, func(left, right digestSample) int {
		return strings.Compare(left.BackendID, right.BackendID)
	})
	digest, err := canonicaljson.SHA256(digestDocument{
		EdgeID:                edgeID,
		EdgeSessionGeneration: checkpoint.EdgeSessionGeneration,
		IntervalEndedAt:       canonicalTimestamp(checkpoint.IntervalEndedAt),
		IntervalStartedAt:     canonicalTimestamp(checkpoint.IntervalStartedAt),
		PreviousDigest:        checkpoint.PreviousDigest,
		Samples:               samples,
		Sequence:              checkpoint.Sequence,
		UsageEpoch:            checkpoint.UsageEpoch,
	})
	if err != nil {
		return "", fmt.Errorf("encode canonical Edge usage checkpoint: %w", err)
	}
	return digest, nil
}

func isSHA256Digest(value string) bool {
	if len(value) != digestHexLength {
		return false
	}
	decoded, err := hex.DecodeString(value)
	return err == nil && len(decoded) == sha256.Size
}

func canonicalTimestamp(value time.Time) string {
	return canonicalTime(value).Format(timestampLayout)
}
