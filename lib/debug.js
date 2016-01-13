var util = require('util');
var _ = require('lodash');

var debug = {};

debug.info = function(message) {
    var time = new Date();
    var day = time.getDay();
    var month = time.getMonth();
    var year = time.getFullYear();
    var hour = time.getHours();
    var min = time.getMinutes();
    var sec = time.getSeconds();
    var now = day + "-" + month + "-" + year + " " + hour + ":" + min + ":" + sec;
    console.log('Info: '+ now + " ",message);
};

debug.warning= function(message) {
    console.log('Warning: ',message);
};


debug.error = function(message,obj) {
    var err = new Error();
    console.log(err.stack);
    console.log('==> message: ',message);
    if ( !_.isUndefined(obj) ) {
        if (_.isNull(obj)) {
            console.log("NULL");
        }
        else if (_.isObject(obj)) {
            console.log(obj.constructor.name + ": " + util.inspect(obj));
        }
        else {
            if (_.isString(obj) && obj.length > 50) {
                var size = obj.length;
                obj = obj.substring(0, 50) + "      ...(original size:" + size + ")";
                
            }
            console.log(typeof obj + ": " + obj);
        }
    }
};

module.exports = debug;