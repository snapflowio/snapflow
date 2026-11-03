// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package speedtest

import (
	"context"
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"
	"time"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/timestamppb"
)

const (
	receiptDomain         = "snapflow.speedtest-receipt.v2"
	receiptFieldSeparator = "\n"
	decimalBase           = 10
)

const (
	downloadDirectionName = "download"
	uploadDirectionName   = "upload"
)

func directionName(direction machinev1alpha1.SpeedtestDirection) string {
	switch direction {
	case machinev1alpha1.SpeedtestDirection_SPEEDTEST_DIRECTION_DOWNLOAD:
		return downloadDirectionName
	case machinev1alpha1.SpeedtestDirection_SPEEDTEST_DIRECTION_UPLOAD:
		return uploadDirectionName
	default:
		return ""
	}
}

type transfer struct {
	token      string
	direction  machinev1alpha1.SpeedtestDirection
	startedAt  time.Time
	finishedAt time.Time
	meter      meter
	stats      tcpStats
}

func (handler *Handler) startTransfer(token string, direction machinev1alpha1.SpeedtestDirection) *transfer {
	started := handler.millisecondNow()
	return &transfer{
		token: token, direction: direction, startedAt: started,
		meter: meter{rampEnd: started.Add(rampDuration)},
	}
}

func (completed *transfer) measuredStartedAt() time.Time {
	if completed.finishedAt.Before(completed.meter.rampEnd) {
		return completed.finishedAt
	}
	return completed.meter.rampEnd
}

func receiptMessage(completed *transfer) []byte {
	return []byte(strings.Join([]string{
		receiptDomain,
		completed.token,
		directionName(completed.direction),
		strconv.FormatUint(completed.meter.total, decimalBase),
		strconv.FormatInt(completed.startedAt.UnixMilli(), decimalBase),
		strconv.FormatInt(completed.finishedAt.UnixMilli(), decimalBase),
		strconv.FormatUint(completed.meter.measured, decimalBase),
		strconv.FormatInt(completed.measuredStartedAt().UnixMilli(), decimalBase),
		strconv.FormatUint(uint64(completed.stats.minRTTMicros), decimalBase),
		strconv.FormatUint(uint64(completed.stats.smoothedRTTMicros), decimalBase),
		strconv.FormatUint(uint64(completed.stats.rttVarianceMicros), decimalBase),
		strconv.FormatUint(completed.stats.retransmittedSegments, decimalBase),
		strconv.FormatUint(completed.stats.sentSegments, decimalBase),
	}, receiptFieldSeparator))
}

func (handler *Handler) signedReceipt(ctx context.Context, completed *transfer) ([]byte, error) {
	completed.finishedAt = handler.millisecondNow()
	stats, err := connectionStats(ctx)
	if err != nil {
		return nil, err
	}
	completed.stats = stats
	receipt, err := handler.receipt(completed)
	if err != nil {
		return nil, err
	}
	return protojson.Marshal(receipt)
}

func (handler *Handler) receipt(completed *transfer) (*machinev1alpha1.SpeedtestReceipt, error) {
	encoded, err := handler.signer.Sign(receiptMessage(completed))
	if err != nil {
		return nil, fmt.Errorf("sign the speedtest receipt: %w", err)
	}
	signature, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("decode the speedtest receipt signature: %w", err)
	}
	return &machinev1alpha1.SpeedtestReceipt{
		Direction:             completed.direction,
		Bytes:                 completed.meter.total,
		StartedAt:             timestamppb.New(completed.startedAt),
		FinishedAt:            timestamppb.New(completed.finishedAt),
		MeasuredBytes:         completed.meter.measured,
		MeasuredStartedAt:     timestamppb.New(completed.measuredStartedAt()),
		MinRttMicros:          completed.stats.minRTTMicros,
		SmoothedRttMicros:     completed.stats.smoothedRTTMicros,
		RttVarianceMicros:     completed.stats.rttVarianceMicros,
		RetransmittedSegments: completed.stats.retransmittedSegments,
		SentSegments:          completed.stats.sentSegments,
		EdgeKeyId:             handler.signer.KeyID(),
		Signature:             signature,
	}, nil
}

func (handler *Handler) millisecondNow() time.Time {
	return time.UnixMilli(handler.now().UnixMilli()).UTC()
}
