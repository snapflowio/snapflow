# \SandboxAPI

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ArchiveSandbox**](SandboxAPI.md#ArchiveSandbox) | **Post** /sandbox/{sandboxId}/archive | Archive sandbox
[**CreateBackup**](SandboxAPI.md#CreateBackup) | **Post** /sandbox/{sandboxId}/backup | Create sandbox backup
[**CreateSandbox**](SandboxAPI.md#CreateSandbox) | **Post** /sandbox | Create a new sandbox
[**DeleteSandbox**](SandboxAPI.md#DeleteSandbox) | **Delete** /sandbox/{sandboxId} | Delete sandbox
[**GetBuildLogs**](SandboxAPI.md#GetBuildLogs) | **Get** /sandbox/{sandboxId}/build-logs | Get build logs
[**GetPortPreviewUrl**](SandboxAPI.md#GetPortPreviewUrl) | **Get** /sandbox/{sandboxId}/ports/{port}/preview-url | Get preview URL for a sandbox port
[**GetSandbox**](SandboxAPI.md#GetSandbox) | **Get** /sandbox/{sandboxId} | Get sandbox details
[**ListSandboxes**](SandboxAPI.md#ListSandboxes) | **Get** /sandbox | List all sandboxes
[**ReplaceLabels**](SandboxAPI.md#ReplaceLabels) | **Put** /sandbox/{sandboxId}/labels | Replace sandbox labels
[**SetAutoArchiveInterval**](SandboxAPI.md#SetAutoArchiveInterval) | **Post** /sandbox/{sandboxId}/autoarchive/{interval} | Set sandbox auto-archive interval
[**SetAutostopInterval**](SandboxAPI.md#SetAutostopInterval) | **Post** /sandbox/{sandboxId}/autostop/{interval} | Set sandbox auto-stop interval
[**StartSandbox**](SandboxAPI.md#StartSandbox) | **Post** /sandbox/{sandboxId}/start | Start sandbox
[**StopSandbox**](SandboxAPI.md#StopSandbox) | **Post** /sandbox/{sandboxId}/stop | Stop sandbox
[**UpdatePublicStatus**](SandboxAPI.md#UpdatePublicStatus) | **Post** /sandbox/{sandboxId}/public/{isPublic} | Update public status



## ArchiveSandbox

> ArchiveSandbox(ctx, sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Archive sandbox

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
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.SandboxAPI.ArchiveSandbox(context.Background(), sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SandboxAPI.ArchiveSandbox``: %v\n", err)
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

Other parameters are passed through a pointer to a apiArchiveSandboxRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

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


## CreateBackup

> Sandbox CreateBackup(ctx, sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Create sandbox backup

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
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SandboxAPI.CreateBackup(context.Background(), sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SandboxAPI.CreateBackup``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateBackup`: Sandbox
	fmt.Fprintf(os.Stdout, "Response from `SandboxAPI.CreateBackup`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** | ID of the sandbox | 

### Other Parameters

Other parameters are passed through a pointer to a apiCreateBackupRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**Sandbox**](Sandbox.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CreateSandbox

> Sandbox CreateSandbox(ctx).CreateSandbox(createSandbox).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Create a new sandbox

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
	createSandbox := *openapiclient.NewCreateSandbox() // CreateSandbox | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SandboxAPI.CreateSandbox(context.Background()).CreateSandbox(createSandbox).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SandboxAPI.CreateSandbox``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateSandbox`: Sandbox
	fmt.Fprintf(os.Stdout, "Response from `SandboxAPI.CreateSandbox`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateSandboxRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **createSandbox** | [**CreateSandbox**](CreateSandbox.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**Sandbox**](Sandbox.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DeleteSandbox

> DeleteSandbox(ctx, sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Delete sandbox

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
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.SandboxAPI.DeleteSandbox(context.Background(), sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SandboxAPI.DeleteSandbox``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** | ID of the sandbox | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteSandboxRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

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


## GetBuildLogs

> GetBuildLogs(ctx, sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Follow(follow).Execute()

Get build logs

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
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)
	follow := true // bool | Whether to follow the logs stream (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.SandboxAPI.GetBuildLogs(context.Background(), sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Follow(follow).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SandboxAPI.GetBuildLogs``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** | ID of the sandbox | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetBuildLogsRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 
 **follow** | **bool** | Whether to follow the logs stream | 

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


## GetPortPreviewUrl

> PortPreviewUrl GetPortPreviewUrl(ctx, sandboxId, port).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Get preview URL for a sandbox port

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
	port := float32(8.14) // float32 | Port number to get preview URL for
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SandboxAPI.GetPortPreviewUrl(context.Background(), sandboxId, port).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SandboxAPI.GetPortPreviewUrl``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetPortPreviewUrl`: PortPreviewUrl
	fmt.Fprintf(os.Stdout, "Response from `SandboxAPI.GetPortPreviewUrl`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** | ID of the sandbox | 
**port** | **float32** | Port number to get preview URL for | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetPortPreviewUrlRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**PortPreviewUrl**](PortPreviewUrl.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetSandbox

> Sandbox GetSandbox(ctx, sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Verbose(verbose).Execute()

Get sandbox details

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
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)
	verbose := true // bool | Include verbose output (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SandboxAPI.GetSandbox(context.Background(), sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Verbose(verbose).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SandboxAPI.GetSandbox``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetSandbox`: Sandbox
	fmt.Fprintf(os.Stdout, "Response from `SandboxAPI.GetSandbox`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** | ID of the sandbox | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetSandboxRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 
 **verbose** | **bool** | Include verbose output | 

### Return type

[**Sandbox**](Sandbox.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListSandboxes

> []Sandbox ListSandboxes(ctx).XSnapflowOrganizationID(xSnapflowOrganizationID).Verbose(verbose).Labels(labels).IncludeErroredDeleted(includeErroredDeleted).Execute()

List all sandboxes

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
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)
	verbose := true // bool | Include verbose output (optional)
	labels := "{"label1": "value1", "label2": "value2"}" // string | JSON encoded labels to filter by (optional)
	includeErroredDeleted := true // bool | Include errored and deleted sandboxes (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SandboxAPI.ListSandboxes(context.Background()).XSnapflowOrganizationID(xSnapflowOrganizationID).Verbose(verbose).Labels(labels).IncludeErroredDeleted(includeErroredDeleted).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SandboxAPI.ListSandboxes``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListSandboxes`: []Sandbox
	fmt.Fprintf(os.Stdout, "Response from `SandboxAPI.ListSandboxes`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListSandboxesRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 
 **verbose** | **bool** | Include verbose output | 
 **labels** | **string** | JSON encoded labels to filter by | 
 **includeErroredDeleted** | **bool** | Include errored and deleted sandboxes | 

### Return type

[**[]Sandbox**](Sandbox.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ReplaceLabels

> SandboxLabels ReplaceLabels(ctx, sandboxId).SandboxLabels(sandboxLabels).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Replace sandbox labels

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
	sandboxLabels := *openapiclient.NewSandboxLabels(map[string]string{"key": "Inner_example"}) // SandboxLabels | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SandboxAPI.ReplaceLabels(context.Background(), sandboxId).SandboxLabels(sandboxLabels).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SandboxAPI.ReplaceLabels``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ReplaceLabels`: SandboxLabels
	fmt.Fprintf(os.Stdout, "Response from `SandboxAPI.ReplaceLabels`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** | ID of the sandbox | 

### Other Parameters

Other parameters are passed through a pointer to a apiReplaceLabelsRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **sandboxLabels** | [**SandboxLabels**](SandboxLabels.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**SandboxLabels**](SandboxLabels.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## SetAutoArchiveInterval

> SetAutoArchiveInterval(ctx, sandboxId, interval).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Set sandbox auto-archive interval

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
	interval := float32(8.14) // float32 | Auto-archive interval in minutes (0 means the maximum interval will be used)
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.SandboxAPI.SetAutoArchiveInterval(context.Background(), sandboxId, interval).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SandboxAPI.SetAutoArchiveInterval``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** | ID of the sandbox | 
**interval** | **float32** | Auto-archive interval in minutes (0 means the maximum interval will be used) | 

### Other Parameters

Other parameters are passed through a pointer to a apiSetAutoArchiveIntervalRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

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


## SetAutostopInterval

> SetAutostopInterval(ctx, sandboxId, interval).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Set sandbox auto-stop interval

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
	interval := float32(8.14) // float32 | Auto-stop interval in minutes (0 to disable)
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.SandboxAPI.SetAutostopInterval(context.Background(), sandboxId, interval).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SandboxAPI.SetAutostopInterval``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** | ID of the sandbox | 
**interval** | **float32** | Auto-stop interval in minutes (0 to disable) | 

### Other Parameters

Other parameters are passed through a pointer to a apiSetAutostopIntervalRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

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


## StartSandbox

> Sandbox StartSandbox(ctx, sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Start sandbox

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
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SandboxAPI.StartSandbox(context.Background(), sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SandboxAPI.StartSandbox``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `StartSandbox`: Sandbox
	fmt.Fprintf(os.Stdout, "Response from `SandboxAPI.StartSandbox`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** | ID of the sandbox | 

### Other Parameters

Other parameters are passed through a pointer to a apiStartSandboxRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**Sandbox**](Sandbox.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## StopSandbox

> StopSandbox(ctx, sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Stop sandbox

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
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.SandboxAPI.StopSandbox(context.Background(), sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SandboxAPI.StopSandbox``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** | ID of the sandbox | 

### Other Parameters

Other parameters are passed through a pointer to a apiStopSandboxRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

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


## UpdatePublicStatus

> UpdatePublicStatus(ctx, sandboxId, isPublic).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Update public status

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
	isPublic := true // bool | Public status to set
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.SandboxAPI.UpdatePublicStatus(context.Background(), sandboxId, isPublic).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SandboxAPI.UpdatePublicStatus``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** | ID of the sandbox | 
**isPublic** | **bool** | Public status to set | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdatePublicStatusRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

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

