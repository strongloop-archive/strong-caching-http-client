var http = require('http');
var debug = require('debug')('test-server');

exports.setup = setupServerStub;
exports.resetRequestHandler = resetRequestHandler;
exports.respondWith = respondWith;
exports.readToEnd = readToEnd;

var server;

var onHttpRequest;

function setupServerStub(done) {
  server = http.createServer(function(req, resp) {
    req.on('error', failTestOrHook);
    resp.on('error', failTestOrHook);
    onHttpRequest.apply(this, arguments);
  });

  server.on('error', failTestOrHook);

  server.listen(0, function() {
    exports.port = server.address().port;
    debug('Test server listening on port %d', exports.port);
    done();
  });
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

function readToEnd(stream, cb) {
  var content = '';
  stream.on('error', failTestOrHook);
  stream.on('data', function(chunk) {
    content += chunk.toString();
  });
  stream.on('end', function() { cb(content); });
}

function respondWith(code, headers, content) {
  onHttpRequest = function(req, resp) {
    resp.writeHead(code, headers || {});
    resp.end(content);
  };
}
