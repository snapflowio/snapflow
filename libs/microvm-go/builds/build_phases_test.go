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
	"testing"
	"time"
)

const builderLog = `#5 [2/3] RUN echo built-by-snapflow > /built.txt
#5 DONE 3.3s

#7 exporting to oci image format
#7 exporting layers
#7 exporting layers 0.2s done
#7 DONE 0.4s

#7 exporting to oci image format
#7 DONE 1.0s
`

func TestBuildPhasesParseExport(t *testing.T) {
	if got, want := exportDuration(builderLog), time.Second; got != want {
		t.Errorf("export = %s, want %s", got, want)
	}
	if exportDuration("") != 0 {
		t.Error("a log without markers reported phase durations")
	}
}
