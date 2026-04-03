# \AuthApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**change_password**](AuthApi.md#change_password) | **POST** /auth/change-password | Change password
[**forgot_password**](AuthApi.md#forgot_password) | **POST** /auth/forgot-password | Request password reset
[**get_jwks**](AuthApi.md#get_jwks) | **GET** /.well-known/jwks.json | Get JSON Web Key Set
[**get_session**](AuthApi.md#get_session) | **GET** /auth/session | Get current session
[**refresh_token**](AuthApi.md#refresh_token) | **POST** /auth/refresh | Refresh access token
[**reset_password**](AuthApi.md#reset_password) | **POST** /auth/reset-password | Reset password
[**send_verification_email**](AuthApi.md#send_verification_email) | **POST** /auth/send-verification-email | Resend verification email
[**sign_in**](AuthApi.md#sign_in) | **POST** /auth/sign-in | Sign in
[**sign_out**](AuthApi.md#sign_out) | **POST** /auth/sign-out | Sign out
[**sign_up**](AuthApi.md#sign_up) | **POST** /auth/sign-up | Sign up
[**update_user**](AuthApi.md#update_user) | **POST** /auth/update-user | Update user profile
[**verify_email**](AuthApi.md#verify_email) | **GET** /auth/verify-email | Verify email address



## change_password

> models::ChangePasswordResponse change_password(change_password)
Change password

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**change_password** | [**ChangePassword**](ChangePassword.md) |  | [required] |

### Return type

[**models::ChangePasswordResponse**](ChangePasswordResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## forgot_password

> models::Message forgot_password(forgot_password)
Request password reset

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**forgot_password** | [**ForgotPassword**](ForgotPassword.md) |  | [required] |

### Return type

[**models::Message**](Message.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_jwks

> get_jwks(x_snapflow_organization_id)
Get JSON Web Key Set

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_session

> models::User get_session()
Get current session

### Parameters

This endpoint does not need any parameter.

### Return type

[**models::User**](User.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## refresh_token

> models::Auth refresh_token(refresh_token)
Refresh access token

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**refresh_token** | [**RefreshToken**](RefreshToken.md) |  | [required] |

### Return type

[**models::Auth**](Auth.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## reset_password

> models::Message reset_password(reset_password)
Reset password

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**reset_password** | [**ResetPassword**](ResetPassword.md) |  | [required] |

### Return type

[**models::Message**](Message.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## send_verification_email

> models::Message send_verification_email(send_verification_email)
Resend verification email

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**send_verification_email** | [**SendVerificationEmail**](SendVerificationEmail.md) |  | [required] |

### Return type

[**models::Message**](Message.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## sign_in

> models::Auth sign_in(sign_in)
Sign in

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sign_in** | [**SignIn**](SignIn.md) |  | [required] |

### Return type

[**models::Auth**](Auth.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## sign_out

> models::Message sign_out()
Sign out

### Parameters

This endpoint does not need any parameter.

### Return type

[**models::Message**](Message.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## sign_up

> models::Auth sign_up(sign_up)
Sign up

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sign_up** | [**SignUp**](SignUp.md) |  | [required] |

### Return type

[**models::Auth**](Auth.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## update_user

> models::User update_user(update_user)
Update user profile

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**update_user** | [**UpdateUser**](UpdateUser.md) |  | [required] |

### Return type

[**models::User**](User.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## verify_email

> verify_email(token, identifier)
Verify email address

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**token** | **String** | Verification token | [required] |
**identifier** | **String** | Email address | [required] |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

