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

//go:build !linux

package control

import "errors"

type filesystemQuiescer interface {
	Freeze() error
	Thaw() error
}

type noOpFilesystemQuiescer struct{}

func (noOpFilesystemQuiescer) Freeze() error { return nil }
func (noOpFilesystemQuiescer) Thaw() error   { return nil }

type unsupportedFilesystemQuiescer struct{}

func newRootFilesystemQuiescer() filesystemQuiescer {
	return unsupportedFilesystemQuiescer{}
}

func newVolumeFilesystemQuiescer(string) filesystemQuiescer {
	return unsupportedFilesystemQuiescer{}
}

func (unsupportedFilesystemQuiescer) Freeze() error {
	return errors.New("filesystem freeze is supported only on Linux guests")
}

func (unsupportedFilesystemQuiescer) Thaw() error {
	return errors.New("filesystem thaw is supported only on Linux guests")
}
