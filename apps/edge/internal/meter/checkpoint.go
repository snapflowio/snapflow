// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"errors"
	"fmt"
	"math"
	"slices"
	"strconv"
	"strings"

	"github.com/google/uuid"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	signatureDomain    = "snapflow.edge-usage.v2"
	signatureSeparator = "\n"
	maximumSequence    = uint64(math.MaxInt64)
	decimalBase        = 10
)

type Signer interface {
	EdgeID() string
	Sign([]byte) (string, error)
}

func signCheckpoint(
	signer Signer,
	cursor queueCursor,
	interval usageInterval,
) (apiclient.EdgeUsageCheckpointDto, error) {
	if signer == nil || uuid.Validate(signer.EdgeID()) != nil {
		return apiclient.EdgeUsageCheckpointDto{}, errors.New("valid Edge checkpoint signer is required")
	}
	if err := interval.validate(); err != nil {
		return apiclient.EdgeUsageCheckpointDto{}, err
	}
	if cursor.Epoch < 1 {
		return apiclient.EdgeUsageCheckpointDto{}, errors.New("edge usage checkpoint requires an open usage epoch")
	}
	if cursor.Sequence >= maximumSequence {
		return apiclient.EdgeUsageCheckpointDto{}, errors.New("edge usage checkpoint sequence exhausted")
	}
	checkpoint := apiclient.EdgeUsageCheckpointDto{
		UsageEpoch:            cursor.Epoch,
		Sequence:              strconv.FormatUint(cursor.Sequence+1, decimalBase),
		EdgeSessionGeneration: interval.EdgeSessionGeneration,
		IntervalStartedAt:     canonicalTime(interval.IntervalStartedAt),
		IntervalEndedAt:       canonicalTime(interval.IntervalEndedAt),
		Samples:               slices.Clone(interval.Samples),
	}
	if cursor.Digest != "" {
		chained := cursor.Digest
		checkpoint.PreviousDigest = &chained
	}
	digest, err := calculateDigest(signer.EdgeID(), checkpoint)
	if err != nil {
		return apiclient.EdgeUsageCheckpointDto{}, err
	}
	checkpoint.Digest = digest
	signature, err := signer.Sign([]byte(strings.Join([]string{
		signatureDomain,
		signer.EdgeID(),
		strconv.FormatInt(int64(checkpoint.UsageEpoch), decimalBase),
		checkpoint.Sequence,
		checkpoint.Digest,
	}, signatureSeparator)))
	if err != nil {
		return apiclient.EdgeUsageCheckpointDto{}, fmt.Errorf("sign Edge usage checkpoint: %w", err)
	}
	checkpoint.Signature = signature
	return checkpoint, nil
}
