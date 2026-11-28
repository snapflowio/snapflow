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

package builds

import (
	"context"
	"log/slog"
	"regexp"
	"strconv"
	"time"
)

var exportVertexPattern = regexp.MustCompile(`(?m)^#(\d+) exporting to `)

type buildPhases struct {
	context     time.Duration
	builder     time.Duration
	cold        bool
	machine     BuilderPhases
	daemonReady time.Duration
	solve       time.Duration
	load        time.Duration
	convert     time.Duration
	push        time.Duration
	total       time.Duration
	progress    string
}

func (phases buildPhases) log(ctx context.Context, image string) {
	export := exportDuration(phases.progress)
	slog.InfoContext(
		ctx,
		"image build finished",
		"image", image,
		"builder_cold", phases.cold,
		"context_ms", phases.context.Milliseconds(),
		"builder_ms", phases.builder.Milliseconds(),
		"builder_image_ms", phases.machine.BuilderImage.Milliseconds(),
		"vm_prepare_ms", phases.machine.Prepare.Milliseconds(),
		"vm_launch_ms", phases.machine.Launch.Milliseconds(),
		"daemon_ready_ms", phases.daemonReady.Milliseconds(),
		"buildkit_solve_ms", max(phases.solve-export, 0).Milliseconds(),
		"buildkit_export_ms", export.Milliseconds(),
		"output_load_ms", phases.load.Milliseconds(),
		"image_convert_ms", phases.convert.Milliseconds(),
		"push_ms", phases.push.Milliseconds(),
		"total_ms", phases.total.Milliseconds(),
	)
}

func exportDuration(progress string) time.Duration {
	vertex := exportVertexPattern.FindStringSubmatch(progress)
	if vertex == nil {
		return 0
	}
	done := regexp.MustCompile(`(?m)^#`+vertex[1]+` DONE ([0-9.]+)s$`).FindAllStringSubmatch(progress, -1)
	if len(done) == 0 {
		return 0
	}
	seconds, err := strconv.ParseFloat(done[len(done)-1][1], 64)
	if err != nil {
		return 0
	}
	return time.Duration(seconds * float64(time.Second))
}
