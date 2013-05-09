# node-hubble

[![Build Status](https://travis-ci.org/mozilla/node-hubble.png?branch=master)](https://travis-ci.org/mozilla/node-hubble)

This is an node.js, Express-based REST API for discovering information about resources at the other end of URLs.

## Installation
```
$ npm install
```

## Configuration

The server is configured by setting environment variables. These settings include:

- `PORT` - The Port number to use for the server. Defaults to `8888`.
- `REDIS_URL`, `REDISCLOUD_URL`, or `REDISTOGO_URL` - The URL of the Redis server used for caching. Defaults to none.
- `MEMCACHED_URL` - The URL of the Memcached server used for caching. Defaults to none.
- `CACHE_EXPIRE` - The number of seconds to cache responses. Defaults to `3600` seconds (i.e., 1 hour).

## How to use
```
$ node server.js
```

## API

There are a number of things you can lookup based on a URL. The server provides the following end-points:

* `mime` - find the content-type and actual URL (i.e., follow redirects) for a given URL
* `meta` - like `mime`, but also extract Open Graph, Twitter Card, and other social metadata from the resource
* `img` - find the type (i.e., content-type), actual URL (i.e., follow redirects) and size (i.e., width, height) of an image for a given URL

### /mime/<url>

The server expects a URL in the following form:

    http://localhost:<PORT>/mime/<ur>l

The server takes the URL and attempts to do two things. First, it gets the actual URL in the case that a URL shortener has been used, or other redirects. Second, it requests the HTTP headers for this resource, and determins the `content-type` that is being used. Both pieces of information are returned as JSON.

Assuming a server running on `http://localhost:8888`, the following are valid API calls:

#### Example 1: simple url
```
http://localhost:8888/mime/http://google.com

{
  "href": "http://www.google.ca/",
  "contentType": "text/html; charset=ISO-8859-1"
}
```

#### Example 2: shortened url
```
http://localhost:8888/mime/http://bit.ly/900913

{
  "href": "http://www.google.ca/",
  "contentType": "text/html; charset=ISO-8859-1"
}
```

#### Example 3: image resource
```
http://localhost:8888/mime/http://i.imgur.com/syPS3rG.jpg

{
  "href": "http://i.imgur.com/syPS3rG.jpg",
  "contentType": "image/jpeg"
}
```

#### Example 4: video resource
```
http://localhost:8888/mime/http://archive.org/download/PET1018_R-2_LA/PET1018_R-2_LA.mp4

{
  "href": "http://ia700805.us.archive.org/2/items/PET1018_R-2_LA/PET1018_R-2_LA.mp4",
  "contentType": "video/mp4"
}
```

### /meta/<url>

The server expects a URL in the following form:

    http://localhost:<PORT>/meta/<url>

The server attempts to download the document at `<url>`. If it is not HTML, an error will occur. If it is HTML, the document's Open Graph, Twitter Card, Dublin Core, and other metadata will be extracted and returned as JSON. In the case that there is no data that can be extracted, the following will be returned:

```javascript
{
  "href": "http://example.com/some-url.html",
  "contentType": "text/html"
}
```

Often a document at least has a `title`, and if it does, this will be added:

```javascript
{
  "href": "http://example.com/some-url.html",
  "contentType": "text/html",
  "title": "The Document's title"
}
```

Then, depending on the presense of various namespaced metadata properites (i.e., `og:*`, `twitter:*`, `dc.*`, and `dcterms.*`), objects will be added for any known namespaces found, with all of the namespaced properites as children. If a namespace is not found, it will not appear in the result (i.e., you can do checks like `if ( result.og )...`). For example, if only `og:*` metadata is found, only the `og` object will be available:

```javascript
{
  "href": "http://example.com/some-url.html",
  "contentType": "text/html",
  "og": {
    "og:title": "Open Graph title found for this page",
    ...
  }
  "title": "The Document's title"
}
```

#### Example 1: page with no social graph data
```
http://localhost:8888/meta/http://google.com

{
  "href": "http://www.google.ca/",
  "contentType": "text/html; charset=ISO-8859-1",
  "meta": {
    "title": "Google"
  }
}
```

#### Example 2: page with no social graph data, but with title and description
```
http://localhost:8888/meta/http://twitter.com

{
  "href": "https://twitter.com/",
  "contentType": "text/html; charset=utf-8",
  "meta": {
    "description": "Instantly connect to what&#39;s most important to you. Follow your friends, experts, favorite celebrities, and breaking news.",
    "title": "Twitter"
  }
}
```

#### Example 3: page with Open Graph data
```
http://localhost:8888/meta/http://ogp.me/

{
  "href": "http://ogp.me/",
  "contentType": "text/html",
  "meta": {
    "og": {
      "og:title": "Open Graph protocol",
      "og:type": "website",
      "og:url": "http://ogp.me/",
      "og:image": "http://ogp.me/logo.png",
      "og:image:type": "image/png",
      "og:image:width": "300",
      "og:image:height": "300",
      "og:description": "The Open Graph protocol enables any web page to become a rich object in a social graph."
    },
    "title": "The Open Graph protocol"
  }
}
```

#### Example 4: page with Open Graph and Twitter Card data
```
http://localhost:8888/meta/https://developer.mozilla.org/en-US/docs/HTML/WebVTT

{
  "href": "https://developer.mozilla.org/en-US/docs/HTML/WebVTT",
  "contentType": "text/html; charset=utf-8",
  "meta": {
    "og": {
      "og:title": "WebVTT",
      "og:type": "website",
      "og:image": "https://developer.mozilla.org/media/img/mdn-logo-sm.png",
      "og:site_name": "Mozilla Developer Network",
      "og:url": "https://developer.mozilla.org/en-US/docs/HTML/WebVTT",
      "og:description": "WebVTT is a format for displaying timed text tracks (e.g. subtitles) with the track element. The primary purpose of WebVTT files is to add subtitles to a video."
    },
    "twitter": {
      "twitter:card": "summary",
      "twitter:url": "https://developer.mozilla.org/en-US/docs/HTML/WebVTT",
      "twitter:title": "WebVTT",
      "twitter:image": "https://developer.cdn.mozilla.net/media/img/mdn-logo-sm.png",
      "twitter:site": "@mozhacks",
      "twitter:creator": "@mozhacks",
      "twitter:description": "WebVTT is a format for displaying timed text tracks (e.g. subtitles) with the track element. The primary purpose of WebVTT files is to add subtitles to a video."
    },
    "title": "WebVTT - HTML | MDN"
  }
}
```

#### Example 5: page with Dublin Core metadata (both dc.* and dcterms.* are parsed)
```
http://localhost:8888/meta/http://www.tutorialsonline.info/Common/DublinCore.html

{
  "href": "http://www.tutorialsonline.info/Common/DublinCore.html",
  "contentType": "text/html",
  "meta": {
    "dc": {
      "dc.format": "text/html",
      "dc.creator": "Alan Kelsey",
      "dc.publisher": "Alan Kelsey, Ltd.",
      "dc.publisher.address": "alan@tutorialsonline.info",
      "dc.contributor": "Alan Kelsey",
      "dc.date": "2005-01-06",
      "dc.type": "Text.Homepage.Organizational",
      "dc.relation": "TutorialOnline.info",
      "dc.coverage": "Hennepin Technical College",
      "dc.rights": "Copyright 2012, Alan Kelsey, Ltd.  All rights reserved.",
      "dc.date.x-metadatalastmodified": "2013-01-12",
      "dc.language": "EN",
      "dc.title": "Dublin Core Tutorial",
      "dc.identifier": "http://tutorialsonline.info/Common/DublinCore.html",
      "dc.subject": "Dublin Core Meta Tags"
    },
    "title": "Dublin Core Tutorial"
  }
}
```

#### Example 6: attempt to read an Image vs. an HTML document
```
http://localhost:8888/meta/https://developer.cdn.mozilla.net/media/img/mdn-logo-sm.png

{
  "error": "Unable to read Social Graph or metadata for URL."
}
```

### /img/<url>

The server expects a URL in the following form:

    http://localhost:<PORT>/img/<url>

The server attempts to download the image at `<url>`--no images are saved on the server. If it is not an image, an error will occur. If it is an image, the image's width and height will be determined and returned as JSON.

#### Example: PNG image with size 800 by 400 pixels
```javascript
http://localhost:8888/img/http://url.shortener.com/abcd3

{
  "href": "http://example.com/some-image.png",
  "contentType": "image/png",
  "size": {
    "width": 800,
    "height": 400
  }
}
```

## JSON vs. JSONP

If the caller provides a `callback=<callbackFn>` query string parameter, the result will be JSONP instead of pure JSON:
```
http://localhost:8888/mime/http://google.com?callback=foo

foo && foo({
  "href": "http://www.google.ca/",
  "contentType": "text/html; charset=ISO-8859-1"
});
```

Note: if the URL being passed to the API end-points also includes `?callback=...`, remember to encode the URL such that `?` becomes `%3F` and is not interpreted as part of the API call. Consider:
```
// URL with ?callback param used as part of API call (JSONP)
http://localhost:8888/mime/http://foo.com?callback=bar

// URL containing ?callback param (not part of API call)
http://localhost:8888/mime/http%3A%2F%2Ffoo.com%3Fcallback%3Dfn

// URL containing ?callback param with API using JSONP callback param bar
http://localhost:8888/mime/http%3A%2F%2Ffoo.com%3Fcallback%3Dfn?callback=bar
```

## Errors

A number of situations can cause errors. In all such cases, the API end-points will return a 500 result code, and JSON of the following form:

```
{
  "error": "Error message..."
}
```

Current errors include:

  - `Expected url param, found none.` -- no url was specified to the API call.
  - `Unable to determine content type.` -- the url was unusable, or the resource's content type could not be determined for some reason.
  - `Unable to read Social Graph or metadata for URL.` -- the resource at the given url could not be read or parsed for some reason.

If no error message is given, an unknown error occurred.

## Running the Tests

You can run the tests locally by doing the following from the project's root directory:
```
$ npm test
```
The tests depend on a network connection being available (some real URLs are used).

In order to test the server's cache support, you have to run the tests with some extra environment variables. First, install and start `redis-server` and/or `memcached` locally, then run the tests like so:
```
$ EXPECT_CACHED=1 REDIS_URL=127.0.0.1 npm test
...
$ EXPECT_CACHED=1 MEMCACHED_URL=127.0.0.1 npm test
```

## New Relic

To enable New Relic, set the `NEW_RELIC_ENABLED` environment variable and add a config file, or set the relevant environment variables.

For more information on configuring New Relic, see: https://github.com/newrelic/node-newrelic/#configuring-the-agent

## License

Copyright 2013 David Humphrey <david.humphrey@senecacollege.ca>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
