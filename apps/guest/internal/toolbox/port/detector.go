// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package port

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"slices"
	"strconv"
	"sync"
	"time"

	"github.com/cakturk/go-netstat/netstat"
	"github.com/labstack/echo/v5"
)

const (
	minimumDetectedPort = 3000
	maximumDetectedPort = 9999
	portDialTimeout     = 50 * time.Millisecond
	scanInterval        = time.Second
	portParameter       = "port"
	probeNetwork        = "tcp"
	probeHost           = "localhost"
)

type Detector struct {
	mu        sync.RWMutex
	listening map[uint16]struct{}
}

func NewDetector() *Detector {
	return &Detector{listening: make(map[uint16]struct{})}
}

func (d *Detector) Run(ctx context.Context) {
	ticker := time.NewTicker(scanInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			d.refresh()
		}
	}
}

func (d *Detector) refresh() {
	sockets, err := netstat.TCPSocks(func(socket *netstat.SockTabEntry) bool {
		return socket.State == netstat.Listen
	})
	if err != nil {
		return
	}
	listening := make(map[uint16]struct{}, len(sockets))
	for _, socket := range sockets {
		listening[socket.LocalAddr.Port] = struct{}{}
	}
	d.mu.Lock()
	d.listening = listening
	d.mu.Unlock()
}

func (d *Detector) isListening(port uint16) bool {
	d.mu.RLock()
	defer d.mu.RUnlock()
	_, listening := d.listening[port]
	return listening
}

func (d *Detector) markListening(port uint16) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.listening[port] = struct{}{}
}

// @Summary		Get active ports
// @Description	Get a list of all currently active ports
// @Tags			port
// @Produce		json
// @Success		200	{object}	PortList
// @Router			/port [get]
// @id				GetPorts
func (d *Detector) GetPorts(c *echo.Context) error {
	d.mu.RLock()
	ports := PortList{Ports: make([]uint, 0, len(d.listening))}
	for port := range d.listening {
		ports.Ports = append(ports.Ports, uint(port))
	}
	d.mu.RUnlock()
	slices.Sort(ports.Ports)
	return c.JSON(http.StatusOK, ports)
}

// @Summary		Check if port is in use
// @Description	Check if a specific port is currently in use
// @Tags			port
// @Produce		json
// @Param			port	path		int	true	"Port number (3000-9999)"
// @Success		200		{object}	IsPortInUseResponse
// @Router			/port/{port}/in-use [get]
// @id				IsPortInUse
func (d *Detector) IsPortInUse(c *echo.Context) error {
	port, err := strconv.Atoi(c.Param(portParameter))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid port: must be a number between 3000 and 9999")
	}
	if port < minimumDetectedPort || port > maximumDetectedPort {
		return echo.NewHTTPError(http.StatusBadRequest, "port out of range: must be between 3000 and 9999")
	}
	detected := uint16(port)
	if d.isListening(detected) {
		return c.JSON(http.StatusOK, IsPortInUseResponse{IsInUse: true})
	}
	dialer := net.Dialer{Timeout: portDialTimeout}
	conn, err := dialer.DialContext(c.Request().Context(), probeNetwork, net.JoinHostPort(probeHost, strconv.Itoa(port)))
	if err != nil {
		return c.JSON(http.StatusOK, IsPortInUseResponse{IsInUse: false})
	}
	if err := conn.Close(); err != nil {
		return fmt.Errorf("close port probe connection: %w", err)
	}
	d.markListening(detected)
	return c.JSON(http.StatusOK, IsPortInUseResponse{IsInUse: true})
}
