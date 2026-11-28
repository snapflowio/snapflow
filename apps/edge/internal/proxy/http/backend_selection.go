// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package http

import (
	"math/rand/v2"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/routes"
)

const pinnedBackendWeight = 1

type weightedBackend struct {
	route  routes.HTTP
	load   int64
	weight uint16
}

func containsHTTPBackend(candidates []routes.HTTP, backendID uuid.UUID) bool {
	for _, route := range candidates {
		if route.BackendID == backendID {
			return true
		}
	}
	return false
}

func selectHTTPBackend(
	candidates []routes.HTTP,
	requiredBackend uuid.UUID,
	hasRequiredBackend bool,
	excluded map[uuid.UUID]struct{},
	streams backendStreams,
) (routes.HTTP, bool) {
	var selected weightedBackend
	ties := 0
	for _, route := range backendPool(candidates, requiredBackend, hasRequiredBackend) {
		candidate, eligible := weighBackend(route, hasRequiredBackend, excluded, streams)
		if !eligible {
			continue
		}
		comparison := -1
		if ties > 0 {
			comparison = compareWeightedLoad(candidate, selected)
		}
		switch {
		case comparison < 0:
			selected = candidate
			ties = 1
		case comparison == 0:
			ties++
			if rand.IntN(ties) == 0 {
				selected = candidate
			}
		}
	}
	return selected.route, ties > 0
}

func backendPool(
	candidates []routes.HTTP,
	requiredBackend uuid.UUID,
	hasRequiredBackend bool,
) []routes.HTTP {
	if !hasRequiredBackend {
		return candidates
	}
	pool := make([]routes.HTTP, 0, 1)
	for _, route := range candidates {
		if route.BackendID == requiredBackend {
			pool = append(pool, route)
		}
	}
	return pool
}

func weighBackend(
	route routes.HTTP,
	hasRequiredBackend bool,
	excluded map[uuid.UUID]struct{},
	streams backendStreams,
) (weightedBackend, bool) {
	if _, skip := excluded[route.BackendID]; skip {
		return weightedBackend{}, false
	}
	weight := route.TrafficWeight
	if weight == 0 {
		if !hasRequiredBackend {
			return weightedBackend{}, false
		}
		weight = pinnedBackendWeight
	}
	load, ready := streams.BackendLoad(route.Base)
	return weightedBackend{route: route, load: load, weight: weight}, ready
}

func compareWeightedLoad(left, right weightedBackend) int {
	leftScore := (max(left.load, 0) + 1) * int64(right.weight)
	rightScore := (max(right.load, 0) + 1) * int64(left.weight)
	switch {
	case leftScore < rightScore:
		return -1
	case leftScore > rightScore:
		return 1
	default:
		return 0
	}
}

func compatibleHTTPRoutes(
	candidates []routes.HTTP,
	selected routes.HTTP,
) []routes.HTTP {
	result := make([]routes.HTTP, 0, len(candidates))
	for _, candidate := range candidates {
		if candidate.ExposureID == selected.ExposureID &&
			candidate.ExposureGeneration == selected.ExposureGeneration &&
			candidate.Policy.Equal(selected.Policy) {
			result = append(result, candidate)
		}
	}
	return result
}
