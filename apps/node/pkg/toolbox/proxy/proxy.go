package proxy

import (
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
	common_errors "github.com/snapflow/go-common/pkg/errors"
)

func GetProxyTarget(ctx *gin.Context) (*url.URL, string, map[string]string, error) {
	targetPort := ctx.Param("port")
	if targetPort == "" {
		ctx.Error(common_errors.NewBadRequestError(errors.New("target port is required")))
		return nil, "", nil, errors.New("target port is required")
	}

	targetURL := fmt.Sprintf("http://localhost:%s", targetPort)
	target, err := url.Parse(targetURL)
	if err != nil {
		ctx.Error(common_errors.NewBadRequestError(fmt.Errorf("failed to parse target URL: %w", err)))
		return nil, "", nil, fmt.Errorf("failed to parse target URL: %w", err)
	}

	path := ctx.Param("path")

	if path == "" {
		path = "/"
	} else if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	fullTargetURL := fmt.Sprintf("%s%s", targetURL, path)
	if ctx.Request.URL.RawQuery != "" {
		fullTargetURL = fmt.Sprintf("%s?%s", fullTargetURL, ctx.Request.URL.RawQuery)
	}

	return target, fullTargetURL, nil, nil
}
