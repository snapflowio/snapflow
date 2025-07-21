# CreateOrganizationInvitation

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Email** | **string** | Email address of the inviting user | 
**Role** | **string** | Organization role of the inviting user | [default to "member"]
**AssignedRoleIds** | **[]string** | Role IDs of the inviting user | [default to ["00000000-0000-0000-0000-000000000001"]]
**ExpiresAt** | Pointer to **time.Time** | Expiration date of the invitation | [optional] 

## Methods

### NewCreateOrganizationInvitation

`func NewCreateOrganizationInvitation(email string, role string, assignedRoleIds []string, ) *CreateOrganizationInvitation`

NewCreateOrganizationInvitation instantiates a new CreateOrganizationInvitation object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCreateOrganizationInvitationWithDefaults

`func NewCreateOrganizationInvitationWithDefaults() *CreateOrganizationInvitation`

NewCreateOrganizationInvitationWithDefaults instantiates a new CreateOrganizationInvitation object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetEmail

`func (o *CreateOrganizationInvitation) GetEmail() string`

GetEmail returns the Email field if non-nil, zero value otherwise.

### GetEmailOk

`func (o *CreateOrganizationInvitation) GetEmailOk() (*string, bool)`

GetEmailOk returns a tuple with the Email field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEmail

`func (o *CreateOrganizationInvitation) SetEmail(v string)`

SetEmail sets Email field to given value.


### GetRole

`func (o *CreateOrganizationInvitation) GetRole() string`

GetRole returns the Role field if non-nil, zero value otherwise.

### GetRoleOk

`func (o *CreateOrganizationInvitation) GetRoleOk() (*string, bool)`

GetRoleOk returns a tuple with the Role field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRole

`func (o *CreateOrganizationInvitation) SetRole(v string)`

SetRole sets Role field to given value.


### GetAssignedRoleIds

`func (o *CreateOrganizationInvitation) GetAssignedRoleIds() []string`

GetAssignedRoleIds returns the AssignedRoleIds field if non-nil, zero value otherwise.

### GetAssignedRoleIdsOk

`func (o *CreateOrganizationInvitation) GetAssignedRoleIdsOk() (*[]string, bool)`

GetAssignedRoleIdsOk returns a tuple with the AssignedRoleIds field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAssignedRoleIds

`func (o *CreateOrganizationInvitation) SetAssignedRoleIds(v []string)`

SetAssignedRoleIds sets AssignedRoleIds field to given value.


### GetExpiresAt

`func (o *CreateOrganizationInvitation) GetExpiresAt() time.Time`

GetExpiresAt returns the ExpiresAt field if non-nil, zero value otherwise.

### GetExpiresAtOk

`func (o *CreateOrganizationInvitation) GetExpiresAtOk() (*time.Time, bool)`

GetExpiresAtOk returns a tuple with the ExpiresAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetExpiresAt

`func (o *CreateOrganizationInvitation) SetExpiresAt(v time.Time)`

SetExpiresAt sets ExpiresAt field to given value.

### HasExpiresAt

`func (o *CreateOrganizationInvitation) HasExpiresAt() bool`

HasExpiresAt returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


