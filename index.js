/*jslint node: true*/
'use strict';

var path = require('path'),
    Weaver = require('./lib/weaver.js'),
    weaver = new Weaver({
        module: path.resolve(__dirname, './server.js')
    }),
    server = require('./server.js'),
    async = require('async'),
    WORK_LENGTH = 200,
    TASKS_NUM = 20,
    TX_NUM = 4000,
    weaverTasks = [],
    weaverCalls = [],
    tic;

for (var i = 0; i < TASKS_NUM; i++) {
    weaverTasks.push({
        args: WORK_LENGTH
    });
}

for (i = 0; i < TX_NUM; i++) {
    weaverCalls.push(function (callback) {

        weaver.roundRobin(weaverTasks, function (err, results) {
            callback(results);
        });
    });
}

tic = Date.now();
for (var j = 0; j < TASKS_NUM * TX_NUM; j++) {
    server(WORK_LENGTH);
}
console.log('[index.js:33] sync time: ' + (Date.now() - tic));

tic = Date.now();
async.parallel(weaverCalls, function (err, res) {
    console.log('[index.js:48] weaver time: ' + (Date.now() - tic));
    weaver.kill();
});
