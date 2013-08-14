# Caching HTTP Client

[![Build Status](https://travis-ci.org/strongloop/strong-caching-http-client.png?branch=master)](https://travis-ci.org/strongloop/strong-caching-http-client)
[![NPM version](https://badge.fury.io/js/strong-caching-http-client.png)](http://badge.fury.io/js/strong-caching-http-client)

## Overview

Strong-caching-http-client is an HTTP client with a transparent
filesystem-based cache.

## Usage

### Installation

```Shell
$ npm install strong-caching-http-client
```

### API

The API is similar to the API of [request](https://npmjs.org/package/request).

```javascript
var client = require('strong-caching-http-client');

client.request(
  'http://nodejs.org/',
  {
    cache: '/tmp/http-client-cache'
  },
  function(err, resp) {
    // resp is http.IncomingMessage
  }
);
```

#### Options:

 * `cache` Path to the directory where the client should keep cached data.
 * `method` GET/POST/etc.
 * `headers` Request headers (optional).
 * `body` Request body (optional). Either `String`, `Buffer` or `Stream`.
 * `maxAge` Accept a cached response whose age is no greated that the specified
  time in seconds. Default: 60.
