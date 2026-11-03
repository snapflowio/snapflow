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

package guestmemory

import "strings"

type KernelPageInitMode string

const (
	KernelPageInitPerformance KernelPageInitMode = "performance"
	KernelPageInitHardened    KernelPageInitMode = "hardened"
)

type Policy struct {
	Enabled            bool
	KernelPageInitMode KernelPageInitMode
	ReclaimEnabled     bool
}

type Features struct {
	EnableBalloon     bool
	FreePageReporting bool
	DeflateOnOOM      bool
	FreePageHinting   bool
}

func DefaultPolicy() Policy {
	return Policy{
		Enabled:            true,
		KernelPageInitMode: KernelPageInitHardened,
		ReclaimEnabled:     true,
	}
}

func (p Policy) Normalize() Policy {
	defaults := DefaultPolicy()
	if p.KernelPageInitMode == "" {
		p.KernelPageInitMode = defaults.KernelPageInitMode
	}
	if p.KernelPageInitMode != KernelPageInitPerformance && p.KernelPageInitMode != KernelPageInitHardened {
		p.KernelPageInitMode = defaults.KernelPageInitMode
	}
	if !p.Enabled {
		p.ReclaimEnabled = false
	}
	return p
}

func (p Policy) KernelArgs() []string {
	normalized := p.Normalize()
	if !normalized.Enabled {
		return nil
	}
	switch normalized.KernelPageInitMode {
	case KernelPageInitPerformance:
		return []string{"init_on_alloc=0", "init_on_free=0"}
	default:
		return []string{"init_on_alloc=1", "init_on_free=0"}
	}
}

func (p Policy) Features() Features {
	normalized := p.Normalize()
	if !normalized.Enabled || !normalized.ReclaimEnabled {
		return Features{}
	}
	return Features{
		EnableBalloon:     true,
		FreePageReporting: true,
		DeflateOnOOM:      true,
		FreePageHinting:   true,
	}
}

func MergeKernelArgs(base string, extras ...string) string {
	tokens := strings.Fields(base)
	order := make([]string, 0, len(tokens))
	values := make(map[string]string, len(tokens))

	for _, token := range tokens {
		key := kernelArgKey(token)
		if _, ok := values[key]; !ok {
			order = append(order, key)
		}
		values[key] = token
	}
	for _, extra := range extras {
		for _, token := range strings.Fields(extra) {
			key := kernelArgKey(token)
			if _, ok := values[key]; !ok {
				order = append(order, key)
			}
			values[key] = token
		}
	}

	merged := make([]string, 0, len(order))
	for _, key := range order {
		merged = append(merged, values[key])
	}
	return strings.Join(merged, " ")
}

func kernelArgKey(token string) string {
	key, _, _ := strings.Cut(token, "=")
	return key
}
