module github.com/snapflowio/origin

go 1.27.4

require (
	github.com/google/uuid v1.6.0
	github.com/snapflowio/common-go v0.0.0-00010101000000-000000000000
	github.com/snapflowio/tunnel-go v0.0.0
)

require (
	github.com/libp2p/go-buffer-pool v0.1.0 // indirect
	github.com/libp2p/go-yamux/v5 v5.1.0 // indirect
	github.com/lmittmann/tint v1.2.1 // indirect
	github.com/quic-go/quic-go v0.65.0 // indirect
	golang.org/x/crypto v0.59.0 // indirect
	golang.org/x/net v0.62.0 // indirect
	golang.org/x/sys v0.50.0 // indirect
)

replace github.com/snapflowio/common-go => ../../libs/common-go

replace github.com/snapflowio/tunnel-go => ../../libs/tunnel-go
