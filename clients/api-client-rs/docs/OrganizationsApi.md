# \OrganizationsApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**accept_organization_invitation**](OrganizationsApi.md#accept_organization_invitation) | **POST** /organizations/invitations/{invitation_id}/accept | Accept invitation
[**cancel_organization_invitation**](OrganizationsApi.md#cancel_organization_invitation) | **POST** /organizations/{organization_id}/invitations/{invitation_id}/cancel | Cancel invitation
[**create_organization**](OrganizationsApi.md#create_organization) | **POST** /organizations | Create organization
[**create_organization_invitation**](OrganizationsApi.md#create_organization_invitation) | **POST** /organizations/{organization_id}/invitations | Create invitation
[**create_organization_role**](OrganizationsApi.md#create_organization_role) | **POST** /organizations/{organization_id}/roles | Create organization role
[**decline_organization_invitation**](OrganizationsApi.md#decline_organization_invitation) | **POST** /organizations/invitations/{invitation_id}/decline | Decline invitation
[**delete_organization**](OrganizationsApi.md#delete_organization) | **DELETE** /organizations/{organization_id} | Delete organization
[**delete_organization_member**](OrganizationsApi.md#delete_organization_member) | **DELETE** /organizations/{organization_id}/users/{user_id} | Remove member from organization
[**delete_organization_role**](OrganizationsApi.md#delete_organization_role) | **DELETE** /organizations/{organization_id}/roles/{role_id} | Delete organization role
[**get_organization**](OrganizationsApi.md#get_organization) | **GET** /organizations/{organization_id} | Get organization
[**get_organization_invitations_count_for_authenticated_user**](OrganizationsApi.md#get_organization_invitations_count_for_authenticated_user) | **GET** /organizations/invitations/count | Get invitation count
[**get_organization_usage_overview**](OrganizationsApi.md#get_organization_usage_overview) | **GET** /organizations/{organization_id}/usage | Get usage overview
[**leave_organization**](OrganizationsApi.md#leave_organization) | **POST** /organizations/{organization_id}/leave | Leave organization
[**list_organization_invitations**](OrganizationsApi.md#list_organization_invitations) | **GET** /organizations/{organization_id}/invitations | List pending invitations
[**list_organization_invitations_for_authenticated_user**](OrganizationsApi.md#list_organization_invitations_for_authenticated_user) | **GET** /organizations/invitations | List invitations for authenticated user
[**list_organization_members**](OrganizationsApi.md#list_organization_members) | **GET** /organizations/{organization_id}/users | List organization members
[**list_organization_roles**](OrganizationsApi.md#list_organization_roles) | **GET** /organizations/{organization_id}/roles | List organization roles
[**list_organizations**](OrganizationsApi.md#list_organizations) | **GET** /organizations | List organizations
[**suspend_organization**](OrganizationsApi.md#suspend_organization) | **POST** /organizations/{organization_id}/suspend | Suspend organization
[**unsuspend_organization**](OrganizationsApi.md#unsuspend_organization) | **POST** /organizations/{organization_id}/unsuspend | Unsuspend organization
[**update_assigned_organization_roles**](OrganizationsApi.md#update_assigned_organization_roles) | **POST** /organizations/{organization_id}/users/{user_id}/assigned-roles | Update assigned roles
[**update_organization_invitation**](OrganizationsApi.md#update_organization_invitation) | **PUT** /organizations/{organization_id}/invitations/{invitation_id} | Update invitation
[**update_organization_quota**](OrganizationsApi.md#update_organization_quota) | **PATCH** /organizations/{organization_id}/quota | Update organization quota
[**update_organization_role**](OrganizationsApi.md#update_organization_role) | **PUT** /organizations/{organization_id}/roles/{role_id} | Update organization role
[**update_role_for_organization_member**](OrganizationsApi.md#update_role_for_organization_member) | **POST** /organizations/{organization_id}/users/{user_id}/role | Update member role



## accept_organization_invitation

> models::Message accept_organization_invitation(invitation_id, x_snapflow_organization_id)
Accept invitation

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**invitation_id** | **uuid::Uuid** | ID of the invitation | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::Message**](Message.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## cancel_organization_invitation

> cancel_organization_invitation(organization_id, invitation_id)
Cancel invitation

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**organization_id** | **uuid::Uuid** | ID of the organization | [required] |
**invitation_id** | **uuid::Uuid** | ID of the invitation | [required] |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## create_organization

> models::Organization create_organization(create_organization, x_snapflow_organization_id)
Create organization

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**create_organization** | [**CreateOrganization**](CreateOrganization.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::Organization**](Organization.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## create_organization_invitation

> models::OrganizationInvitation create_organization_invitation(organization_id, create_invitation)
Create invitation

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**organization_id** | **uuid::Uuid** | ID of the organization | [required] |
**create_invitation** | [**CreateInvitation**](CreateInvitation.md) |  | [required] |

### Return type

[**models::OrganizationInvitation**](OrganizationInvitation.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## create_organization_role

> models::OrganizationRole create_organization_role(organization_id, create_organization_role)
Create organization role

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**organization_id** | **uuid::Uuid** | ID of the organization | [required] |
**create_organization_role** | [**CreateOrganizationRole**](CreateOrganizationRole.md) |  | [required] |

### Return type

[**models::OrganizationRole**](OrganizationRole.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## decline_organization_invitation

> models::Message decline_organization_invitation(invitation_id, x_snapflow_organization_id)
Decline invitation

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**invitation_id** | **uuid::Uuid** | ID of the invitation | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::Message**](Message.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## delete_organization

> delete_organization(organization_id)
Delete organization

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**organization_id** | **uuid::Uuid** | ID of the organization | [required] |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## delete_organization_member

> delete_organization_member(organization_id, user_id)
Remove member from organization

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**organization_id** | **uuid::Uuid** | ID of the organization | [required] |
**user_id** | **uuid::Uuid** | ID of the user | [required] |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## delete_organization_role

> delete_organization_role(organization_id, role_id)
Delete organization role

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**organization_id** | **uuid::Uuid** | ID of the organization | [required] |
**role_id** | **uuid::Uuid** | ID of the role | [required] |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_organization

> models::Organization get_organization(organization_id)
Get organization

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**organization_id** | **uuid::Uuid** | ID of the organization | [required] |

### Return type

[**models::Organization**](Organization.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_organization_invitations_count_for_authenticated_user

> i64 get_organization_invitations_count_for_authenticated_user(x_snapflow_organization_id)
Get invitation count

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

**i64**

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/plain

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_organization_usage_overview

> models::UsageOverview get_organization_usage_overview(organization_id)
Get usage overview

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**organization_id** | **uuid::Uuid** | ID of the organization | [required] |

### Return type

[**models::UsageOverview**](UsageOverview.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## leave_organization

> leave_organization(organization_id)
Leave organization

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**organization_id** | **uuid::Uuid** | ID of the organization | [required] |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## list_organization_invitations

> Vec<models::OrganizationInvitation> list_organization_invitations(organization_id)
List pending invitations

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**organization_id** | **uuid::Uuid** | ID of the organization | [required] |

### Return type

[**Vec<models::OrganizationInvitation>**](OrganizationInvitation.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## list_organization_invitations_for_authenticated_user

> Vec<models::OrganizationInvitation> list_organization_invitations_for_authenticated_user(x_snapflow_organization_id)
List invitations for authenticated user

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**Vec<models::OrganizationInvitation>**](OrganizationInvitation.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## list_organization_members

> Vec<models::OrganizationUser> list_organization_members(organization_id)
List organization members

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**organization_id** | **uuid::Uuid** | ID of the organization | [required] |

### Return type

[**Vec<models::OrganizationUser>**](OrganizationUser.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## list_organization_roles

> Vec<models::OrganizationRole> list_organization_roles(organization_id)
List organization roles

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**organization_id** | **uuid::Uuid** | ID of the organization | [required] |

### Return type

[**Vec<models::OrganizationRole>**](OrganizationRole.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## list_organizations

> Vec<models::Organization> list_organizations(x_snapflow_organization_id)
List organizations

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**Vec<models::Organization>**](Organization.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## suspend_organization

> suspend_organization(organization_id, suspend)
Suspend organization

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**organization_id** | **uuid::Uuid** | ID of the organization | [required] |
**suspend** | [**Suspend**](Suspend.md) |  | [required] |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## unsuspend_organization

> models::Organization unsuspend_organization(organization_id)
Unsuspend organization

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**organization_id** | **uuid::Uuid** | ID of the organization | [required] |

### Return type

[**models::Organization**](Organization.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## update_assigned_organization_roles

> models::Message update_assigned_organization_roles(organization_id, user_id, update_assigned_roles)
Update assigned roles

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**organization_id** | **uuid::Uuid** | ID of the organization | [required] |
**user_id** | **uuid::Uuid** | ID of the user | [required] |
**update_assigned_roles** | [**UpdateAssignedRoles**](UpdateAssignedRoles.md) |  | [required] |

### Return type

[**models::Message**](Message.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## update_organization_invitation

> models::OrganizationInvitation update_organization_invitation(organization_id, invitation_id, update_invitation)
Update invitation

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**organization_id** | **uuid::Uuid** | ID of the organization | [required] |
**invitation_id** | **uuid::Uuid** | ID of the invitation | [required] |
**update_invitation** | [**UpdateInvitation**](UpdateInvitation.md) |  | [required] |

### Return type

[**models::OrganizationInvitation**](OrganizationInvitation.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## update_organization_quota

> models::Organization update_organization_quota(organization_id, update_quota)
Update organization quota

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**organization_id** | **uuid::Uuid** | ID of the organization | [required] |
**update_quota** | [**UpdateQuota**](UpdateQuota.md) |  | [required] |

### Return type

[**models::Organization**](Organization.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## update_organization_role

> models::OrganizationRole update_organization_role(organization_id, role_id, update_organization_role)
Update organization role

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**organization_id** | **uuid::Uuid** | ID of the organization | [required] |
**role_id** | **uuid::Uuid** | ID of the role | [required] |
**update_organization_role** | [**UpdateOrganizationRole**](UpdateOrganizationRole.md) |  | [required] |

### Return type

[**models::OrganizationRole**](OrganizationRole.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## update_role_for_organization_member

> models::OrganizationUser update_role_for_organization_member(organization_id, user_id, update_member_role)
Update member role

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**organization_id** | **uuid::Uuid** | ID of the organization | [required] |
**user_id** | **uuid::Uuid** | ID of the user | [required] |
**update_member_role** | [**UpdateMemberRole**](UpdateMemberRole.md) |  | [required] |

### Return type

[**models::OrganizationUser**](OrganizationUser.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

