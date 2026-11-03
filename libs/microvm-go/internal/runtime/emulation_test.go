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

package runtime

import (
	"testing"

	"github.com/snapflowio/microvm-go/imagecache"
)

func TestRequirePlatformOnHostRejectsForeignArchitectures(t *testing.T) {
	native := imagecache.Platform{OS: "linux", Architecture: "amd64"}
	if err := requirePlatformOnHost(native, "amd64"); err != nil {
		t.Fatalf("native platform rejected: %v", err)
	}
	foreign := imagecache.Platform{OS: "linux", Architecture: "arm64"}
	if err := requirePlatformOnHost(foreign, "amd64"); err == nil {
		t.Fatal("foreign platform accepted")
	}
}
