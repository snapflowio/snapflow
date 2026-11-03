// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edgetest_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"testing"
	"time"

	"github.com/snapflowio/edge/internal/edge/edgetest"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	routeHost       = "app.edge.test"
	backendBody     = "served through the edge"
	requestTimeout  = 10 * time.Second
	counterBase     = 10
	counterBitWidth = 64
)

func TestServerProxiesHTTPAndReportsMeteredUsage(t *testing.T) {
	t.Parallel()
	environment := edgetest.Start(t, edgetest.HTTPRoute(routeHost, startBackend(t)))
	requestThroughEdge(t, environment)
	if environment.ControlPlane.Heartbeats() == 0 {
		t.Fatal("the edge never reported a heartbeat to the control plane")
	}

	if err := environment.Shutdown(); err != nil {
		t.Fatalf("shutdown: %v", err)
	}
	if bytesOut := meteredBytesOut(t, environment.ControlPlane.UsageCheckpoints()); bytesOut != uint64(len(backendBody)) {
		t.Fatalf("metered %d response bytes, want %d", bytesOut, len(backendBody))
	}
}

func TestUsageIsMeteredExactlyOnceAcrossAnEdgeStateWipe(t *testing.T) {
	t.Parallel()
	first := edgetest.Start(t, edgetest.HTTPRoute(routeHost, startBackend(t)))
	requestThroughEdge(t, first)
	restarted := first.Restart(t, first.Config.StateDir)
	requestThroughEdge(t, restarted)
	wiped := restarted.Restart(t, t.TempDir())
	requestThroughEdge(t, wiped)
	if err := wiped.Shutdown(); err != nil {
		t.Fatalf("shutdown: %v", err)
	}

	checkpoints := wiped.ControlPlane.UsageCheckpoints()
	if bytesOut := meteredBytesOut(t, checkpoints); bytesOut != 3*uint64(len(backendBody)) {
		t.Fatalf("metered %d response bytes, want %d", bytesOut, 3*len(backendBody))
	}
	epochs := map[int32]bool{}
	for index, checkpoint := range checkpoints {
		epochs[checkpoint.UsageEpoch] = true
		if index == 0 {
			continue
		}
		previous := checkpoints[index-1]
		if checkpoint.PreviousDigest == nil || *checkpoint.PreviousDigest != previous.Digest {
			t.Fatalf("checkpoint %d/%s does not chain to %d/%s", checkpoint.UsageEpoch, checkpoint.Sequence, previous.UsageEpoch, previous.Sequence)
		}
		if checkpoint.UsageEpoch != previous.UsageEpoch && checkpoint.Sequence != "1" {
			t.Fatalf("epoch %d started at sequence %s, want 1", checkpoint.UsageEpoch, checkpoint.Sequence)
		}
	}
	if len(epochs) != 2 {
		t.Fatalf("checkpoints span epochs %v, want the restart to keep its epoch and the wipe to open a second", epochs)
	}
}

func startBackend(t *testing.T) string {
	t.Helper()
	backend := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if _, err := io.WriteString(writer, backendBody); err != nil {
			t.Errorf("backend write: %v", err)
		}
	}))
	t.Cleanup(backend.Close)
	backendURL, err := url.Parse(backend.URL)
	if err != nil {
		t.Fatalf("parse backend URL: %v", err)
	}
	return backendURL.Host
}

func requestThroughEdge(t *testing.T, environment *edgetest.Environment) {
	t.Helper()
	request, err := http.NewRequestWithContext(t.Context(), http.MethodGet, "http://"+environment.HTTPAddress+"/", nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	request.Host = routeHost
	response, err := (&http.Client{Timeout: requestTimeout}).Do(request)
	if err != nil {
		t.Fatalf("request through the edge: %v", err)
	}
	body, err := io.ReadAll(response.Body)
	if closeErr := response.Body.Close(); err == nil {
		err = closeErr
	}
	if err != nil || response.StatusCode != http.StatusOK || string(body) != backendBody {
		t.Fatalf("response = %d %q (%v), want the backend body", response.StatusCode, body, err)
	}
}

func meteredBytesOut(t *testing.T, checkpoints []apiclient.EdgeUsageCheckpointDto) uint64 {
	t.Helper()
	var bytesOut uint64
	for _, checkpoint := range checkpoints {
		for _, sample := range checkpoint.Samples {
			value, err := strconv.ParseUint(sample.BytesOut, counterBase, counterBitWidth)
			if err != nil {
				t.Fatalf("parse metered bytes: %v", err)
			}
			bytesOut += value
		}
	}
	return bytesOut
}
