var asynk = require('asynk');
var validator = require('offshore-validator');
var _ = require('lodash');


// Notification Object
var Notification = function() {
  this.type = "ERROR";
  this.msg = "#UNKNOWN_ERROR";
};
Notification.prototype.success = function() {
  this.type = "SUCCESS";
  this.msg = '#OK';
  return this;
};
Notification.prototype.error = function(msg) {
  this.type = "ERROR";
  this.msg = msg;
  return this;
};

request = function(event) {
  var requestInfo = event.data;
  var req = asynk.deferred();
  req.contentType = null;
  req.request = requestInfo.request;
  req.type = requestInfo.type;
  req.data = requestInfo.data;

  req.done(function(content) {
    var result = {};
    if ( _.isNull(req.contentType) ) {
      if (_.isString(content)) {
        result.contentType = 'text/plain';
      }
      else if (_.isObject(content)) {
        result.contentType = 'text/json';
      }
    } else {
      result.contentType = req.contentType;
    }
    result.data = content;
    result.notification = new Notification().success();
    event.respond(result);
  }).fail(function(err) {
    var data = {};
    data.notification = new Notification().error(err);
    event.respond(data);
  });

  // execute middlewares
  app._uses.forEach(function(use){
    var routemask = use.routemask.replace('*','.*');
    routemask = new RegExp('^' + routemask);
    // check routemask match current request
    if (requestInfo.request.match(routemask)) {
      use.middleware.apply(app,[req]);
    }
  });
  
  asynk.each(app._uses,function(use, cb){
    var routemask = use.routemask.replace('*','.*');
    routemask = new RegExp('^' + routemask);
    // check routemask match current request
    if (requestInfo.request.match(routemask)) {
      use.middleware.apply(app,[req, cb]);
    } else {
      cb();
    }
  }).serie().done(function(){
    // check if middleware has already anwsered the request
    if (req.state() === "pending") {

      var action = app._router[requestInfo.request];
      var validRequest;
      if (action) {
        var header = action[0];
        // reset request data before validation
        req.data = {};

        validRequest = true;
        var inputRules = header.input;
        _.keys(inputRules).forEach(function(key) {
          var data = requestInfo.data[key];
          var rule = inputRules[key];
          if ((_.isUndefined(data) || _.isNull(data)) && rule.required === false) {
            return;
          }
          if (rule.type && !validator(data).to(rule)) {
            req.data[key] = data;
          }
          else {
            validRequest = false;
            app.debug.error(validator(data).to(rule, requestInfo.data) || 'no type for ' + key);
          }
        });

      } else {
        validRequest = false;
        app.debug.error('no route');
        req.reject(new Error('no route'));
      }


      if (validRequest) {
        var d = require('domain').create();
        d.on('error', function(err) {
          app.debug.error('REQUEST_ERROR on ' + req.request, err);
          req.reject("#REQUEST_ERROR");
        });
        d.run(function() {
          if (req.request && app._router[req.request] && app._router[req.request][1] && _.isFunction(app._router[req.request][1])) {
            app._router[req.request][1](req);
          } else {
            app.debug.error('REQUEST_ERROR on ' + req.request);
            req.reject("#REQUEST_ERROR");
          }
        });
      } else {
        app.debug.error('REQUEST_ERROR on ' + req.request);
        req.reject("#REQUEST_ERROR");
      }
    }
  });
  return req;
};

module.exports = request;