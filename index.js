/*jslint node: true*/
'use strict';

var path = require('path'),
    Weaver = require('./lib/weaver.js'),
    weaver = new Weaver({
        module: path.resolve(__dirname, './server.js')
    }),
    async = require('async');

async.parallel([function (callback) {

    weaver.parallel([{
        args: ['hello', 'world', '!']
    }, {
        args: ['hello', 'jacques', '!']
    }], callback);
}, function (callback) {

    weaver.parallel([{
        args: ['hello', 'waw', '!']
    }, {
        args: ['hello', 'pierre', '!']
    }], callback);
}], function (err, result) {

    console.log('[index.js:29] DONE: ' + JSON.stringify(result, null, 4));
    weaver.kill();
});


