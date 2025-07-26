package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/docker/docker/client"
	"github.com/rs/zerolog/log"

	"github.com/snapflow/executor/cmd/executor/config"
	"github.com/snapflow/executor/pkg/api"
	"github.com/snapflow/executor/pkg/cache"
	"github.com/snapflow/executor/pkg/docker"
	"github.com/snapflow/executor/pkg/executor"
	"github.com/snapflow/executor/pkg/models"
	"github.com/snapflow/executor/pkg/node"
	"github.com/snapflow/executor/pkg/services"
	"github.com/snapflow/go-common/pkg/logger"
)

func main() {
	if err := logger.Init(logger.DefaultConfig()); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize logging: %v\n", err)
		os.Exit(1)
	}

	cfg, err := config.GetConfig()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	// Create context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize components
	components, err := initializeComponents(cfg, ctx)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize components")
	}

	// Start the API server
	if err := runServer(cfg, components.apiServer, ctx); err != nil {
		log.Fatal().Err(err).Msg("Server error")
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
		log.Info().Msgf("Snapflow executor running on :%d", cfg.ApiPort)
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
		log.Info().Msgf("Received signal %v, initiating graceful shutdown...", sig)
		return gracefulShutdown(ctx, apiServer, 30*time.Second)
	case <-ctx.Done():
		log.Info().Msg("Context cancelled, shutting down...")
		return gracefulShutdown(ctx, apiServer, 30*time.Second)
	}
}

func gracefulShutdown(ctx context.Context, apiServer *api.ApiServer, timeout time.Duration) error {
	shutdownCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	if err := apiServer.Shutdown(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("Error during server shutdown")
		return err
	}

	return nil
}
