package proxy

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/securecookie"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	apiclient "github.com/snapflowio/api-client-go"
	"github.com/snapflowio/proxy/cmd/proxy/config"
	"github.com/snapflowio/proxy/pkg/cache"

	common_errors "github.com/snapflowio/go-common/pkg/errors"

	"github.com/rs/zerolog/log"
)

type RunnerInfo struct {
	ApiUrl string `json:"apiUrl"`
	ApiKey string `json:"apiKey"`
}

const SNAPFLOW_SANDBOX_AUTH_KEY_HEADER = "X-Snapflow-Preview-Token"
const SNAPFLOW_SANDBOX_AUTH_KEY_QUERY_PARAM = "SNAPFLOW_SANDBOX_AUTH_KEY"
const SNAPFLOW_SANDBOX_AUTH_COOKIE_NAME = "snapflow-sandbox-auth-"

type Proxy struct {
	config       *config.Config
	secureCookie *securecookie.SecureCookie

	apiclient                *apiclient.APIClient
	executorCache            cache.ICache[RunnerInfo]
	sandboxPublicCache       cache.ICache[bool]
	sandboxAuthKeyValidCache cache.ICache[bool]
}

func getErrorCode(statusCode int) string {
	switch statusCode {
	case http.StatusBadRequest:
		return "BAD_REQUEST"
	case http.StatusUnauthorized:
		return "UNAUTHORIZED"
	case http.StatusNotFound:
		return "NOT_FOUND"
	case http.StatusConflict:
		return "CONFLICT"
	case http.StatusInternalServerError:
		return "INTERNAL_SERVER_ERROR"
	default:
		return "ERROR"
	}
}

func StartProxy(config *config.Config) error {
	proxy := &Proxy{
		config: config,
	}

	proxy.secureCookie = securecookie.New([]byte(config.ProxyApiKey), nil)

	clientConfig := apiclient.NewConfiguration()
	clientConfig.Servers = apiclient.ServerConfigurations{
		{
			URL: config.SnapflowApiUrl,
		},
	}

	clientConfig.AddDefaultHeader("Authorization", "Bearer "+config.ProxyApiKey)

	proxy.apiclient = apiclient.NewAPIClient(clientConfig)

	proxy.apiclient.GetConfig().HTTPClient = &http.Client{
		Transport: http.DefaultTransport,
	}

	if config.Redis != nil {
		var err error
		proxy.executorCache, err = cache.NewRedisCache[RunnerInfo](config.Redis, "proxy:sandbox-executor-info:")
		if err != nil {
			return err
		}
		proxy.sandboxPublicCache, err = cache.NewRedisCache[bool](config.Redis, "proxy:sandbox-public:")
		if err != nil {
			return err
		}
		proxy.sandboxAuthKeyValidCache, err = cache.NewRedisCache[bool](config.Redis, "proxy:sandbox-auth-key-valid:")
		if err != nil {
			return err
		}
	} else {
		proxy.executorCache = cache.NewMapCache[RunnerInfo]()
		proxy.sandboxPublicCache = cache.NewMapCache[bool]()
		proxy.sandboxAuthKeyValidCache = cache.NewMapCache[bool]()
	}

	e := echo.New()
	e.HideBanner = true
	e.HidePort = true

	e.Use(middleware.Recover())

	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if c.Request().Header.Get("X-Snapflow-Disable-CORS") == "true" {
				c.Request().Header.Del("X-Snapflow-Disable-CORS")
				return next(c)
			}

			corsConfig := middleware.CORSConfig{
				AllowOriginFunc: func(origin string) (bool, error) {
					return true, nil
				},
				AllowCredentials: true,
				AllowHeaders:     []string{},
			}

			for header := range c.Request().Header {
				corsConfig.AllowHeaders = append(corsConfig.AllowHeaders, header)
			}

			accessControlHeaders := c.Request().Header.Values("Access-Control-Request-Headers")
			corsConfig.AllowHeaders = append(corsConfig.AllowHeaders, accessControlHeaders...)

			return middleware.CORSWithConfig(corsConfig)(next)(c)
		}
	})

	e.HTTPErrorHandler = func(err error, c echo.Context) {
		if c.Response().Committed {
			return
		}

		var statusCode int
		var message string

		if httpErr, ok := err.(*echo.HTTPError); ok {
			statusCode = httpErr.Code
			message = fmt.Sprintf("%v", httpErr.Message)
		} else if customErr, ok := err.(*common_errors.CustomError); ok {
			statusCode = customErr.StatusCode
			message = customErr.Message
		} else if _, ok := err.(*common_errors.NotFoundError); ok {
			statusCode = http.StatusNotFound
			message = err.Error()
		} else if _, ok := err.(*common_errors.UnauthorizedError); ok {
			statusCode = http.StatusUnauthorized
			message = err.Error()
		} else if _, ok := err.(*common_errors.BadRequestError); ok {
			statusCode = http.StatusBadRequest
			message = err.Error()
		} else if _, ok := err.(*common_errors.ConflictError); ok {
			statusCode = http.StatusConflict
			message = err.Error()
		} else if _, ok := err.(*common_errors.InvalidBodyRequestError); ok {
			statusCode = http.StatusBadRequest
			message = err.Error()
		} else {
			statusCode = http.StatusInternalServerError
			message = err.Error()
		}

		c.JSON(statusCode, common_errors.ErrorResponse{
			StatusCode: statusCode,
			Message:    message,
			Code:       getErrorCode(statusCode),
			Timestamp:  time.Now(),
			Path:       c.Request().URL.Path,
			Method:     c.Request().Method,
		})
	}

	e.Any("/*", func(c echo.Context) error {
		_, _, err := proxy.parseHost(c.Request().Host)
		if err != nil {
			switch c.Request().Method {
			case "GET":
				switch c.Request().URL.Path {
				case "/callback":
					return proxy.AuthCallback(c)
				case "/health":
					return c.JSON(http.StatusOK, echo.Map{"status": "ok"})
				}
			}

			return common_errors.NewNotFoundError(errors.New("not found"))
		}

		return proxy.NewEchoProxyRequestHandler(proxy.GetProxyTarget)(c)
	})

	addr := fmt.Sprintf(":%d", config.ProxyPort)
	log.Info().Msgf("Proxy server is running on port %d", config.ProxyPort)

	if config.EnableTLS {
		return e.StartTLS(addr, config.TLSCertFile, config.TLSKeyFile)
	}

	return e.Start(addr)
}
