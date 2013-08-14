var fs = require('fs');
var http = require('http');
var stream = require('stream');

var debug = require('debug')('strong-caching-http-client');
var mkdir = require('mkdirp');

module.exports = exports = RemoteRequest;

/**
 * @param {CachingRequest} cachingRequest
 * @param {function(Error,http.IncomingMessage?)} callback
 * @constructor
 */
function RemoteRequest(cachingRequest, callback) {
  this.options = cachingRequest.options;
  this.cache = cachingRequest.cache;
  this.callback = callback;
}

RemoteRequest.prototype.start = function() {
  var client = this._getHttpClient();
  if (!client) {
    return this._error(
      new Error('Unknown protocol ' + this.options.uriObj.protocol)
    );
  }

  debug('remoteRequest %j', this);

  var opts = this.options;
  var httpRequestOptions = {
    hostname: opts.uriObj.hostname,
    port: opts.uriObj.port,
    path: opts.uriObj.path,
    method: opts.method,
    headers: opts.headers
  };

  if (this.cache.headers.content) {
    var etag = this.cache.headers.content.etag;
    if (etag && opts.method === 'GET') {
      debug('using etag %s for GET %s', etag, opts.uriObj.href);
      httpRequestOptions.headers['If-None-Match'] = etag;
    }
  }

  var req = client
    .request(httpRequestOptions, this._onRemoteResponse.bind(this))
    .on('error',function(err) {
      // TODO serve cached version
      this.callback(err);
    }.bind(this));

  var body = opts.body;
  if (typeof(body) === 'string' || Buffer.isBuffer(body)) {
    req.end(body);
  } else if (isReadableStream(body)) {
    body.pipe(req);
  } else {
    req.end();
  }
};

function isReadableStream(s) {
  return s instanceof stream.Readable || s instanceof stream.Stream;
}

RemoteRequest.prototype._error = function(err) {
  process.nextTick(function() { this.callback(err); }.bind(this));
};

RemoteRequest.prototype._done = function() {
  this.callback(null, this.response);
};

RemoteRequest.prototype._onRemoteResponse = function(resp) {
  this.response = resp;

  if (resp.statusCode != 200) {
    return this._done();
  }

  debug('mkdir %s', this.cache.dirname);
  mkdir(this.cache.dirname, this._onCacheDirCreated.bind(this));
};

RemoteRequest.prototype._onCacheDirCreated = function(err) {
  if (err) {
    debug(
      'Cannot create cache dir %s: %s',
      this.cache.dirname,
      err.message || err
    );
    return this._done();
  }

  fs.writeFile(
    this.cache.headers.path,
    JSON.stringify(this.response.headers, null, 2),
    this._onHeadersSaved.bind(this));
};

RemoteRequest.prototype._onHeadersSaved = function(err) {
  if (err) {
    debug('Cannot save headers to cache: %s', err.message || err);
    this._done();
  }

  var cacheWriter = fs.createWriteStream(
    this.cache.path,
    { flags: 'w' });

  cacheWriter.once('error', function(err) {
    debug('Cannot save content to cache: %s', err.message || err);
    fs.unlink(this.cache.path, function() {});
  }.bind(this));
  this.response.pipe(cacheWriter);
  this._done();
};

RemoteRequest.prototype._getHttpClient = function() {
  switch (this.options.uriObj.protocol) {
  case 'http:':
    return require('http');
  case 'https:':
    return require('https');
  default:
    return null;
  }
};
