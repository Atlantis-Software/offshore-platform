var assert = require('assert');
var http = require('http');
var util = require('util');

describe('Middleware', function() {
  it('should process and answer http request via middleware', function(done) {
    http.get({
      host: 'localhost',
      port: port,
      path: '/DYN/test/test2?input1=OK!'
    }, function(response) {
      var body = '';
      response.on('data', function(d) {
        body += d;
      });
      response.on('end', function() {
        assert(body === 'middleware OK!');
        done();
      });
    });
  });
});