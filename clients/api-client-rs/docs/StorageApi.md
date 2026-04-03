# \StorageApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**get_push_access**](StorageApi.md#get_push_access) | **GET** /storage/push-access | Get pre-signed URL for uploading objects to Cloudflare R2



## get_push_access

> models::StorageAccess get_push_access(x_snapflow_organization_id)
Get pre-signed URL for uploading objects to Cloudflare R2

Returns a pre-signed URL scoped to the organization's storage path. The URL expires after a short period.

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::StorageAccess**](StorageAccess.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

