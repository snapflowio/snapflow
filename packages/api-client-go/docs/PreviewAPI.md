# \PreviewAPI

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**HasSandboxAccess**](PreviewAPI.md#HasSandboxAccess) | **Get** /preview/{sandboxId}/access | Check if user has access to the sandbox
[**IsSandboxPublic**](PreviewAPI.md#IsSandboxPublic) | **Get** /preview/{sandboxId}/public | Check if sandbox is public
[**IsValidAuthToken**](PreviewAPI.md#IsValidAuthToken) | **Get** /preview/{sandboxId}/validate/{authToken} | Check if sandbox auth token is valid



## HasSandboxAccess

> HasSandboxAccess(ctx, sandboxId).Execute()

Check if user has access to the sandbox

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
	r, err := apiClient.PreviewAPI.HasSandboxAccess(context.Background(), sandboxId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PreviewAPI.HasSandboxAccess``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiHasSandboxAccessRequest struct via the builder pattern


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


## IsSandboxPublic

> bool IsSandboxPublic(ctx, sandboxId).Execute()

Check if sandbox is public

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
	sandboxId := "sandboxId_example" // string | ID of the sandbox

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PreviewAPI.IsSandboxPublic(context.Background(), sandboxId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PreviewAPI.IsSandboxPublic``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `IsSandboxPublic`: bool
	fmt.Fprintf(os.Stdout, "Response from `PreviewAPI.IsSandboxPublic`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** | ID of the sandbox | 

### Other Parameters

Other parameters are passed through a pointer to a apiIsSandboxPublicRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


### Return type

**bool**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## IsValidAuthToken

> bool IsValidAuthToken(ctx, sandboxId, authToken).Execute()

Check if sandbox auth token is valid

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
	sandboxId := "sandboxId_example" // string | ID of the sandbox
	authToken := "authToken_example" // string | Auth token of the sandbox

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PreviewAPI.IsValidAuthToken(context.Background(), sandboxId, authToken).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PreviewAPI.IsValidAuthToken``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `IsValidAuthToken`: bool
	fmt.Fprintf(os.Stdout, "Response from `PreviewAPI.IsValidAuthToken`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** | ID of the sandbox | 
**authToken** | **string** | Auth token of the sandbox | 

### Other Parameters

Other parameters are passed through a pointer to a apiIsValidAuthTokenRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------



### Return type

**bool**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

