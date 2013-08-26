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

/*global describe, before, after, beforeEach, afterEach, it */
'use strict';

var expect = require('chai').expect;
var StringStream = require('string-stream');
var debug = require('debug')('test');

var sandbox = require('./helpers/sandbox.js');
var serverStub = require('./helpers/server.js');

var client = require('..');

describe('client.request', function() {
  beforeEach(serverStub.setup);
  afterEach(serverStub.shutdown);
  beforeEach(sandbox.reset);

  it('returns GET response from server', function(done) {
    serverStub.respondWith(200, { 'x-test' : 'test' }, 'a-content');

    client.request(
      serverStub.url,
      { cache: sandbox.PATH },
      readResponseBodyCb(done, function(resp, content) {
        expect(resp.statusCode).to.equal(200);
        expect(resp.headers['x-test']).to.equal('test');
        expect(content).to.equal('a-content');
        done();
      })
    );
  });

  it('returns GET response from cache', function(done) {
    serverStub.respondWith(200, { 'x-test' : 'test' }, 'a-content');
    doGet(function(resp, content) {
      expect(resp.statusCode).to.equal(200);

      serverStub.respondWith(500);
      doGet(function(resp, content) {
        expect(resp.statusCode).to.equal(304);
        expect(resp.headers['x-test']).to.equal('test');
        expect(content).to.equal('a-content');
        done();
      });
    });

    function doGet(cb) {
      request({ maxAge: 60 }, done, cb);
    }
  });

  it('sends request headers and string body', function(done) {
    serverStub.respondWithRequestCopy();

    request(
      {
        method: 'POST',
        headers: { 'x-test': 'test' },
        body: 'a-content'
      },
      done,
      function(resp, content) {
        expect(resp.headers['x-test'], 'remote' + ' header').to.equal('test');
        expect(content, 'remote' + ' content').to.equal('a-content');
        done();
      }
    );
  });

  it('sends request body from Buffer', function(done) {
    var aBuffer = new Buffer([0x01, 0x02, 0x03]);
    serverStub.respondWithRequestCopy();
    request(
      {
        method: 'POST',
        body: aBuffer
      },
      'hex',
      done,
      function(resp, content) {
        expect(content).to.equal(aBuffer.toString('hex'));
        done();
      }
    );
  });

  it('sends request body from Stream', function(done) {
    var aStream = new StringStream('a-stream');
    serverStub.respondWithRequestCopy();
    request(
      {
        method: 'POST',
        body: aStream
      },
      done,
      function(resp, content) {
        expect(content).to.equal('a-stream');
        done();
      }
    );
  });

  it('does not cache non-GET requests', function(done) {
    serverStub.respondWith(200, {}, 'a-content');
    doPost(function(resp, content) {
      expect(resp.statusCode).to.equal(200);

      serverStub.respondWith(500, {}, 'an-error');
      doPost(function(resp, content) {
        expect(resp.statusCode).to.equal(500);
        expect(content).to.equal('an-error');
        done();
      });
    });

    function doPost(cb) {
      request(
        {
          maxAge: Infinity,
          method: 'POST'
        },
        done,
        cb
      );
    }
  });

  it('does not cache error responses', function(done) {
    serverStub.respondWith(404);
    doGet(function(resp, content) {
      expect(resp.statusCode).to.equal(404);

      serverStub.respondWith(500, {}, 'an-error');
      doGet(function(resp, content) {
        expect(resp.statusCode).to.equal(500);
        expect(content).to.equal('an-error');
        done();
      });
    });

    function doGet(cb) {
      request(
        {
          maxAge: Infinity,
          method: 'POST'
        },
        done,
        cb
      );
    }
  });

  it('ignores cached responses older than maxAge', function(done) {
    serverStub.respondWith(200, {}, 'a-content');
    request({}, done, function(resp, content) {
      serverStub.respondWith(200, {}, 'new-content');
      request({ maxAge: 0 }, done, function(resp, content) {
        expect(resp.statusCode).to.equal(200);
        expect(content).to.equal('new-content');
        done();
      });
    });
  });

  it('uses etag to cache GET requests', function(done) {
    serverStub.respondWith(200, { ETag: 'an-etag' }, 'a-content');
    doGet(function(resp, content) {
      debug('first response headers: %j', resp.headers);
      serverStub.onRequest(handleEtagRequest);
      doGet(function(resp, content) {
        expect(content).to.equal('a-content');
        expect(resp.statusCode).to.equal(304);
        done();
      });
    });

    function doGet(cb) {
      request({ maxAge: 0 }, done, cb);
    }

    function handleEtagRequest(req, resp) {
      if (req.headers['if-none-match'] === 'an-etag') {
        resp.writeHead(304, {});
        resp.end();
      } else {
        resp.writeHead(200, { ETag: 'another-etag' });
        resp.end('etag not matched: ' + req.headers['if-none-match']);
      }
    }
  });

  it('returns a stale response and updates the cache later', function(done) {
    serverStub.respondWith(200, {}, 'stale-content');

    // 1. Cache the result
    request({}, done, function() {
      getStaleResult(function () {
        getUpdatedResult(done);
      });
    });

    function getStaleResult(next) {
      serverStub.respondWith(200, {}, 'updated-content');
      var r = request({ maxStale: Infinity }, done, function(resp, content) {
        expect(content).to.equal('stale-content');
      });
      r.on('cache-update', function() {
        next();
      });
    }

    function getUpdatedResult(next) {
      serverStub.respondWith(500, {}, 'unexpected');
      request({ maxAge: 60 }, done, function(resp, content) {
        expect(content).to.equal('updated-content');
        next();
      });
    }
  });

  it('returns cached response on remote error', function(done) {
    serverStub.respondWith(200, {}, 'a-content');
    request({}, done, function() {
      serverStub.shutdown(function() {
        request({ maxAge: 0 }, done, function(resp, content) {
          expect(resp.statusCode).to.equal(304);
          expect(content).to.equal('a-content');
          done();
        });
      });
    });
  });

});

function readResponseBodyCb(testDoneCb, enc, successCb) {
  if (successCb === undefined && typeof(enc) === 'function') {
    successCb = enc;
    enc = undefined;
  }
  return function(err, resp) {
    if (err) return testDoneCb.apply(this, arguments);
    return serverStub.readToEnd(resp, enc, function(content) {
      successCb(resp, content);
    });
  };
}

function request(options, responseEncoding, testDoneCb, successCb) {
  if (typeof(responseEncoding) === 'function') {
    successCb = testDoneCb;
    testDoneCb = responseEncoding;
    responseEncoding = undefined;
  }

  options.cache = sandbox.PATH;

  return client.request(
    serverStub.url,
    options,
    readResponseBodyCb(testDoneCb, responseEncoding, successCb)
  );
}
