var assert = require('assert');
var http = require('http');
var util = require('util');

describe('Router', function() {
  it('should process and answer http request', function(done) {
    http.get({
      host: 'localhost',
      port: port,
      path: '/DYN/test/test1?input1=OK!'
    }, function(response) {
      var body = '';
      response.on('data', function(d) {
        body += d;
      });
      response.on('end', function() {
        assert(body === 'router OK!');
        done();
      });
    });
  });
});