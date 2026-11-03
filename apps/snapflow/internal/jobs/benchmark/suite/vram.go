// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"context"
	"encoding/binary"
	"fmt"
	"strconv"
)

// The VRAM helper allocates and clears all free device memory but the reserve and
// writes the allocated byte count as one little-endian uint64.
const vramOutputBytes = uint64Bytes

func measureVRAM(ctx context.Context, helper string, gpu int, reserveBytes uint64) (uint64, error) {
	output, err := helperCommand(ctx, helper, HelperVRAMCommand, strconv.Itoa(gpu), strconv.FormatUint(reserveBytes, 10)).Output()
	if err != nil {
		return 0, fmt.Errorf("run the VRAM helper on GPU %d: %w", gpu, err)
	}
	if len(output) != vramOutputBytes {
		return 0, fmt.Errorf("the VRAM helper on GPU %d returned %d bytes", gpu, len(output))
	}
	allocated := binary.LittleEndian.Uint64(output)
	if allocated == 0 {
		return 0, fmt.Errorf("the VRAM helper on GPU %d allocated no memory", gpu)
	}
	return allocated, nil
}
