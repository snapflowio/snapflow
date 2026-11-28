// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package registry

import (
	"net/http"
	"sync"
)

type WriteGate interface {
	RLock()
	RUnlock()
}

type writeGate struct {
	gate WriteGate
}

func (writes writeGate) handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !mutatesStorage(r.Method) {
			next.ServeHTTP(w, r)
			return
		}
		writes.gate.RLock()
		defer writes.gate.RUnlock()
		next.ServeHTTP(w, r)
	})
}

func mutatesStorage(method string) bool {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return false
	default:
		return true
	}
}

func defaultWriteGate() writeGate {
	return writeGate{gate: &sync.RWMutex{}}
}
