# \ExecutorsAPI

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateExecutor**](ExecutorsAPI.md#CreateExecutor) | **Post** /executors | Create executor
[**GetExecutorBySandboxId**](ExecutorsAPI.md#GetExecutorBySandboxId) | **Get** /executors/by-sandbox/{sandboxId} | Get executor by sandbox ID
[**GetExecutorsByImageInternalName**](ExecutorsAPI.md#GetExecutorsByImageInternalName) | **Get** /executors/by-image | Get executors by image internal name
[**ListExecutors**](ExecutorsAPI.md#ListExecutors) | **Get** /executors | List all executors
[**UpdateExecutorScheduling**](ExecutorsAPI.md#UpdateExecutorScheduling) | **Patch** /executors/{id}/scheduling | Update executor scheduling status



## CreateExecutor

> CreateExecutor(ctx).CreateExecutor(createExecutor).Execute()

Create executor

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	createExecutor := *openapiclient.NewCreateExecutor("Domain_example", "ApiUrl_example", "ApiKey_example", float32(123), float32(123), float32(123), float32(123), "GpuType_example", "small", float32(123), "eu") // CreateExecutor | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ExecutorsAPI.CreateExecutor(context.Background()).CreateExecutor(createExecutor).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExecutorsAPI.CreateExecutor``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateExecutorRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **createExecutor** | [**CreateExecutor**](CreateExecutor.md) |  | 

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetExecutorBySandboxId

> Executor GetExecutorBySandboxId(ctx, sandboxId).Execute()

Get executor by sandbox ID

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExecutorsAPI.GetExecutorBySandboxId(context.Background(), sandboxId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExecutorsAPI.GetExecutorBySandboxId``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetExecutorBySandboxId`: Executor
	fmt.Fprintf(os.Stdout, "Response from `ExecutorsAPI.GetExecutorBySandboxId`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetExecutorBySandboxIdRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


### Return type

[**Executor**](Executor.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetExecutorsByImageInternalName

> []ExecutorImageDto GetExecutorsByImageInternalName(ctx).InternalName(internalName).Execute()

Get executors by image internal name

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	internalName := "internalName_example" // string | Internal name of the image

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExecutorsAPI.GetExecutorsByImageInternalName(context.Background()).InternalName(internalName).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExecutorsAPI.GetExecutorsByImageInternalName``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetExecutorsByImageInternalName`: []ExecutorImageDto
	fmt.Fprintf(os.Stdout, "Response from `ExecutorsAPI.GetExecutorsByImageInternalName`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetExecutorsByImageInternalNameRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **internalName** | **string** | Internal name of the image | 

### Return type

[**[]ExecutorImageDto**](ExecutorImageDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListExecutors

> ListExecutors(ctx).Execute()

List all executors

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ExecutorsAPI.ListExecutors(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExecutorsAPI.ListExecutors``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListExecutorsRequest struct via the builder pattern


### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## UpdateExecutorScheduling

> UpdateExecutorScheduling(ctx, id).Execute()

Update executor scheduling status

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	id := "id_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ExecutorsAPI.UpdateExecutorScheduling(context.Background(), id).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExecutorsAPI.UpdateExecutorScheduling``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**id** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateExecutorSchedulingRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

