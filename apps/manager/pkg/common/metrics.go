package common

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type PrometheusOperationStatus string

const (
	PrometheusOperationStatusSuccess PrometheusOperationStatus = "success"
	PrometheusOperationStatusFailure PrometheusOperationStatus = "failure"
)

var (
	ContainerOperationDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "container_operation_duration_seconds",
			Help:    "Time taken for container operations in seconds",
			Buckets: []float64{0.1, 0.25, 0.5, 0.75, 1, 2, 3, 5, 7.5, 10, 15, 30, 60, 120, 300},
		},
		[]string{"operation"},
	)

	ContainerOperationCount = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "container_operation_total",
			Help: "Total number of container operations",
		},
		[]string{"operation", "status"},
	)
)
