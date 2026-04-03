# \ApiKeysApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_api_key**](ApiKeysApi.md#create_api_key) | **POST** /api-keys | Create API key
[**delete_api_key**](ApiKeysApi.md#delete_api_key) | **DELETE** /api-keys/{name} | Delete API key by name
[**delete_api_key_for_user**](ApiKeysApi.md#delete_api_key_for_user) | **DELETE** /api-keys/{user_id}/{name} | Delete API key for a specific user
[**get_api_key**](ApiKeysApi.md#get_api_key) | **GET** /api-keys/{name} | Get API key by name
[**get_current_api_key**](ApiKeysApi.md#get_current_api_key) | **GET** /api-keys/current | Get current API key's details
[**list_api_keys**](ApiKeysApi.md#list_api_keys) | **GET** /api-keys | List API keys



## create_api_key

> models::ApiKeyCreated create_api_key(create_api_key, x_snapflow_organization_id)
Create API key

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**create_api_key** | [**CreateApiKey**](CreateApiKey.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::ApiKeyCreated**](ApiKeyCreated.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## delete_api_key

> delete_api_key(name, x_snapflow_organization_id)
Delete API key by name

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**name** | **String** | Name of the API key | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## delete_api_key_for_user

> delete_api_key_for_user(user_id, name, x_snapflow_organization_id)
Delete API key for a specific user

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**user_id** | **uuid::Uuid** | ID of the user | [required] |
**name** | **String** | Name of the API key | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_api_key

> models::ApiKey get_api_key(name, x_snapflow_organization_id)
Get API key by name

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**name** | **String** | Name of the API key | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::ApiKey**](ApiKey.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_current_api_key

> models::ApiKey get_current_api_key(x_snapflow_organization_id)
Get current API key's details

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::ApiKey**](ApiKey.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## list_api_keys

> Vec<models::ApiKey> list_api_keys(x_snapflow_organization_id)
List API keys

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**Vec<models::ApiKey>**](ApiKey.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

