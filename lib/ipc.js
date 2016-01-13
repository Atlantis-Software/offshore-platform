var util = require('util');
var EventEmitter = require('events').EventEmitter;
var uuid = require('node-uuid');
var requests = {};
var TIMEOUT = 60000;

var ipc = function(child){
    EventEmitter.call(this);
    var self = this;
    this.otherProcess = child || process;
    
    process.on('message',function(message){
        if (message.requestId && message.status === 'send' && message.event) {
            var respond = function(result) {
                self.otherProcess.send({
                    status: 'respond',
                    requestId: message.requestId,
                    content: result
                });
            };
            self.emit(message.event,{data: message.content,respond: respond});
        }
    });
    this.otherProcess.on('message',function(message){
        if (message.requestId && message.status === 'respond' && requests[message.requestId]) {
          requests[message.requestId].apply(null,[message.content]);
          delete requests[message.requestId];
        }        
    });
};
util.inherits(ipc, EventEmitter);

ipc.prototype.send = function(event,data,cb) {
    var requestId = uuid.v4();
    if (cb && typeof cb === "function") {
        requests[requestId] = cb;
        setTimeout(function(){
            if (requests[requestId] && requests[requestId] === cb) {
                delete requests[requestId];
            }
        }, TIMEOUT);
        this.otherProcess.send({
            status: 'send',
            requestId: requestId,
            event: event,
            content: data
        });
    }
};
module.exports = ipc;