# \BucketsAPI

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateBucket**](BucketsAPI.md#CreateBucket) | **Post** /buckets | Create a new bucket
[**DeleteBucket**](BucketsAPI.md#DeleteBucket) | **Delete** /buckets/{bucketId} | Delete bucket
[**GetBucket**](BucketsAPI.md#GetBucket) | **Get** /buckets/{bucketId} | Get bucket details
[**GetBucketByName**](BucketsAPI.md#GetBucketByName) | **Get** /buckets/by-name/{name} | Get bucket details by name
[**ListBuckets**](BucketsAPI.md#ListBuckets) | **Get** /buckets | List all buckets



## CreateBucket

> BucketDto CreateBucket(ctx).CreateBucket(createBucket).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Create a new bucket

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
	createBucket := *openapiclient.NewCreateBucket("Name_example") // CreateBucket | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.BucketsAPI.CreateBucket(context.Background()).CreateBucket(createBucket).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `BucketsAPI.CreateBucket``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateBucket`: BucketDto
	fmt.Fprintf(os.Stdout, "Response from `BucketsAPI.CreateBucket`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateBucketRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **createBucket** | [**CreateBucket**](CreateBucket.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**BucketDto**](BucketDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DeleteBucket

> DeleteBucket(ctx, bucketId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Delete bucket

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
	bucketId := "bucketId_example" // string | ID of the bucket
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.BucketsAPI.DeleteBucket(context.Background(), bucketId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `BucketsAPI.DeleteBucket``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**bucketId** | **string** | ID of the bucket | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteBucketRequest struct via the builder pattern


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


## GetBucket

> BucketDto GetBucket(ctx, bucketId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Get bucket details

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
	bucketId := "bucketId_example" // string | ID of the bucket
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.BucketsAPI.GetBucket(context.Background(), bucketId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `BucketsAPI.GetBucket``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetBucket`: BucketDto
	fmt.Fprintf(os.Stdout, "Response from `BucketsAPI.GetBucket`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**bucketId** | **string** | ID of the bucket | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetBucketRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**BucketDto**](BucketDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetBucketByName

> BucketDto GetBucketByName(ctx, name).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Get bucket details by name

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
	name := "name_example" // string | Name of the bucket
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.BucketsAPI.GetBucketByName(context.Background(), name).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `BucketsAPI.GetBucketByName``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetBucketByName`: BucketDto
	fmt.Fprintf(os.Stdout, "Response from `BucketsAPI.GetBucketByName`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**name** | **string** | Name of the bucket | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetBucketByNameRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**BucketDto**](BucketDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListBuckets

> []BucketDto ListBuckets(ctx).XSnapflowOrganizationID(xSnapflowOrganizationID).IncludeDeleted(includeDeleted).Execute()

List all buckets

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
	includeDeleted := true // bool | Include deleted buckets in the response (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.BucketsAPI.ListBuckets(context.Background()).XSnapflowOrganizationID(xSnapflowOrganizationID).IncludeDeleted(includeDeleted).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `BucketsAPI.ListBuckets``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListBuckets`: []BucketDto
	fmt.Fprintf(os.Stdout, "Response from `BucketsAPI.ListBuckets`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListBucketsRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 
 **includeDeleted** | **bool** | Include deleted buckets in the response | 

### Return type

[**[]BucketDto**](BucketDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

