package main

import (
	"context"
	"io"
	"os"
	"os/signal"
	"path/filepath"
	"time"

	golog "log"

	"github.com/docker/docker/client"
	"github.com/snapflow/executor/cmd/executor/config"
	"github.com/snapflow/executor/internal/util"
	"github.com/snapflow/executor/pkg/api"
	"github.com/snapflow/executor/pkg/cache"
	"github.com/snapflow/executor/pkg/docker"
	executor "github.com/snapflow/executor/pkg/executor"
	"github.com/snapflow/executor/pkg/models"
	"github.com/snapflow/executor/pkg/node"
	"github.com/snapflow/executor/pkg/services"

	"github.com/rs/zerolog"
	zlog "github.com/rs/zerolog/log"

	log "github.com/sirupsen/logrus"
)

func main() {
	cfg, err := config.GetConfig()
	if err != nil {
		log.Error(err)
		return
	}

	apiServer := api.NewApiServer(api.ApiServerConfig{
		ApiPort: cfg.ApiPort,
	})

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		log.Error(err)
		return
	}

	executorCache := cache.NewInMemoryExecutorCache(cache.InMemoryExecutorCacheConfig{
		Cache:         make(map[string]*models.CacheData),
		RetentionDays: cfg.CacheRetentionDays,
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	executorCache.Cleanup(ctx)

	nodePath, err := node.WriteNodeBinary()
	if err != nil {
		log.Error(err)
		return
	}

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

	sandboxService := services.NewSandboxService(executorCache, dockerClient)

	_ = executor.GetInstance(&executor.ExecutorInstanceConfig{
		Cache:          executorCache,
		Docker:         dockerClient,
		SandboxService: sandboxService,
	})

	apiServerErrChan := make(chan error)

	go func() {
		log.Infof("Starting Snapflow exector on port %d", cfg.ApiPort)
		apiServerErrChan <- apiServer.Start()
	}()

	interruptChannel := make(chan os.Signal, 1)
	signal.Notify(interruptChannel, os.Interrupt)

	select {
	case err := <-apiServerErrChan:
		log.Error(err)
		return
	case <-interruptChannel:
		log.Info("Shutting down Snapflow executor")
		apiServer.Stop()
	}
}

func init() {
	logLevel := log.WarnLevel
	logLevelEnv, logLevelSet := os.LookupEnv("LOG_LEVEL")

	if logLevelSet {
		var err error
		logLevel, err = log.ParseLevel(logLevelEnv)
		if err != nil {
			logLevel = log.WarnLevel
		}
	}

	log.SetLevel(logLevel)

	log.SetOutput(os.Stdout)

	logFilePath, logFilePathSet := os.LookupEnv("LOG_FILE_PATH")
	if logFilePathSet {
		logDir := filepath.Dir(logFilePath)
		if err := os.MkdirAll(logDir, 0755); err != nil {
			log.Error("Failed to create log directory:", err)
			os.Exit(1)
		}

		file, err := os.OpenFile(logFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			log.Error(err)
			os.Exit(1)
		}

		log.SetOutput(io.MultiWriter(os.Stdout, file))
	}

	zerologLevel, err := zerolog.ParseLevel(logLevel.String())
	if err != nil {
		zerologLevel = zerolog.ErrorLevel
	}

	zerolog.SetGlobalLevel(zerologLevel)
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	zlog.Logger = zlog.Output(zerolog.ConsoleWriter{
		Out:        &util.DebugLogWriter{},
		TimeFormat: time.RFC3339,
	})

	golog.SetOutput(&util.DebugLogWriter{})
}
