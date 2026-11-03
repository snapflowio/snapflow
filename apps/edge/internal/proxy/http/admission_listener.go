// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package http

import (
	"errors"
	"fmt"
	"net"
	"net/netip"

	"github.com/snapflowio/edge/internal/admit"
)

type admissionListener struct {
	net.Listener
	admission admitter
}

func newAdmissionListener(
	listener net.Listener,
	admissionController admitter,
) net.Listener {
	return &admissionListener{
		Listener:  listener,
		admission: admissionController,
	}
}

func (admitting *admissionListener) Accept() (net.Conn, error) {
	for {
		connection, err := admitting.Listener.Accept()
		if err != nil {
			return nil, err
		}
		source, err := httpConnectionSource(connection.RemoteAddr())
		if err != nil {
			closeErr := connection.Close()
			return nil, errors.Join(
				fmt.Errorf("resolve HTTP connection source: %w", err),
				closeErr,
			)
		}
		permit, result := admitting.admission.AdmitHTTPConnection(source)
		if result == admit.ResultAllowed {
			return &admittedConnection{
				Conn:   connection,
				permit: permit,
			}, nil
		}
		if err := connection.Close(); err != nil {
			return nil, fmt.Errorf(
				"close rejected HTTP connection: %w",
				err,
			)
		}
	}
}

func httpConnectionSource(address net.Addr) (netip.Addr, error) {
	source, err := netip.ParseAddrPort(address.String())
	if err != nil {
		return netip.Addr{}, err
	}
	return source.Addr().Unmap(), nil
}

type admittedConnection struct {
	net.Conn
	permit *admit.Permit
}

func (connection *admittedConnection) Close() error {
	err := connection.Conn.Close()
	connection.permit.Release()
	return err
}

func (connection *admittedConnection) NetConn() net.Conn {
	return connection.Conn
}
