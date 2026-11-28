// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package serve

import (
	"context"
	"errors"
	"net"
	"net/http"
	"time"

	"github.com/snapflowio/common-go/pkg/httpserver"
)

const shutdownTimeout = 5 * time.Second

func HTTP(ctx context.Context, server *http.Server, listener net.Listener) error {
	httpserver.ApplyTimeouts(server)
	server.BaseContext = func(net.Listener) context.Context { return ctx }
	served := make(chan error, 1)
	go func() { served <- server.Serve(listener) }()
	select {
	case err := <-served:
		return ignoreClosed(err)
	case <-ctx.Done():
	}
	shutdownContext, cancel := context.WithTimeout(context.WithoutCancel(ctx), shutdownTimeout)
	defer cancel()
	shutdownErr := server.Shutdown(shutdownContext)
	if errors.Is(shutdownErr, context.DeadlineExceeded) {
		shutdownErr = server.Close()
	}
	return errors.Join(shutdownErr, ignoreClosed(<-served))
}

func ignoreClosed(err error) error {
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}
