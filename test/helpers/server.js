/* Copyright (c) 2013 Strongloop, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

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
