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
	"context"
	"fmt"

	"github.com/snapflowio/microvm-go/hypervisor"
)

func (b *Backend) PrepareHypervisors(ctx context.Context, values ...hypervisor.Hypervisor) (map[hypervisor.Hypervisor]string, error) {
	prepared := make(map[hypervisor.Hypervisor]string, len(values))
	for _, value := range values {
		if _, enabled := b.enabledHypervisors[value]; !enabled {
			return nil, fmt.Errorf("hypervisor %s is not enabled", value)
		}
		path, err := b.vmmBinaries.Resolve(ctx, value)
		if err != nil {
			return nil, fmt.Errorf("prepare hypervisor %s: %w", value, err)
		}
		prepared[value] = path
	}
	return prepared, nil
}
