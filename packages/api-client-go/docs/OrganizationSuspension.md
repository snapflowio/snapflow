# OrganizationSuspension

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Reason** | **string** | Suspension reason | 
**Until** | **time.Time** | Suspension until | 

## Methods

### NewOrganizationSuspension

`func NewOrganizationSuspension(reason string, until time.Time, ) *OrganizationSuspension`

NewOrganizationSuspension instantiates a new OrganizationSuspension object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewOrganizationSuspensionWithDefaults

`func NewOrganizationSuspensionWithDefaults() *OrganizationSuspension`

NewOrganizationSuspensionWithDefaults instantiates a new OrganizationSuspension object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetReason

`func (o *OrganizationSuspension) GetReason() string`

GetReason returns the Reason field if non-nil, zero value otherwise.

### GetReasonOk

`func (o *OrganizationSuspension) GetReasonOk() (*string, bool)`

GetReasonOk returns a tuple with the Reason field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetReason

`func (o *OrganizationSuspension) SetReason(v string)`

SetReason sets Reason field to given value.


### GetUntil

`func (o *OrganizationSuspension) GetUntil() time.Time`

GetUntil returns the Until field if non-nil, zero value otherwise.

### GetUntilOk

`func (o *OrganizationSuspension) GetUntilOk() (*time.Time, bool)`

GetUntilOk returns a tuple with the Until field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUntil

`func (o *OrganizationSuspension) SetUntil(v time.Time)`

SetUntil sets Until field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


