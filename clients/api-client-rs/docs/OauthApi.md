# \OauthApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**oauth_authorize**](OauthApi.md#oauth_authorize) | **POST** /oauth/authorize | 
[**oauth_exchange_token**](OauthApi.md#oauth_exchange_token) | **POST** /oauth/token | 



## oauth_authorize

> models::AuthorizeResponse oauth_authorize(authorize_request, x_snapflow_organization_id)


### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**authorize_request** | [**AuthorizeRequest**](AuthorizeRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::AuthorizeResponse**](AuthorizeResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## oauth_exchange_token

> models::TokenResponse oauth_exchange_token(token_request, x_snapflow_organization_id)


### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**token_request** | [**TokenRequest**](TokenRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::TokenResponse**](TokenResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

