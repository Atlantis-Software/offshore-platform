var platform = require('../lib/platform');
var cluster = require('cluster');

global.app = platform();

app.use('test:*2', function(req) {
  req.resolve('middleware ' + req.data.input1);
});

app.route('test', {
  'test1': [
    {
      input: {
        input1: {
          type: 'string'
        }
      }
    },
    function(req) {
      req.resolve('router ' + req.data.input1);
    }
  ]
});

global.port = 7850;
app.listen(port);

if (cluster.isMaster) {
  var mocha = require('mocha');
  var fs = require('fs');
  var path = require('path');

  var test = new mocha({
    bail: false,
    timeout: 20000
  });

  fs.readdirSync(__dirname).filter(function(file) {
    return file.substr(-7) === 'Test.js';
  }).forEach(function(file) {
    test.addFile(path.join(__dirname, file));
  });

  var runner = test.run(function(err) {
    if (err) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  });
}