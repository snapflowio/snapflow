package main

import (
	"fmt"
	"os"

	"github.com/rs/zerolog/log"
	"github.com/snapflowio/go-common/pkg/logger"
	"github.com/snapflowio/proxy/cmd/proxy/config"
	"github.com/snapflowio/proxy/pkg/proxy"
)

func main() {
	if err := logger.Init(logger.DefaultConfig()); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize logging: %v\n", err)
		os.Exit(1)
	}

	config, err := config.GetConfig()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	err = proxy.StartProxy(config)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to start proxy")
	}
}
