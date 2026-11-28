module github.com/snapflowio/edge

go 1.27.4

require (
	github.com/google/uuid v1.6.0
	github.com/oapi-codegen/runtime v1.9.0
	github.com/prometheus/client_golang v1.25.0
	github.com/snapflowio/common-go v0.0.0-00010101000000-000000000000
	github.com/snapflowio/snapflow/libs/api-client-go v0.152.1
	github.com/snapflowio/snapflow/libs/machine-proto v0.0.0-00010101000000-000000000000
	github.com/snapflowio/tunnel-go v0.0.0
	golang.org/x/net v0.62.0
	golang.org/x/sys v0.50.0
	golang.org/x/time v0.16.0
	google.golang.org/protobuf v1.36.12
)

require (
	github.com/apapsch/go-jsonmerge/v2 v2.0.0 // indirect
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/klauspost/compress v1.20.4 // indirect
	github.com/libp2p/go-buffer-pool v0.1.0 // indirect
	github.com/libp2p/go-yamux/v5 v5.1.0 // indirect
	github.com/lmittmann/tint v1.2.1 // indirect
	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
	github.com/pandatix/go-abnf v0.5.5 // indirect
	github.com/prometheus/client_model v0.6.3 // indirect
	github.com/prometheus/common v0.74.0 // indirect
	github.com/prometheus/procfs v0.23.0 // indirect
	github.com/quic-go/quic-go v0.65.0 // indirect
	golang.org/x/crypto v0.59.0 // indirect
	golang.org/x/text v0.44.0 // indirect
)

replace github.com/snapflowio/common-go => ../../libs/common-go

replace github.com/snapflowio/snapflow/libs/api-client-go => ../../libs/api-client-go

replace github.com/snapflowio/tunnel-go => ../../libs/tunnel-go

replace github.com/snapflowio/snapflow/libs/machine-proto => ../../libs/machine-proto
