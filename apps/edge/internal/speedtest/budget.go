// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package speedtest

import (
	"errors"
	"io"
	"sync"
	"time"

	"github.com/google/uuid"
)

var errByteBudgetExhausted = errors.New("the speedtest byte budget is exhausted")

type benchmarkBudget struct {
	remaining uint64
	expiresAt time.Time
	transfers int
}

type budgetLedger struct {
	mutex      sync.Mutex
	benchmarks map[uuid.UUID]*benchmarkBudget
}

func newBudgetLedger() *budgetLedger {
	return &budgetLedger{benchmarks: map[uuid.UUID]*benchmarkBudget{}}
}

func (ledger *budgetLedger) open(claims tokenClaims, now time.Time) (*benchmarkBudget, bool) {
	ledger.mutex.Lock()
	defer ledger.mutex.Unlock()
	for benchmarkID, budget := range ledger.benchmarks {
		if budget.transfers == 0 && !now.Before(budget.expiresAt) {
			delete(ledger.benchmarks, benchmarkID)
		}
	}
	budget, found := ledger.benchmarks[claims.benchmarkID]
	if !found {
		budget = &benchmarkBudget{remaining: claims.byteBudget, expiresAt: claims.expiresAt}
		ledger.benchmarks[claims.benchmarkID] = budget
	}
	if budget.transfers >= maximumBenchmarkTransfers {
		return nil, false
	}
	budget.transfers++
	return budget, true
}

func (ledger *budgetLedger) close(budget *benchmarkBudget) {
	ledger.mutex.Lock()
	defer ledger.mutex.Unlock()
	budget.transfers--
}

func (ledger *budgetLedger) reserve(budget *benchmarkBudget, wanted int) int {
	ledger.mutex.Lock()
	defer ledger.mutex.Unlock()
	granted := min(uint64(wanted), budget.remaining)
	budget.remaining -= granted
	return int(granted)
}

func (ledger *budgetLedger) refund(budget *benchmarkBudget, unused int) {
	ledger.mutex.Lock()
	defer ledger.mutex.Unlock()
	budget.remaining += uint64(unused)
}

type budgetedReader struct {
	source io.Reader
	ledger *budgetLedger
	budget *benchmarkBudget
}

func (reader budgetedReader) Read(buffer []byte) (int, error) {
	if len(buffer) == 0 {
		return reader.source.Read(buffer)
	}
	granted := reader.ledger.reserve(reader.budget, len(buffer))
	if granted == 0 {
		var probe [1]byte
		read, err := reader.source.Read(probe[:])
		if read == 0 {
			return 0, err
		}
		return 0, errByteBudgetExhausted
	}
	read, err := reader.source.Read(buffer[:granted])
	reader.ledger.refund(reader.budget, granted-read)
	return read, err
}
