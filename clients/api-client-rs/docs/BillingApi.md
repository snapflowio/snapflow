# \BillingApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**get_wallet_overview**](BillingApi.md#get_wallet_overview) | **GET** /organizations/{organization_id}/wallet | Get wallet overview
[**list_wallet_transactions**](BillingApi.md#list_wallet_transactions) | **GET** /organizations/{organization_id}/wallet/transactions | List wallet transactions



## get_wallet_overview

> models::WalletOverview get_wallet_overview(organization_id)
Get wallet overview

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**organization_id** | **uuid::Uuid** | ID of the organization | [required] |

### Return type

[**models::WalletOverview**](WalletOverview.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## list_wallet_transactions

> Vec<models::WalletTransaction> list_wallet_transactions(organization_id)
List wallet transactions

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**organization_id** | **uuid::Uuid** | ID of the organization | [required] |

### Return type

[**Vec<models::WalletTransaction>**](WalletTransaction.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

