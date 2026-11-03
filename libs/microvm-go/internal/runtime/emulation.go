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
	"fmt"
	"net/http"
	goruntime "runtime"

	"github.com/snapflowio/microvm-go/imagecache"
	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
)

// requireNativePlatform refuses images built for another architecture; KVM
// hosts run guests natively and never emulate.
func requireNativePlatform(platform imagecache.Platform) error {
	return requirePlatformOnHost(platform, goruntime.GOARCH)
}

func requirePlatformOnHost(platform imagecache.Platform, hostArch string) error {
	if platform.Normalize().Architecture == hostArch {
		return nil
	}
	return mvmerrors.New(
		http.StatusFailedDependency,
		fmt.Sprintf("instance platform %s cannot run on a linux/%s machine", platform.Normalize().String(), hostArch),
		"MICROVM_PLATFORM_EMULATION_UNAVAILABLE",
	)
}
