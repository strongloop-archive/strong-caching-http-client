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
      function(err, resp) {
        if (err) done(err);
        expect(resp.statusCode).to.equal(200);
        expect(resp.headers['x-test']).to.equal('test');
        serverStub.readToEnd(resp, function(content) {
          expect(content).to.equal('a-content');
          done();
        });
      }
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
        function(err, resp) {
          if (err) done(err);
          serverStub.readToEnd(resp, function(content) {
            cb(resp, content);
          });
        }
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
      function(err, resp) {
        if (err) done(err);
        serverStub.readToEnd(resp, function(content) {
          expect(resp.headers['x-test'], 'remote' + ' header').to.equal('test');
          expect(content, 'remote' + ' content').to.equal('a-content');
          done();
        });
      }
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
      function(err, resp) {
        if (err) done(err);
        serverStub.readToEnd(resp, 'hex', function(content) {
          expect(content).to.equal(aBuffer.toString('hex'));
          done();
        });
      }
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
      function(err, resp) {
        if (err) done(err);
        serverStub.readToEnd(resp, function(content) {
          expect(content).to.equal('a-stream');
          done();
        });
      }
    );
  });
});
