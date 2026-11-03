// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
package registry

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

const gateObservationWindow = 50 * time.Millisecond

func TestWriteGateHoldsMutatingRequestsWhileExclusivelyLocked(t *testing.T) {
	gate := &sync.RWMutex{}
	served := make(chan string, 2)
	handler := writeGate{gate: gate}.handler(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		served <- r.Method
	}))
	gate.Lock()
	go handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequestWithContext(t.Context(), http.MethodPut, alpineTagPath, http.NoBody))
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequestWithContext(t.Context(), http.MethodGet, alpineTagPath, http.NoBody))
	if method := <-served; method != http.MethodGet {
		t.Fatalf("first served request = %s, want GET while the gate is held", method)
	}
	select {
	case method := <-served:
		t.Fatalf("%s was served while the gate was held", method)
	case <-time.After(gateObservationWindow):
	}
	gate.Unlock()
	if method := <-served; method != http.MethodPut {
		t.Fatalf("released request = %s, want PUT", method)
	}
}
