package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	golog "log"

	"github.com/docker/docker/client"
	"github.com/rs/zerolog"
	zlog "github.com/rs/zerolog/log"
	log "github.com/sirupsen/logrus"

	"github.com/snapflow/executor/cmd/executor/config"
	"github.com/snapflow/executor/internal/util"
	"github.com/snapflow/executor/pkg/api"
	"github.com/snapflow/executor/pkg/cache"
	"github.com/snapflow/executor/pkg/docker"
	"github.com/snapflow/executor/pkg/executor"
	"github.com/snapflow/executor/pkg/models"
	"github.com/snapflow/executor/pkg/node"
	"github.com/snapflow/executor/pkg/services"
)

func main() {
	if err := initLogging(); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize logging: %v\n", err)
		os.Exit(1)
	}

	cfg, err := config.GetConfig()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Create context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize components
	components, err := initializeComponents(cfg, ctx)
	if err != nil {
		log.Fatalf("Failed to initialize components: %v", err)
	}

	// Start the API server
	if err := runServer(cfg, components.apiServer, ctx); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

type appComponents struct {
	apiServer      *api.ApiServer
	executorCache  cache.IExecutorCache
	dockerClient   *docker.DockerClient
	sandboxService *services.SandboxService
}

func initializeComponents(cfg *config.Config, ctx context.Context) (*appComponents, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("failed to create Docker client: %w", err)
	}

	// Initialize cache
	executorCache := cache.NewInMemoryExecutorCache(cache.InMemoryExecutorCacheConfig{
		Cache:         make(map[string]*models.CacheData),
		RetentionDays: cfg.CacheRetentionDays,
	})
	executorCache.Cleanup(ctx)

	// Write node binary
	nodePath, err := node.WriteNodeBinary()
	if err != nil {
		return nil, fmt.Errorf("failed to write node binary: %w", err)
	}

	// Initialize Docker client wrapper
	dockerClient := docker.NewDockerClient(docker.DockerClientConfig{
		ApiClient:          cli,
		Cache:              executorCache,
		LogWriter:          os.Stdout,
		AWSRegion:          cfg.AWSRegion,
		AWSEndpointUrl:     cfg.AWSEndpointUrl,
		AWSAccessKeyId:     cfg.AWSAccessKeyId,
		AWSSecretAccessKey: cfg.AWSSecretAccessKey,
		DaemonPath:         nodePath,
	})

	// Initialize services
	sandboxService := services.NewSandboxService(executorCache, dockerClient)

	// Initialize executor singleton
	_ = executor.GetInstance(&executor.ExecutorInstanceConfig{
		Cache:          executorCache,
		Docker:         dockerClient,
		SandboxService: sandboxService,
	})

	// Create API server
	apiServer := api.NewApiServer(api.ApiServerConfig{
		ApiPort: cfg.ApiPort,
	})

	return &appComponents{
		apiServer:      apiServer,
		executorCache:  executorCache,
		dockerClient:   dockerClient,
		sandboxService: sandboxService,
	}, nil
}

func runServer(cfg *config.Config, apiServer *api.ApiServer, ctx context.Context) error {
	serverErrors := make(chan error, 1)
	serverStarted := make(chan bool, 1)

	go func() {
		// Create a custom server with timeouts
		srv := &http.Server{
			Addr:         fmt.Sprintf(":%d", cfg.ApiPort),
			Handler:      apiServer.Echo(),
			ReadTimeout:  15 * time.Second,
			WriteTimeout: 15 * time.Second,
			IdleTimeout:  60 * time.Second,
		}

		// Use Echo's built-in server start with custom server
		apiServer.SetHTTPServer(srv)

		// Signal that server is about to start
		serverStarted <- true

		// This will block until server stops
		if err := apiServer.StartServer(srv); err != nil && err != http.ErrServerClosed {
			serverErrors <- fmt.Errorf("API server error: %w", err)
		}
	}()

	// Wait for server to start
	select {
	case <-serverStarted:
		time.Sleep(100 * time.Millisecond)
		log.Infof("Snapflow executor running on :%d", cfg.ApiPort)
	case err := <-serverErrors:
		return err
	case <-time.After(5 * time.Second):
		return fmt.Errorf("timeout waiting for server to start")
	}

	// Setup signal handling
	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, os.Interrupt, syscall.SIGTERM, syscall.SIGQUIT)

	// Wait for shutdown signal or error
	select {
	case err := <-serverErrors:
		return err
	case sig := <-signalChan:
		log.Infof("Received signal %v, initiating graceful shutdown...", sig)
		return gracefulShutdown(ctx, apiServer, 30*time.Second)
	case <-ctx.Done():
		log.Info("Context cancelled, shutting down...")
		return gracefulShutdown(ctx, apiServer, 30*time.Second)
	}
}

func gracefulShutdown(ctx context.Context, apiServer *api.ApiServer, timeout time.Duration) error {
	shutdownCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	if err := apiServer.Shutdown(shutdownCtx); err != nil {
		log.Errorf("Error during server shutdown: %v", err)
		return err
	}

	return nil
}

func initLogging() error {
	logLevel := log.InfoLevel
	if logLevelEnv, ok := os.LookupEnv("LOG_LEVEL"); ok {
		parsedLevel, err := log.ParseLevel(logLevelEnv)
		if err != nil {
			log.Warnf("Invalid LOG_LEVEL '%s', using default 'info': %v", logLevelEnv, err)
		} else {
			logLevel = parsedLevel
		}
	}

	log.SetLevel(logLevel)

	log.SetFormatter(&log.TextFormatter{
		TimestampFormat: "2006-01-02T15:04:05.000Z",
		ForceColors:     true,
		DisableColors:   false,
	})

	log.SetOutput(os.Stdout)

	// Setup file logging if configured
	if logFilePath, ok := os.LookupEnv("LOG_FILE_PATH"); ok {
		logDir := filepath.Dir(logFilePath)
		if err := os.MkdirAll(logDir, 0755); err != nil {
			return fmt.Errorf("failed to create log directory: %w", err)
		}

		file, err := os.OpenFile(logFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			return fmt.Errorf("failed to open log file: %w", err)
		}

		mw := io.MultiWriter(os.Stdout, file)
		log.SetOutput(mw)
		log.Infof("Logging to file: %s", logFilePath)
	}

	// Configure zerolog
	zerologLevel, err := zerolog.ParseLevel(logLevel.String())
	if err != nil {
		zerologLevel = zerolog.InfoLevel
	}

	zerolog.SetGlobalLevel(zerologLevel)
	zerolog.TimeFieldFormat = time.RFC3339

	// Configure zerolog console writer
	output := zerolog.ConsoleWriter{
		Out:        os.Stdout,
		TimeFormat: time.RFC3339,
		NoColor:    false,
	}

	zlog.Logger = zlog.Output(output)

	// Configure standard library logger
	golog.SetOutput(&util.InfoLogWriter{})
	golog.SetFlags(golog.Ldate | golog.Ltime | golog.Lshortfile)

	return nil
}
