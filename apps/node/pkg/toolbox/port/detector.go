package port

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/cakturk/go-netstat/netstat"
	"github.com/labstack/echo/v4"
	cmap "github.com/orcaman/concurrent-map/v2"
)

type portsDetector struct {
	portMap cmap.ConcurrentMap[string, bool]
}

func NewPortsDetector() *portsDetector {
	return &portsDetector{
		portMap: cmap.New[bool](),
	}
}

func (d *portsDetector) Start(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			time.Sleep(1 * time.Second)
			tabs, err := netstat.TCPSocks(func(s *netstat.SockTabEntry) bool {
				return s.State == netstat.Listen
			})
			if err != nil {
				continue
			}

			freshMap := map[string]bool{}
			for _, e := range tabs {
				s := strconv.Itoa(int(e.LocalAddr.Port))
				freshMap[s] = true
				d.portMap.Set(s, true)
			}

			for _, port := range d.portMap.Keys() {
				if !freshMap[port] {
					d.portMap.Remove(port)
				}
			}
		}
	}
}

func (d *portsDetector) GetPorts(c echo.Context) error {
	ports := PortList{
		Ports: []uint{},
	}

	for _, port := range d.portMap.Keys() {
		portInt, err := strconv.Atoi(port)
		if err != nil {
			continue
		}
		ports.Ports = append(ports.Ports, uint(portInt))
	}

	return c.JSON(http.StatusOK, ports)
}

func (d *portsDetector) IsPortInUse(c echo.Context) error {
	portParam := c.Param("port")

	port, err := strconv.Atoi(portParam)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid port: must be a number between 3000 and 9999")
	}

	if port < 3000 || port > 9999 {
		return echo.NewHTTPError(http.StatusBadRequest, "port out of range: must be between 3000 and 9999")
	}

	portStr := strconv.Itoa(port)

	if d.portMap.Has(portStr) {
		return c.JSON(http.StatusOK, IsPortInUseResponse{
			IsInUse: true,
		})
	} else {
		_, err := net.DialTimeout("tcp", fmt.Sprintf("localhost:%d", port), 50*time.Millisecond)
		if err != nil {
			return c.JSON(http.StatusOK, IsPortInUseResponse{
				IsInUse: false,
			})
		} else {
			d.portMap.Set(portStr, true)
			return c.JSON(http.StatusOK, IsPortInUseResponse{
				IsInUse: true,
			})
		}
	}
}
