// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package session

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

func PrintEntrypointLogs(ctx context.Context, configDir string, stdout, stderr io.Writer) error {
	commandDir := filepath.Join(configDir, sessionsDirectory, EntrypointID, EntrypointCommand)
	logFile, err := os.Open(filepath.Join(commandDir, outputFileName))
	if err != nil {
		return fmt.Errorf("open entrypoint log: %w", err)
	}
	defer logFile.Close()
	var demux demuxer
	write := func(chunks []logChunk) error {
		for _, chunk := range chunks {
			target := stdout
			if chunk.stream == streamStderr {
				target = stderr
			}
			if _, err := target.Write(chunk.data); err != nil {
				return fmt.Errorf("write entrypoint log: %w", err)
			}
		}
		return nil
	}
	if err := tail(ctx, logFile, true, filepath.Join(commandDir, exitCodeFileName), func(data []byte) error {
		return write(demux.feed(data))
	}); err != nil {
		return err
	}
	return write(demux.flush())
}
