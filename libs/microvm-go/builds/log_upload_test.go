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

package builds

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/snapflowio/microvm-go/internal/transferpolicy"
)

const testBuildLog = "build output\n"

func TestUploadBuildLogRequiresHTTPSOrTrustedOrigin(t *testing.T) {
	uploaded := make(chan string, 1)
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		body, err := io.ReadAll(request.Body)
		if err != nil {
			t.Errorf("read uploaded build log: %v", err)
		}
		uploaded <- string(body)
	}))
	defer server.Close()
	uploadURL := server.URL + "/logs/build.log"

	err := uploadBuildLog(t.Context(), transferpolicy.Policy{}, uploadURL, []byte(testBuildLog))
	if !errors.Is(err, transferpolicy.ErrInsecureTransport) {
		t.Fatalf("untrusted plain-HTTP upload error = %v, want ErrInsecureTransport", err)
	}
	transfers, err := transferpolicy.New([]string{server.URL})
	if err != nil {
		t.Fatal(err)
	}
	if err := uploadBuildLog(t.Context(), transfers, uploadURL, []byte(testBuildLog)); err != nil {
		t.Fatalf("trusted plain-HTTP upload: %v", err)
	}
	if got := <-uploaded; got != testBuildLog {
		t.Fatalf("uploaded build log = %q, want %q", got, testBuildLog)
	}
}
