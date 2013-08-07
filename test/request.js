/*global describe, before, beforeEach, it */

var expect = require('chai').expect;

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
      'http://localhost:' + serverStub.port + '/',
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
        'http://localhost:' + serverStub.port + '/',
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
});
