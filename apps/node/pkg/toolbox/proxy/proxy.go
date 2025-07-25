package proxy

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/labstack/echo/v4"
)

func ProxyHandler(c echo.Context) error {
	targetPort := c.Param("port")
	if targetPort == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "target port is required")
	}

	targetURL := fmt.Sprintf("http://localhost:%s", targetPort)
	target, err := url.Parse(targetURL)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("failed to parse target URL: %v", err))
	}

	// Get the path after the port
	path := c.Param("*")
	if path == "" {
		path = "/"
	} else if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	// Create reverse proxy
	proxy := httputil.NewSingleHostReverseProxy(target)

	// Update the request
	req := c.Request()
	req.URL.Scheme = target.Scheme
	req.URL.Host = target.Host
	req.URL.Path = path

	// Add query parameters
	if c.QueryString() != "" {
		req.URL.RawQuery = c.QueryString()
	}

	// Remove X-Forwarded headers to avoid conflicts
	req.Header.Del("X-Forwarded-For")
	req.Header.Del("X-Forwarded-Proto")
	req.Header.Del("X-Forwarded-Host")

	// Perform the proxy request
	proxy.ServeHTTP(c.Response(), req)

	return nil
}

func GetProxyTarget(c echo.Context) (*url.URL, string, map[string]string, error) {
	targetPort := c.Param("port")
	if targetPort == "" {
		return nil, "", nil, errors.New("target port is required")
	}

	targetURL := fmt.Sprintf("http://localhost:%s", targetPort)
	target, err := url.Parse(targetURL)
	if err != nil {
		return nil, "", nil, fmt.Errorf("failed to parse target URL: %w", err)
	}

	path := c.Param("*")
	if path == "" {
		path = "/"
	} else if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	fullTargetURL := fmt.Sprintf("%s%s", targetURL, path)
	if c.QueryString() != "" {
		fullTargetURL = fmt.Sprintf("%s?%s", fullTargetURL, c.QueryString())
	}

	return target, fullTargetURL, nil, nil
}
