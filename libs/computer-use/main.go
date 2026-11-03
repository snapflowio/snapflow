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

package main

import (
	"log/slog"
	"os"

	goplugin "github.com/hashicorp/go-plugin"
	"github.com/snapflowio/common-go/pkg/guestspec"
	"github.com/snapflowio/common-go/pkg/logging"
	"github.com/snapflowio/computer-use/pkg/computeruse"
	"github.com/snapflowio/computer-use/plugin"
)

func main() {
	if len(os.Args) == 2 && os.Args[1] == guestspec.ComputerUseSelfCheckArgument {
		return
	}

	logging.SetDefault(logging.Options{Writer: os.Stderr, Level: logging.BuildLevel})
	slog.Debug("Starting computer-use plugin")

	goplugin.Serve(&goplugin.ServeConfig{
		HandshakeConfig: plugin.Handshake(),
		Plugins: map[string]goplugin.Plugin{
			guestspec.ComputerUsePluginName: &plugin.Plugin{Impl: &computeruse.ComputerUse{}},
		},
	})
}
