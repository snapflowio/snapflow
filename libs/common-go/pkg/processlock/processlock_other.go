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

//go:build !linux && !darwin

package processlock

import (
	"fmt"
	"os"
)

func acquire(directory, filename string) (*Lock, error) {
	return nil, fmt.Errorf(
		"process locking is not supported on this platform for %s/%s",
		directory,
		filename,
	)
}

func release(file *os.File) error {
	return file.Close()
}
