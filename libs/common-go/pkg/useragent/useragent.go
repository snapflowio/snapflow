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

package useragent

import (
	"context"
	"net/http"
	"runtime/debug"
)

const (
	header             = "User-Agent"
	developmentVersion = "(devel)"
)

func Value(product string) string {
	version := developmentVersion
	if info, ok := debug.ReadBuildInfo(); ok && info.Main.Version != "" {
		version = info.Main.Version
	}
	return product + "/" + version
}

func RequestEditor(product string) func(context.Context, *http.Request) error {
	value := Value(product)
	return func(ctx context.Context, request *http.Request) error {
		request.Header.Set(header, value)
		return ctx.Err()
	}
}
