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

package types

type RuntimeState string

const (
	RuntimeStateCreating     RuntimeState = "creating"
	RuntimeStateRestoring    RuntimeState = "restoring"
	RuntimeStateDestroyed    RuntimeState = "destroyed"
	RuntimeStateDestroying   RuntimeState = "destroying"
	RuntimeStateStarted      RuntimeState = "started"
	RuntimeStatePaused       RuntimeState = "paused"
	RuntimeStateStandby      RuntimeState = "standby"
	RuntimeStateStopped      RuntimeState = "stopped"
	RuntimeStateStarting     RuntimeState = "starting"
	RuntimeStateStopping     RuntimeState = "stopping"
	RuntimeStateResizing     RuntimeState = "resizing"
	RuntimeStateError        RuntimeState = "error"
	RuntimeStateUnknown      RuntimeState = "unknown"
	RuntimeStatePullingImage RuntimeState = "pulling_image"
)

func (s RuntimeState) String() string { return string(s) }
