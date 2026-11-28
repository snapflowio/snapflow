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

package escrowhash

import (
	"fmt"

	"github.com/ethereum/go-ethereum/accounts/abi"
)

func encode(typeNames []string, values ...any) ([]byte, error) {
	arguments := make(abi.Arguments, 0, len(typeNames))
	for _, name := range typeNames {
		argumentType, err := abi.NewType(name, "", nil)
		if err != nil {
			return nil, fmt.Errorf("abi type %s: %w", name, err)
		}
		arguments = append(arguments, abi.Argument{Type: argumentType})
	}
	return arguments.Pack(values...)
}
