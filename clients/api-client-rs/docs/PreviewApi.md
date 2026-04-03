# \PreviewApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**has_sandbox_access**](PreviewApi.md#has_sandbox_access) | **GET** /preview/{sandboxId}/access | 
[**is_sandbox_public**](PreviewApi.md#is_sandbox_public) | **GET** /preview/{sandboxId}/public | 
[**is_valid_auth_token**](PreviewApi.md#is_valid_auth_token) | **GET** /preview/{sandboxId}/validate/{authToken} | 



## has_sandbox_access

> has_sandbox_access(sandbox_id)


### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **uuid::Uuid** | ID of the sandbox | [required] |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## is_sandbox_public

> bool is_sandbox_public(sandbox_id)


### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **uuid::Uuid** | ID of the sandbox | [required] |

### Return type

**bool**

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/plain

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## is_valid_auth_token

> bool is_valid_auth_token(sandbox_id, auth_token)


### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **uuid::Uuid** | ID of the sandbox | [required] |
**auth_token** | **String** | Auth token to validate | [required] |

### Return type

**bool**

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/plain

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

