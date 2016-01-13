var cluster = require('cluster');
var http = require("http");
var url = require("url");
var path = require("path");
var fs = require("fs");
var mime = require('mime');
var _ = require('lodash');
var Ipc = require('./ipc');
var Debug = require('./debug');

// params
var params = {};
params.maxWorker = require('os').cpus().length;
params.dynamicPath = '/DYN';


var nop = function() {};

global.app = {
  _router: [],
  _uses: [],
  debug: Debug,
  route: nop,
  use: nop,
  listen: nop
};

if (cluster.isMaster) {
  // Fork workers.
  var workers = [];
  for (var i = 0; i < params.maxWorker; i++) {
    (function createWorker(workerID) {
      var new_worker_env = {};
      new_worker_env["WORKER_NAME"] = "worker" + workerID;
      workers[workerID] = cluster.fork(new_worker_env);
      workers[workerID].ipc = new Ipc(workers[workerID]);
      workers[workerID].on('exit', function(code, signal) {
        createWorker(workerID);
      });
    })(i);
  }

  var lastWorkerUsed = 0;

  app.listen = function(port) {
    var server = http.createServer(function(request, response) {
      var uri = url.parse(request.url).pathname;
      var requestPath = path.normalize(uri);
      var pathChunk = path.normalize(uri).split(path.sep);
      pathChunk = pathChunk.slice(1, pathChunk.length);


      lastWorkerUsed++;
      if (lastWorkerUsed >= workers.length) {
        lastWorkerUsed = 0;
      }

      // unsure dynamicPath start and end with a slash
      var dynamicPath = params.dynamicPath;
      if (dynamicPath[0] !== '/') {
        dynamicPath = '/' + dynamicPath;
      }
      if (dynamicPath[dynamicPath.length] !== '/') {
        dynamicPath += '/';
      }

      // check if requesting socket.io file to let socket.io answer
      if (requestPath === path.join(params.dynamicPath, 'socket.io')) {
        return;
      } else if (requestPath.indexOf(dynamicPath) === 0) {
        var urlData = url.parse(request.url, true).query;
        // check json protocol
        if (urlData.callback) {
          var req = {
            type: 'jsonp',
            request: urlData.request,
            data: urlData.data
          };
          // JSON request
          workers[lastWorkerUsed].ipc.send('request', urlData, function(result) {
            response.writeHead(200, {'content-type': 'text/json'});
            response.end(urlData.callback + '(' + JSON.stringify(result) + ');');
          });
        } else {
          // HTTP request
          var request = requestPath.slice(dynamicPath.length, requestPath.length);
          request = request.replace('/', ':');
          var req = {
            type: 'http',
            request: request,
            data: urlData
          };
          workers[lastWorkerUsed].ipc.send('request', req, function(result) {
            if (result.notification.type === 'ERROR') {
              response.writeHead(500, {"Content-Type": "text/plain"});
              response.write(result.notification.msg + "\n");
              response.end();
            }
            else {
              response.writeHead(200, {'content-type': result.contentType});
              if (result.contentType !== 'text/plain') {
                response.write(new Buffer(result.data, 'base64'), "binary");
              }
              else {
                response.write(result.data);
              }
              response.end();
            }
          });
        }
      } else if (process.env.NODE_ENV !== 'production') {
        var filename = path.join(staticDir, uri);
        fs.exists(filename, function(exists) {
          if (!exists) {
            response.writeHead(404, {"Content-Type": "text/plain"});
            response.write("404 Not Found\n");
            response.end();
            return;
          }

          if (fs.statSync(filename).isDirectory()) {
            filename = path.join(filename, 'index.html');
          }

          fs.readFile(filename, "binary", function(err, file) {
            if (err) {
              response.writeHead(500, {"Content-Type": "text/plain"});
              response.write(err + "\n");
              response.end();
              return;
            }
            var contentType = mime.lookup(filename) || 'application/octet-stream';
            response.writeHead(200, {"Content-Type": contentType});
            response.write(file, "binary");
            response.end();
          });
        });
      }
    }).listen(port);
    var io = require('socket.io')(server, {path: path.join(params.dynamicPath, 'socket.io')});
    io.on('connection', function(socket) {
      socket.on('request', function(data, respond) {
        lastWorkerUsed++;
        if (lastWorkerUsed >= workers.length) {
          lastWorkerUsed = 0;
        }
        delete data.apiDomain; // block hack api
        var req = {
          type: 'socket.io',
          request: data.request,
          data: data.data
        };
        workers[lastWorkerUsed].ipc.send('request', req, respond);
      });
      socket.on('apiRequest', function(encryptedData, respond) {
        var data = api.decrypt(encryptedData);
        lastWorkerUsed++;
        if (lastWorkerUsed >= workers.length) {
          lastWorkerUsed = 0;
        }
        var req = {
          type: 'socket.io',
          request: data.request,
          data: data.data,
          apiDomain: data.apiDomain
        };
        workers[lastWorkerUsed].ipc.send('request', req, respond);
      });
    });
  };

} else {
  app.route = function(controller, actions) {
    var self = this;
    (function recusive_route(current_route, actions) {
      for (action_key in actions) {
        var action = actions[action_key];
        var route = current_route + ":" + action_key;
        if (_.isArray(action)) {
          self._router[route] = action;
        }
        else if (_.isObject(action)) {
          recusive_route(route, action);
        }
      }
    })(controller, actions);
  };

  app.use = function(routemask, middleware) {
    if (!middleware) {
      var middleware = routemask;
      var routemask = '';
    }
    app._uses.push({ routemask: routemask, middleware: middleware });
  };

  var ipc = new Ipc();
  ipc.on('request', require('./request'));

}

module.exports = function(params) {
  return app;
};