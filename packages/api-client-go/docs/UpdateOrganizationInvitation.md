# UpdateOrganizationInvitation

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Role** | **string** | Organization member role | 
**AssignedRoleIds** | **[]string** | Array of role IDs | 
**ExpiresAt** | Pointer to **time.Time** | Expiration date of the invitation | [optional] 

## Methods

### NewUpdateOrganizationInvitation

`func NewUpdateOrganizationInvitation(role string, assignedRoleIds []string, ) *UpdateOrganizationInvitation`

NewUpdateOrganizationInvitation instantiates a new UpdateOrganizationInvitation object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewUpdateOrganizationInvitationWithDefaults

`func NewUpdateOrganizationInvitationWithDefaults() *UpdateOrganizationInvitation`

NewUpdateOrganizationInvitationWithDefaults instantiates a new UpdateOrganizationInvitation object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetRole

`func (o *UpdateOrganizationInvitation) GetRole() string`

GetRole returns the Role field if non-nil, zero value otherwise.

### GetRoleOk

`func (o *UpdateOrganizationInvitation) GetRoleOk() (*string, bool)`

GetRoleOk returns a tuple with the Role field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRole

`func (o *UpdateOrganizationInvitation) SetRole(v string)`

SetRole sets Role field to given value.


### GetAssignedRoleIds

`func (o *UpdateOrganizationInvitation) GetAssignedRoleIds() []string`

GetAssignedRoleIds returns the AssignedRoleIds field if non-nil, zero value otherwise.

### GetAssignedRoleIdsOk

`func (o *UpdateOrganizationInvitation) GetAssignedRoleIdsOk() (*[]string, bool)`

GetAssignedRoleIdsOk returns a tuple with the AssignedRoleIds field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAssignedRoleIds

`func (o *UpdateOrganizationInvitation) SetAssignedRoleIds(v []string)`

SetAssignedRoleIds sets AssignedRoleIds field to given value.


### GetExpiresAt

`func (o *UpdateOrganizationInvitation) GetExpiresAt() time.Time`

GetExpiresAt returns the ExpiresAt field if non-nil, zero value otherwise.

### GetExpiresAtOk

`func (o *UpdateOrganizationInvitation) GetExpiresAtOk() (*time.Time, bool)`

GetExpiresAtOk returns a tuple with the ExpiresAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetExpiresAt

`func (o *UpdateOrganizationInvitation) SetExpiresAt(v time.Time)`

SetExpiresAt sets ExpiresAt field to given value.

### HasExpiresAt

`func (o *UpdateOrganizationInvitation) HasExpiresAt() bool`

HasExpiresAt returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


