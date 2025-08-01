//	@title			Snapflow Executor API
//	@version		v0.0.0-dev
//	@description	Snapflow Executor API

//	@securityDefinitions.apikey	Bearer
//	@in							header
//	@name						Authorization
//	@description				Type "Bearer" followed by a space and an API token.

// @Security	Bearer
package api

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/zerolog/log"
	"github.com/snapflowio/executor/cmd/executor/config"
	"github.com/snapflowio/executor/pkg/api/controllers"
	"github.com/snapflowio/executor/pkg/api/docs"
	"github.com/snapflowio/executor/pkg/api/middlewares"

	echoSwagger "github.com/swaggo/echo-swagger"
)

type ApiServerConfig struct {
	ApiPort     int
	TLSCertFile string
	TLSKeyFile  string
	EnableTLS   bool
}

func NewApiServer(config ApiServerConfig) *ApiServer {
	return &ApiServer{
		apiPort:     config.ApiPort,
		tlsCertFile: config.TLSCertFile,
		tlsKeyFile:  config.TLSKeyFile,
		enableTLS:   config.EnableTLS,
	}
}

type ApiServer struct {
	apiPort     int
	tlsCertFile string
	tlsKeyFile  string
	enableTLS   bool
	httpServer  *http.Server
	echo        *echo.Echo
}

// Echo returns the underlying Echo instance
func (a *ApiServer) Echo() *echo.Echo {
	if a.echo == nil {
		a.initializeEcho()
	}
	return a.echo
}

// SetHTTPServer allows setting a custom HTTP server
func (a *ApiServer) SetHTTPServer(srv *http.Server) {
	a.httpServer = srv
}

// StartServer starts with a provided HTTP server
func (a *ApiServer) StartServer(srv *http.Server) error {
	if a.enableTLS {
		return srv.ListenAndServeTLS(a.tlsCertFile, a.tlsKeyFile)
	}
	return srv.ListenAndServe()
}

// Shutdown gracefully shuts down the server
func (a *ApiServer) Shutdown(ctx context.Context) error {
	if a.httpServer != nil {
		return a.httpServer.Shutdown(ctx)
	}
	return nil
}

func (a *ApiServer) Start() error {
	docs.SwaggerInfo.Description = "Snapflow Executor API"
	docs.SwaggerInfo.Title = "Snapflow Executor API"
	docs.SwaggerInfo.BasePath = "/"

	_, err := net.Dial("tcp", fmt.Sprintf(":%d", a.apiPort))
	if err == nil {
		return fmt.Errorf("cannot start API server, port %d is already in use", a.apiPort)
	}

	a.initializeEcho()

	a.httpServer = &http.Server{
		Addr:    fmt.Sprintf(":%d", a.apiPort),
		Handler: a.echo,
	}

	listener, err := net.Listen("tcp", a.httpServer.Addr)
	if err != nil {
		return err
	}

	if a.enableTLS {
		return a.httpServer.ServeTLS(listener, a.tlsCertFile, a.tlsKeyFile)
	}
	return a.httpServer.Serve(listener)
}

func (a *ApiServer) initializeEcho() {
	a.echo = echo.New()
	a.echo.HideBanner = true
	a.echo.HidePort = true

	// Set custom validator
	a.echo.Validator = NewCustomValidator()

	// Middleware
	a.echo.Use(middleware.Recover())
	a.echo.Use(middlewares.LoggingMiddleware())
	a.echo.Use(middlewares.ErrorMiddleware())

	// Public routes
	public := a.echo.Group("")
	public.GET("/", controllers.HealthCheck)
	public.GET("/metrics", echo.WrapHandler(promhttp.Handler()))

	if config.GetEnvironment() == "development" {
		public.GET("/api/*", echoSwagger.WrapHandler)
	}

	// Protected routes
	protected := a.echo.Group("")
	protected.Use(middlewares.AuthMiddleware())

	// Sandbox routes
	sandbox := protected.Group("/sandboxes")
	sandbox.POST("", controllers.Create)
	sandbox.GET("/:sandboxId", controllers.Info)
	sandbox.POST("/:sandboxId/destroy", controllers.Destroy)
	sandbox.POST("/:sandboxId/start", controllers.Start)
	sandbox.POST("/:sandboxId/stop", controllers.Stop)
	sandbox.POST("/:sandboxId/backup", controllers.CreateBackup)
	sandbox.POST("/:sandboxId/resize", controllers.Resize)
	sandbox.DELETE("/:sandboxId", controllers.RemoveDestroyed)
	sandbox.Any("/:sandboxId/toolbox/*", controllers.ProxyRequest)

	// Image routes
	image := protected.Group("/images")
	image.POST("/pull", controllers.PullImage)
	image.POST("/build", controllers.BuildImage)
	image.GET("/exists", controllers.ImageExists)
	image.POST("/remove", controllers.RemoveImage)
	image.GET("/logs", controllers.GetBuildLogs)
}

func (a *ApiServer) Stop() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := a.httpServer.Shutdown(ctx); err != nil {
		log.Error().Err(err).Msg("Error shutting down server")
	}
}
