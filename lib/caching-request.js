var fs = require('fs');
var url = require('url');
var path = require('path');

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

  new CachingRequest(uri, options, callback).start();
}

function CachingRequest(uri, options, callback) {
  this._callbackCalled = false;

  this.options = {
    uriObj: url.parse(uri),
    method: options.method || 'GET'
    // TODO:
    // - auth
    // - agent
    // - request headers
    // - request body stream
  };

  var cacheDir = getCachePathForUrl(options.cache, this.options.uriObj);
  this.cache = {
    dirname: cacheDir,
    path: path.resolve(cacheDir, '#body'),
    stat: null,
    headers: {
      path: path.resolve(cacheDir, '#headers.json'),
      content: null
    }
  };

  this.callback = function() {
    if (this._callbackCalled) return;
    this._callbackCalled = true;
    callback.apply(this, arguments);
  }.bind(this);
}

CachingRequest.prototype.start = function() {
  fs.stat(this.cache.path, this._onCacheStat.bind(this));
};

CachingRequest.prototype._onCacheStat = function(err, stat) {
  if (err) {
    debug(
      'Cache miss for %s: %s',
      this.options.uriObj.href,
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
      this.options.uriObj.href,
      err.message || err
    );
    return this._fetchRemote();
  }

  try {
    this.cache.headers.content = JSON.parse(content);
  } catch (e) {
    debug(
      'Cannot parse cached headers for %s: %s',
      this.options.uriObj.href,
      e.message || e
    );
    return this._fetchRemote();
  }

  return this._fetchCached();
};

CachingRequest.prototype._fetchCached = function() {
  var resp = fs.createReadStream(this.cache.path);
  resp.httpVersion = '1.1'; // TODO - get this value from the cache
  resp.headers = this.cache.headers.content;
  resp.setTimeout = function(msecs, cb) { cb.call(resp); };
  resp.statusCode = 200;

  process.nextTick(function() {
    this.callback(null, resp);
  }.bind(this));
};

CachingRequest.prototype._fetchRemote = function() {
  new RemoteRequest(this).start();
};

function getCachePathForUrl(cacheRoot, uriObj) {
  var hostPort = uriObj.hostname;

  if (!isDefaltPort(uriObj)) {
    // can't use ":" because it is a reserved character on Windows
    hostPort += '-' + uriObj.port;
  }

  var pathname = uriObj.pathname;
  if (pathname[pathname.length - 1] == '/')
    pathname = pathname.substr(0, pathname.length - 1);

  var cachePath = path.resolve(
    cacheRoot,
    hostPort,
    pathname
  );

  // TODO add query string to the path (encoded?)

  return cachePath;
}

function isDefaltPort(urlObj) {
  if (urlObj.protocol == 'http' && urlObj.port == 80)
    return true;
  return urlObj.protocol == 'https' && urlObj.port == 443;
}
