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

// Package escrow holds the abigen bindings for the SnapflowEscrow contract.
package escrow

// The ABI is the one Foundry writes next to the build artifact (extra_output_files in apps/contracts/foundry.toml),
// so build the contracts first: `moon run contracts-go:generate` does both.
//go:generate go tool abigen --v2 --abi ../../../apps/contracts/out/SnapflowEscrow.sol/SnapflowEscrow.abi.json --pkg escrow --type SnapflowEscrow --out snapflow_escrow.gen.go
