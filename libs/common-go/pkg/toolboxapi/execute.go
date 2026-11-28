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

package toolboxapi

const ExecutePath = "/process/execute"

type ExecuteRequest struct {
	Command string            `json:"command" validate:"required"`
	Timeout *uint32           `json:"timeout,omitempty" validate:"optional"`
	Cwd     *string           `json:"cwd,omitempty" validate:"optional"`
	Envs    map[string]string `json:"envs,omitempty" validate:"optional"`
	User    *string           `json:"user,omitempty" validate:"optional"`
} //	@name	ExecuteRequest

type ExecuteResponse struct {
	ExitCode int    `json:"exitCode" validate:"required"`
	Result   string `json:"result" validate:"required"`
	Stdout   string `json:"stdout" validate:"required"`
	Stderr   string `json:"stderr" validate:"required"`
} //	@name	ExecuteResponse
