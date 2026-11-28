// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package proxy

import (
	"errors"
	"io"
	"log/slog"
	"net"
)

type writeCloser interface {
	CloseWrite() error
}

func CloseWrite(closer io.Closer) error {
	if halfCloser, ok := closer.(writeCloser); ok {
		return halfCloser.CloseWrite()
	}
	return closer.Close()
}

func CloseAndLog(logger *slog.Logger, resource string, closer io.Closer) {
	if err := closer.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
		logger.Debug("network resource did not close cleanly", "resource", resource, "error", err)
	}
}
