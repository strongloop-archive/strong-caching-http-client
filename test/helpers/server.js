'use strict';

var http = require('http');
var debug = require('debug')('test-server');

exports.setup = setupServerStub;
exports.resetRequestHandler = resetRequestHandler;
exports.respondWith = respondWith;
exports.respondWithRequestCopy = respondWithRequestCopy;
exports.onRequest = onRequest;
exports.readToEnd = readToEnd;
exports.shutdown = shutdownServerStub;

var server;

var onHttpRequest;

function setupServerStub(done) {
  server = http.createServer(function(req, resp) {
    req.on('error', failTestOrHook);
    resp.on('error', failTestOrHook);

    // Disable keep-alive connections to make shutdownServerStub work
    // as expected.
    resp.setHeader('Connection', 'close');

    onHttpRequest.apply(this, arguments);
  });

  server.on('error', failTestOrHook);

  server.listen(0, function() {
    exports.port = server.address().port;
    exports.url = 'http://localhost:' + exports.port + '/';
    debug('Test server listening on port %d', exports.port);
    done();
  });
}

function shutdownServerStub(done) {
  if (!server)
    return done();

  server.close(done);
  server = null;
}

function failTestOrHook(err) {
  throw err;
}

function resetRequestHandler() {
  onHttpRequest = defaultHttpHandler;
}

function defaultHttpHandler(req, resp) {
  resp.statusCode = 501; // not implemented
  resp.end();
}

function readToEnd(stream, enc, cb) {
  if (!cb && typeof(enc) === 'function') {
    cb = enc;
    enc = 'utf-8';
  }
  var content = '';
  stream.on('error', failTestOrHook);
  stream.on('data', function(chunk) {
    content += chunk.toString(enc);
  });
  stream.on('end', function() { cb(content); });
}

function onRequest(cb) {
  onHttpRequest = cb;
}

function respondWith(code, headers, content) {
  onRequest(function(req, resp) {
    resp.writeHead(code, headers || {});
    resp.end(content);
  });
}

function respondWithRequestCopy() {
  onRequest(function(req, resp) {
    resp.writeHead(200, req.headers);
    req.pipe(resp);
  });
}
