package proxy

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	common_errors "github.com/snapflowio/go-common/pkg/errors"

	"github.com/rs/zerolog/log"
)

func (p *Proxy) GetProxyTarget(c echo.Context) (*url.URL, string, map[string]string, error) {
	targetPort, sandboxID, err := p.parseHost(c.Request().Host)
	if err != nil {
		return nil, "", nil, common_errors.NewBadRequestError(err)
	}

	if targetPort == "" {
		return nil, "", nil, common_errors.NewBadRequestError(errors.New("target port is required"))
	}

	if sandboxID == "" {
		return nil, "", nil, common_errors.NewBadRequestError(errors.New("sandbox ID is required"))
	}

	executorInfo, err := p.getExecutorInfo(c.Request().Context(), sandboxID)
	if err != nil {
		return nil, "", nil, common_errors.NewBadRequestError(fmt.Errorf("failed to get executor info: %w", err))
	}

	targetURL := fmt.Sprintf("%s/sandboxes/%s/toolbox/proxy/%s", executorInfo.ApiUrl, sandboxID, targetPort)

	path := c.Param("*")

	if path == "" {
		path = "/"
	} else if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	target, err := url.Parse(fmt.Sprintf("%s%s", targetURL, path))
	if err != nil {
		return nil, "", nil, common_errors.NewBadRequestError(fmt.Errorf("failed to parse target URL: %w", err))
	}

	return target, target.Host, map[string]string{
		"X-Snapflow-Authorization": fmt.Sprintf("Bearer %s", executorInfo.ApiKey),
		"X-Forwarded-Host":         c.Request().Host,
	}, nil
}

func (p *Proxy) getExecutorInfo(ctx context.Context, sandboxId string) (*RunnerInfo, error) {
	has, err := p.executorCache.Has(ctx, sandboxId)
	if err != nil {
		return nil, err
	}

	if has {
		return p.executorCache.Get(ctx, sandboxId)
	}

	executor, _, err := p.apiclient.ExecutorsAPI.GetExecutorBySandboxId(context.Background(), sandboxId).Execute()
	if err != nil {
		return nil, err
	}

	info := RunnerInfo{
		ApiUrl: executor.ApiUrl,
		ApiKey: executor.ApiKey,
	}

	err = p.executorCache.Set(ctx, sandboxId, info, 1*time.Hour)
	if err != nil {
		log.Error().Err(err).Msg("Failed to set executor info in cache")
	}

	return &info, nil
}

func (p *Proxy) parseHost(host string) (targetPort string, sandboxID string, err error) {
	if host == "" {
		return "", "", errors.New("host is required")
	}

	parts := strings.Split(host, ".")
	if len(parts) == 0 {
		return "", "", errors.New("invalid host format")
	}

	hostPrefix := parts[0]
	dashIndex := strings.Index(hostPrefix, "-")
	if dashIndex == -1 {
		return "", "", errors.New("invalid host format: port and sandbox ID not found")
	}

	targetPort = hostPrefix[:dashIndex]
	sandboxID = hostPrefix[dashIndex+1:]

	return targetPort, sandboxID, nil
}
