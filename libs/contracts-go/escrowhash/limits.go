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

package escrowhash

import (
	"math/big"
	"time"
)

const (
	BPSDenominator       uint16 = 10_000
	MaxFeeBps            uint16 = 3000
	MaxRelayFee          int64  = 1_000_000
	MaxBatchSize                = 20
	SignerBurstHours            = 24
	MinAutoTopUpInterval        = time.Hour
)

func FeeOf(paid *big.Int, feeBps uint16) *big.Int {
	fee := new(big.Int).Mul(paid, new(big.Int).SetUint64(uint64(feeBps)))
	return fee.Quo(fee, new(big.Int).SetUint64(uint64(BPSDenominator)))
}
