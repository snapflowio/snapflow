# PaginatedImagesDto

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Items** | [**[]ImageDto**](ImageDto.md) |  | 
**Total** | **float32** |  | 
**Page** | **float32** |  | 
**TotalPages** | **float32** |  | 

## Methods

### NewPaginatedImagesDto

`func NewPaginatedImagesDto(items []ImageDto, total float32, page float32, totalPages float32, ) *PaginatedImagesDto`

NewPaginatedImagesDto instantiates a new PaginatedImagesDto object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewPaginatedImagesDtoWithDefaults

`func NewPaginatedImagesDtoWithDefaults() *PaginatedImagesDto`

NewPaginatedImagesDtoWithDefaults instantiates a new PaginatedImagesDto object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetItems

`func (o *PaginatedImagesDto) GetItems() []ImageDto`

GetItems returns the Items field if non-nil, zero value otherwise.

### GetItemsOk

`func (o *PaginatedImagesDto) GetItemsOk() (*[]ImageDto, bool)`

GetItemsOk returns a tuple with the Items field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetItems

`func (o *PaginatedImagesDto) SetItems(v []ImageDto)`

SetItems sets Items field to given value.


### GetTotal

`func (o *PaginatedImagesDto) GetTotal() float32`

GetTotal returns the Total field if non-nil, zero value otherwise.

### GetTotalOk

`func (o *PaginatedImagesDto) GetTotalOk() (*float32, bool)`

GetTotalOk returns a tuple with the Total field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTotal

`func (o *PaginatedImagesDto) SetTotal(v float32)`

SetTotal sets Total field to given value.


### GetPage

`func (o *PaginatedImagesDto) GetPage() float32`

GetPage returns the Page field if non-nil, zero value otherwise.

### GetPageOk

`func (o *PaginatedImagesDto) GetPageOk() (*float32, bool)`

GetPageOk returns a tuple with the Page field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPage

`func (o *PaginatedImagesDto) SetPage(v float32)`

SetPage sets Page field to given value.


### GetTotalPages

`func (o *PaginatedImagesDto) GetTotalPages() float32`

GetTotalPages returns the TotalPages field if non-nil, zero value otherwise.

### GetTotalPagesOk

`func (o *PaginatedImagesDto) GetTotalPagesOk() (*float32, bool)`

GetTotalPagesOk returns a tuple with the TotalPages field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTotalPages

`func (o *PaginatedImagesDto) SetTotalPages(v float32)`

SetTotalPages sets TotalPages field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


