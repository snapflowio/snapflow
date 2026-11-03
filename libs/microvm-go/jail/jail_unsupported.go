// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the license at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

//go:build !linux

package jail

import (
	"context"
	"os"
	"os/exec"
)

const Slice = "snapflow-vms.slice"

func Init() {}

func ScopeName(id string) string { return "snapflow-vm-" + id + ".scope" }

func Command(context.Context, Spec, *os.File) (*exec.Cmd, error) { return nil, ErrUnsupported }

func Start(*exec.Cmd, Spec) error { return ErrUnsupported }

func Place(context.Context, string, int, Limits) error { return ErrUnsupported }
