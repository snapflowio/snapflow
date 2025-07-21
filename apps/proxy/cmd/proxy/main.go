package main

import (
	"github.com/snapflow/proxy/cmd/proxy/config"
	"github.com/snapflow/proxy/pkg/proxy"

	log "github.com/sirupsen/logrus"
)

func main() {
	config, err := config.GetConfig()
	if err != nil {
		log.Fatal(err)
	}

	err = proxy.StartProxy(config)
	if err != nil {
		log.Fatal(err)
	}
}
