## Introduction

**pxlAPI** is an HTTP image processing/manipulation API that also provides other miscellaneous services (e.g. web
scraping).

### Sending requests

All requests to **pxlAPI** should go to the APIs base URL (`https://api.pxlapi.dev/`), followed by the path of the
action you want to execute (for example `https://api.pxlapi.dev/emojimosaic`). All available actions are documented on
this page.

Most requests require an application access token to be supplied. This can be done by setting the `Authorization` HTTP
header to a value of `Application <token>`. Your Applications access tokens are available via
the [management panel](https://pxlapi.dev).

All JSON requests should include a `Content-Type` header with a value of `application/json`. If this header is not
supplied, the API will interpret the input as a binary buffer. The `Content-Type` header can be omitted when
directly `POST`ing image data to the API, image type auto-detection will be run here.

Controller parameters can also be retrieved from the requests query parameters (`?parameter=value`). This is useful if
you want to directly `POST` an image to the API. The JSON request body, if supplied, will always take priority.

### Credits

Users get 10,000 free credits per month. This is equivalent to 100 seconds of processing time, assuming no special
features (like face detection) are used. For users who require more credits, paid credit packages are available via the
management dashboard. When a user gets close to running out of credits, emails will be sent stating the estimated time
remaining until credits run out. When no more credits are available, the API will respond with a `402 Payment Required`.

Please note that GIF processing can yield a large amount of processing time (and calls to face detection), so you might
want to either limit the count of frames to process (via the `frameLimit` request parameter), or instead only process a
single frame of the GIF (either by directly supplying a still image (JPEG or PNG), or by setting `frameLimit` to 1).

The maximum size of processed images can be set via the `maxSize` parameter (accepts values between `64` and `1024`).
Incoming and outgoing images will be resized to be contained in a bounding box of `maxSize` pixels.

### Quota

Quota limits the amount of credits users and applications can spend per day. There are no quota limit set by default,
but custom limits can be set either via the edit account tab or the applications settings in the management portal. This
can be useful if you don't want a single application to use up all your credits, or you want to limit how many credits
you want to spend per day. When an application exceeds the set quota limits, the API will respond with
a `429 Too Many Requests`

### Supported Media Types

Currently, the following media types are supported for decoding:

- `PNG`
- `JPEG`
- `TIFF`
- `GIF`

### Special Cases in this Documentation

- A field type being suffixed by a question mark (`?`) means that this field is optional. A default value, if
  applicable, will be shown in `Allowed Values`. If no default value is applicable, an explanation of the default value
  may appear in the fields description.
- Numeric and string length ranges are defined via the use of `min..max` in `Allowed Values`. If no maximum value is
  given, it is assumed to be Infinity. If no minimum value is given, it is assumed to be negative Infinity (or 0 in the
  case of string lengths).
