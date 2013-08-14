/*global describe, before, beforeEach, it */

var expect = require('chai').expect;
var StringStream = require('string-stream');

var sandbox = require('./helpers/sandbox.js');
var serverStub = require('./helpers/server.js');

var client = require('..');

describe('client.request', function() {
  before(serverStub.setup);
  beforeEach(serverStub.resetRequestHandler);
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
        expect(resp.statusCode).to.equal(200);
        expect(resp.headers['x-test']).to.equal('test');
        expect(content).to.equal('a-content');
        done();
      });
    });

    function doGet(cb) {
      client.request(
        serverStub.url,
        { cache: sandbox.PATH },
        readResponseBodyCb(done, cb)
      );
    }
  });

  it('sends request headers and string body', function(done) {
    serverStub.respondWithRequestCopy();

    client.request(
      serverStub.url,
      {
        cache: sandbox.PATH,
        method: 'POST',
        headers: { 'x-test': 'test' },
        body: 'a-content'
      },
      readResponseBodyCb(done, function(resp, content) {
        expect(resp.headers['x-test'], 'remote' + ' header').to.equal('test');
        expect(content, 'remote' + ' content').to.equal('a-content');
        done();
      })
    );
  });

  it('sends request body from Buffer', function(done) {
    var aBuffer = new Buffer([0x01, 0x02, 0x03]);
    serverStub.respondWithRequestCopy();
    client.request(
      serverStub.url,
      {
        cache: sandbox.PATH,
        method: 'POST',
        body: aBuffer
      },
      readResponseBodyCb(done, 'hex', function(resp, content) {
        expect(content).to.equal(aBuffer.toString('hex'));
        done();
      })
    );
  });

  it('sends request body from Stream', function(done) {
    var aStream = new StringStream('a-stream');
    serverStub.respondWithRequestCopy();
    client.request(
      serverStub.url,
      {
        cache: sandbox.PATH,
        method: 'POST',
        body: aStream
      },
      readResponseBodyCb(done, function(resp, content) {
        expect(content).to.equal('a-stream');
        done();
      })
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
      client.request(
        serverStub.url,
        {
          cache: sandbox.PATH,
          method: 'POST'
        },
        readResponseBodyCb(done, cb)
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
      client.request(
        serverStub.url,
        {
          cache: sandbox.PATH,
          method: 'POST'
        },
        readResponseBodyCb(done, cb)
      );
    }
  });
});

function readResponseBodyCb(testDoneCb, enc, successCb) {
  if (successCb === undefined && typeof(enc) === 'function') {
    successCb = enc;
    enc = undefined;
  }
  return function(err, resp) {
    if (err) testDoneCb(err);
    serverStub.readToEnd(resp, enc, function(content) {
      successCb(resp, content);
    });
  };
}
