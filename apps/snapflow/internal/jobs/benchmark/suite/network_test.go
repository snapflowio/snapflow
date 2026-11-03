// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"context"
	"encoding/base64"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"google.golang.org/protobuf/encoding/protojson"
)

const (
	testSpeedtestToken    = "d4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a.secret"
	testSpeedtestStreams  = 2
	testSpeedtestDuration = 50 * time.Millisecond
	testDownloadBytes     = 4096
	testSpeedtestPrefix   = "/_snapflow/speedtest"
	testTrailerHeader     = "Trailer"
)

func testReceipt(t *testing.T, direction machinev1alpha1.SpeedtestDirection, bytes int64) []byte {
	t.Helper()
	encoded, err := protojson.Marshal(&machinev1alpha1.SpeedtestReceipt{Direction: direction, Bytes: uint64(bytes)})
	if err != nil {
		t.Fatal(err)
	}
	return encoded
}

func TestMeasureNetworkCollectsDownloadAndUploadReceipts(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc(http.MethodGet+" "+testSpeedtestPrefix+SpeedtestDownloadPath, func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get(speedtestAuthorization) != speedtestBearerPrefix+testSpeedtestToken || request.URL.Query().Get(SpeedtestSecondsQuery) == "" {
			http.Error(writer, "unauthorized", http.StatusUnauthorized)
			return
		}
		writer.Header().Set(testTrailerHeader, SpeedtestReceiptTrailer)
		written, err := writer.Write(make([]byte, testDownloadBytes))
		if err != nil {
			t.Error(err)
		}
		writer.Header().Set(SpeedtestReceiptTrailer, base64.RawURLEncoding.EncodeToString(
			testReceipt(t, machinev1alpha1.SpeedtestDirection_SPEEDTEST_DIRECTION_DOWNLOAD, int64(written)),
		))
	})
	mux.HandleFunc(http.MethodPost+" "+testSpeedtestPrefix+SpeedtestUploadPath, func(writer http.ResponseWriter, request *http.Request) {
		received, err := io.Copy(io.Discard, request.Body)
		if err != nil {
			t.Error(err)
		}
		if _, err := writer.Write(testReceipt(t, machinev1alpha1.SpeedtestDirection_SPEEDTEST_DIRECTION_UPLOAD, received)); err != nil {
			t.Error(err)
		}
	})
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	receipts, err := MeasureNetwork(context.Background(), SpeedtestConfig{
		URL: server.URL + testSpeedtestPrefix, Token: testSpeedtestToken, Streams: testSpeedtestStreams,
		Duration: testSpeedtestDuration, Client: server.Client(),
	})
	if err != nil {
		t.Fatal(err)
	}
	directions := map[machinev1alpha1.SpeedtestDirection]int{}
	for _, receipt := range receipts {
		if receipt.GetBytes() == 0 {
			t.Fatalf("receipt %v carries no bytes", receipt)
		}
		directions[receipt.GetDirection()]++
	}
	if directions[machinev1alpha1.SpeedtestDirection_SPEEDTEST_DIRECTION_DOWNLOAD] != testSpeedtestStreams ||
		directions[machinev1alpha1.SpeedtestDirection_SPEEDTEST_DIRECTION_UPLOAD] != testSpeedtestStreams {
		t.Fatalf("receipts by direction = %v", directions)
	}
}
