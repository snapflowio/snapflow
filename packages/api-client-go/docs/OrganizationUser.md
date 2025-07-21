# OrganizationUser

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**UserId** | **string** | User ID | 
**OrganizationId** | **string** | Organization ID | 
**Name** | **string** | User name | 
**Email** | **string** | User email | 
**Role** | **string** | Member role | 
**AssignedRoles** | [**[]OrganizationRole**](OrganizationRole.md) | Roles assigned to the user | 
**CreatedAt** | **time.Time** | Creation timestamp | 
**UpdatedAt** | **time.Time** | Last update timestamp | 

## Methods

### NewOrganizationUser

`func NewOrganizationUser(userId string, organizationId string, name string, email string, role string, assignedRoles []OrganizationRole, createdAt time.Time, updatedAt time.Time, ) *OrganizationUser`

NewOrganizationUser instantiates a new OrganizationUser object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewOrganizationUserWithDefaults

`func NewOrganizationUserWithDefaults() *OrganizationUser`

NewOrganizationUserWithDefaults instantiates a new OrganizationUser object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetUserId

`func (o *OrganizationUser) GetUserId() string`

GetUserId returns the UserId field if non-nil, zero value otherwise.

### GetUserIdOk

`func (o *OrganizationUser) GetUserIdOk() (*string, bool)`

GetUserIdOk returns a tuple with the UserId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUserId

`func (o *OrganizationUser) SetUserId(v string)`

SetUserId sets UserId field to given value.


### GetOrganizationId

`func (o *OrganizationUser) GetOrganizationId() string`

GetOrganizationId returns the OrganizationId field if non-nil, zero value otherwise.

### GetOrganizationIdOk

`func (o *OrganizationUser) GetOrganizationIdOk() (*string, bool)`

GetOrganizationIdOk returns a tuple with the OrganizationId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOrganizationId

`func (o *OrganizationUser) SetOrganizationId(v string)`

SetOrganizationId sets OrganizationId field to given value.


### GetName

`func (o *OrganizationUser) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *OrganizationUser) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *OrganizationUser) SetName(v string)`

SetName sets Name field to given value.


### GetEmail

`func (o *OrganizationUser) GetEmail() string`

GetEmail returns the Email field if non-nil, zero value otherwise.

### GetEmailOk

`func (o *OrganizationUser) GetEmailOk() (*string, bool)`

GetEmailOk returns a tuple with the Email field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEmail

`func (o *OrganizationUser) SetEmail(v string)`

SetEmail sets Email field to given value.


### GetRole

`func (o *OrganizationUser) GetRole() string`

GetRole returns the Role field if non-nil, zero value otherwise.

### GetRoleOk

`func (o *OrganizationUser) GetRoleOk() (*string, bool)`

GetRoleOk returns a tuple with the Role field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRole

`func (o *OrganizationUser) SetRole(v string)`

SetRole sets Role field to given value.


### GetAssignedRoles

`func (o *OrganizationUser) GetAssignedRoles() []OrganizationRole`

GetAssignedRoles returns the AssignedRoles field if non-nil, zero value otherwise.

### GetAssignedRolesOk

`func (o *OrganizationUser) GetAssignedRolesOk() (*[]OrganizationRole, bool)`

GetAssignedRolesOk returns a tuple with the AssignedRoles field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAssignedRoles

`func (o *OrganizationUser) SetAssignedRoles(v []OrganizationRole)`

SetAssignedRoles sets AssignedRoles field to given value.


### GetCreatedAt

`func (o *OrganizationUser) GetCreatedAt() time.Time`

GetCreatedAt returns the CreatedAt field if non-nil, zero value otherwise.

### GetCreatedAtOk

`func (o *OrganizationUser) GetCreatedAtOk() (*time.Time, bool)`

GetCreatedAtOk returns a tuple with the CreatedAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCreatedAt

`func (o *OrganizationUser) SetCreatedAt(v time.Time)`

SetCreatedAt sets CreatedAt field to given value.


### GetUpdatedAt

`func (o *OrganizationUser) GetUpdatedAt() time.Time`

GetUpdatedAt returns the UpdatedAt field if non-nil, zero value otherwise.

### GetUpdatedAtOk

`func (o *OrganizationUser) GetUpdatedAtOk() (*time.Time, bool)`

GetUpdatedAtOk returns a tuple with the UpdatedAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUpdatedAt

`func (o *OrganizationUser) SetUpdatedAt(v time.Time)`

SetUpdatedAt sets UpdatedAt field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


