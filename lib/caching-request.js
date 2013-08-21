'use strict';

var assert = require('assert');
var fs = require('fs');
var url = require('url');
var path = require('path');
var crypto = require('crypto');

var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;

var debug = require('debug')('strong-caching-http-client');

var RemoteRequest = require('./remote-request.js');

module.exports = request;

/**
 * Send a HTTP request, call back with a cached result or
 * a response from the remote server.
 * @param {string} uri
 * @param {Object} options
 * @param {function(Error, http.IncomingMessage?)} callback
 */
function request(uri, options, callback) {
  if (!options.cache) {
    return process.nextTick(function() {
      callback(new Error('request requires a valid options.cache path'));
    });
  }

  if (options.method === 'GET' && options.body) {
    return process.nextTick(function() {
      callback(new Error('GET requests must have an empty body'));
    });
  }

  var cachingRequest = new CachingRequest(uri, options, callback);
  cachingRequest.start();
  return cachingRequest;
}

function CachingRequest(uri, options, callback) {
  this._callbackCalled = false;

  this.options = {
    uriObj: url.parse(uri),
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body,
    maxAge: options.maxAge,
    maxStale: options.maxStale
    // TODO (maybe not, it can be set via headers):
    // - auth
    // - agent
  };

  var cacheDir = getCachePathForUrl(options.cache, this.options.uriObj);
  this.cache = {
    dirname: cacheDir,
    path: path.resolve(cacheDir, 'body'),
    stat: null,
    headers: {
      path: path.resolve(cacheDir, 'headers.json'),
      content: null
    }
  };

  this.callback = function() {
    if (this._callbackCalled) return;
    this._callbackCalled = true;
    callback.apply(this, arguments);
  }.bind(this);
}

inherits(CachingRequest, EventEmitter);

CachingRequest.prototype.start = function() {
  debug('%s %s', this.options.method, this.uri);
  if (this.options.method != 'GET') {
    return this._fetchRemote();
  }
  fs.stat(this.cache.path, this._onCacheStat.bind(this));
};

CachingRequest.prototype._onCacheStat = function(err, stat) {
  if (err) {
    debug(
      'Cache miss for %s: %s',
      this.uri,
      err.message || err
    );
    this._fetchRemote();
  } else {
    this.cache.stat = stat;
    fs.readFile(this.cache.headers.path, this._onHeadersRead.bind(this));
  }
};

CachingRequest.prototype._onHeadersRead = function(err, content) {
  if (err) {
    debug(
      'Malformed cache entry %s, the content is present' +
        ' but headers.json are not readable. %s',
      this.uri,
      err.message || err
    );
    return this._fetchRemote();
  }

  try {
    this.cache.headers.content = JSON.parse(content);
  } catch (e) {
    debug(
      'Cannot parse cached headers for %s: %s',
      this.uri,
      e.message || e
    );
    return this._fetchRemote();
  }

  var cacheAgeInSeconds = this._getCacheAgeInSeconds();

  var maxAge = this.options.maxAge;
  if (maxAge && maxAge > 0) {
    if (cacheAgeInSeconds < maxAge) {
      return this._fetchCached();
    }

    debug(
      'Cache miss for %s: age=%ds maxAge=%ds',
      this.uri,
      cacheAgeInSeconds,
      maxAge
    );
  }

  var maxStale = this.options.maxStale;
  var maxAllowedAge = (maxAge || 0) + maxStale;
  if (maxStale && maxStale > 0 && cacheAgeInSeconds < maxAllowedAge) {
    debug('Serving a stale version and starting a background upgrade');
    return this._fetchCachedWithBackgroundUpdate();
  }

  return this._fetchRemote();
};

CachingRequest.prototype._getCacheAgeInSeconds = function() {
  var cacheAgeInMs = Date.now() - this.cache.stat.mtime.getTime();
  return cacheAgeInMs/1000;
};

CachingRequest.prototype._fetchCached = function(callback) {
  debug('Serving the cached version.');
  var resp = fs.createReadStream(this.cache.path);
  resp.httpVersion = '1.1'; // TODO - get this value from the cache
  resp.headers = this.cache.headers.content;
  resp.setTimeout = function(msecs, cb) { cb.call(resp); };
  resp.statusCode = 304; // Not Modified

  if (!callback) callback = this.callback;
  process.nextTick(function() {
    callback(null, resp);
  });
};

CachingRequest.prototype._fetchCachedWithBackgroundUpdate = function() {
  this._fetchCached(onCachedFetched.bind(this));

  function onCachedFetched(err, resp) {
    /* jshint validthis:true */
    this.callback(err, resp);

    this.callback = function() {};
    this._fetchRemote();
  }
};

CachingRequest.prototype._fetchRemote = function() {
  debug('Fetching a fresh version from the server.');
  new RemoteRequest(this, this._onRemoteRequestDone.bind(this)).start();
};

CachingRequest.prototype._onRemoteRequestDone = function(err, resp) {
  if (err) {
    if (this.cache.stat) {
      this._fetchCached(this._onFetchedCachedForError.bind(this, err));
    } else {
      this.callback(err);
    }
  } else if (resp.statusCode == 304) {
    this._handleRemoteNotModified();
  } else {
    this.emit('cache-update', this.uri);
    this.callback(null, resp);
  }
};

CachingRequest.prototype._onFetchedCachedForError =
  function(httpErr, cacheErr, resp) {
  if (cacheErr)
    this.callback(httpErr);
  else
    this.callback(null, resp);
};

CachingRequest.prototype._handleRemoteNotModified = function() {
  var stat = this.cache.stat;
  assert(stat, 'cache file should exists and file stat should be loaded');

  fs.utimes(
    this.cache.path,
    stat.atime,
    Date.now(),
    this._onCacheTimesUpdated.bind(this)
  );
};

CachingRequest.prototype._onCacheTimesUpdated = function(err) {
  if (err) {
    debug(
      'Cannot update mtime of cache entry for %s: %s',
      this.uri,
      err.message || err
    );
  }
  this._fetchCached();
};

Object.defineProperty(CachingRequest.prototype, 'uri', {
  get: function() { return this.options.uriObj.href; }
});

// Remove http:// since that's the most common, and make safe, but still
// human readable.  Shorten and add a bit of sha to make it unique.
function getCachePathForUrl(cacheRoot, uriObj) {
  var href = uriObj.href;
  var sha = crypto.createHash('sha256').update(href).digest('hex').slice(0, 16);
  var unsafe = /[^a-zA-Z0-9_-]+/g;
  var safe = href.replace(unsafe, '_').replace(/^http_/, '').slice(0, 40);
  return path.resolve(cacheRoot, safe + '-' + sha);
}

function isDefaltPort(urlObj) {
  if (urlObj.protocol == 'http' && urlObj.port == 80)
    return true;
  return urlObj.protocol == 'https' && urlObj.port == 443;
}
