// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/identity"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	testEdgeID    = "00000000-0000-4000-8000-000000000001"
	testBackendID = "00000000-0000-4000-8000-000000000002"
	digestFiller  = "c"
	digestLength  = 64
	counterValue  = "1"
)

func testIntervalStart() time.Time {
	return time.Date(2026, time.September, 4, 0, 0, 0, 0, time.UTC)
}

func testDigest() string {
	return strings.Repeat(digestFiller, digestLength)
}

func newTestSigner(t *testing.T) Signer {
	t.Helper()
	signer, err := identity.LoadOrCreate(t.TempDir(), testEdgeID)
	if err != nil {
		t.Fatalf("create checkpoint signer: %v", err)
	}
	return signer
}

func testInterval(startedAt time.Time) usageInterval {
	return usageInterval{
		EdgeSessionGeneration: 1,
		IntervalStartedAt:     startedAt,
		IntervalEndedAt:       startedAt.Add(time.Minute),
		Samples: []apiclient.EdgeUsageSampleDto{{
			BackendId:            uuid.MustParse(testBackendID),
			AssignmentGeneration: 1,
			Protocol:             apiclient.NetworkProtocolHttp,
			BytesIn:              counterValue,
			BytesOut:             counterValue,
			PacketsIn:            counterValue,
			PacketsOut:           counterValue,
		}},
	}
}
