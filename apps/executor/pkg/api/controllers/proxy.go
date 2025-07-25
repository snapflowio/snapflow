package controllers

import (
	"errors"
	"fmt"
	"net/http/httputil"
	"net/url"
	"regexp"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/snapflow/executor/pkg/common"
	"github.com/snapflow/executor/pkg/executor"
)

// ProxyRequest handles proxying requests to a sandbox's container
//
//	@Tags			toolbox
//	@Summary		Proxy requests to the sandbox toolbox
//	@Description	Forwards the request to the specified sandbox's container
//	@Param			sandboxId	path		string	true	"Sandbox ID"
//	@Param			path		path		string	true	"Path to forward"
//	@Success		200			{object}	any		"Proxied response"
//	@Failure		400			{object}	string	"Bad request"
//	@Failure		401			{object}	string	"Unauthorized"
//	@Failure		404			{object}	string	"Sandbox container not found"
//	@Failure		409			{object}	string	"Sandbox container conflict"
//	@Failure		500			{object}	string	"Internal server error"
//	@Router			/sandboxes/{sandboxId}/toolbox/{path} [get]
//	@Router			/sandboxes/{sandboxId}/toolbox/{path} [post]
//	@Router			/sandboxes/{sandboxId}/toolbox/{path} [delete]
func ProxyRequest(c echo.Context) error {
	path := c.Param("*")
	if regexp.MustCompile(`^/process/session/.+/command/.+/logs$`).MatchString(path) {
		if c.QueryParam("follow") == "true" {
			return ProxyCommandLogsStream(c)
		}
	}

	return proxyRequestHandler(c)
}

func proxyRequestHandler(c echo.Context) error {
	target, err := getProxyTarget(c)
	if err != nil {
		return err
	}

	proxy := httputil.NewSingleHostReverseProxy(target)

	// Modify the request
	req := c.Request()
	req.URL.Scheme = target.Scheme
	req.URL.Host = target.Host
	req.Host = target.Host

	// Get the wildcard path and normalize it
	path := c.Param("*")
	if path == "" {
		path = "/"
	} else if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	req.URL.Path = path

	// Forward the request
	proxy.ServeHTTP(c.Response().Writer, req)
	return nil
}

func getProxyTarget(c echo.Context) (*url.URL, error) {
	exec := executor.GetInstance(nil)

	sandboxId := c.Param("sandboxId")
	if sandboxId == "" {
		return nil, common.NewBadRequestError(errors.New("sandbox ID is required"))
	}

	// Get container details
	container, err := exec.Docker.ContainerInspect(c.Request().Context(), sandboxId)
	if err != nil {
		return nil, common.NewNotFoundError(fmt.Errorf("sandbox container not found: %w", err))
	}

	var containerIP string
	for _, network := range container.NetworkSettings.Networks {
		containerIP = network.IPAddress
		break
	}

	if containerIP == "" {
		return nil, common.NewBadRequestError(errors.New("container has no IP address, it might not be running"))
	}

	// Build the target URL
	targetURL := fmt.Sprintf("http://%s:8082", containerIP)
	target, err := url.Parse(targetURL)
	if err != nil {
		return nil, common.NewBadRequestError(fmt.Errorf("failed to parse target URL: %w", err))
	}

	return target, nil
}
