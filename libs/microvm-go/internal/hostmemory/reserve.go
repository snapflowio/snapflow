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

package hostmemory

import "math"

const (
	mebibyte               = 1 << 20
	gibibyte               = 1 << 30
	evictionThresholdBytes = 100 * mebibyte
	percent                = 100

	firstTierBytes     = 4 * gibibyte
	secondTierBytes    = 8 * gibibyte
	thirdTierBytes     = 16 * gibibyte
	fourthTierBytes    = 128 * gibibyte
	firstTierShare     = 25
	secondTierShare    = 20
	thirdTierShare     = 10
	fourthTierShare    = 6
	remainingTierShare = 2
)

type reserveTier struct {
	upToBytes uint64
	percent   uint64
}

func reserveTiers() []reserveTier {
	return []reserveTier{
		{upToBytes: firstTierBytes, percent: firstTierShare},
		{upToBytes: secondTierBytes, percent: secondTierShare},
		{upToBytes: thirdTierBytes, percent: thirdTierShare},
		{upToBytes: fourthTierBytes, percent: fourthTierShare},
		{upToBytes: math.MaxUint64, percent: remainingTierShare},
	}
}

func Reserve(totalBytes uint64) uint64 {
	var reserve, floor uint64
	for _, tier := range reserveTiers() {
		if totalBytes <= floor {
			break
		}
		reserve += (min(totalBytes, tier.upToBytes) - floor) * tier.percent / percent
		floor = tier.upToBytes
	}
	return reserve + evictionThresholdBytes
}

func Admittable(totalBytes uint64) uint64 {
	reserve := Reserve(totalBytes)
	if totalBytes <= reserve {
		return 0
	}
	return totalBytes - reserve
}
