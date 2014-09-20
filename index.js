/*jslint node: true*/
'use strict';

var path = require('path'),
    Weaver = require('./lib/weaver.js'),
    weaver = new Weaver({
        module: path.resolve(__dirname, './server.js')
    }),
    server = require('./server.js'),
    async = require('async'),
    WORK_LENGTH = 40,
    TASKS_NUM = 2000,
    TX_NUM = 10,
    weaverTasks = [],
    weaverFirstFreeCalls = [],
    weaverRoundRobinCalls = [],
    syncCalls = [],
    tic;

for (var i = 0; i < TASKS_NUM; i++) {
    weaverTasks.push({
        args: WORK_LENGTH
    });
}

for (i = 0; i < TX_NUM; i++) {
    weaverFirstFreeCalls.push(function (callback) {

        weaver.firstFree(weaverTasks, callback);
    });
}
for (i = 0; i < TX_NUM; i++) {
    weaverRoundRobinCalls.push(function (callback) {

        weaver.roundRobin(weaverTasks, callback);
    });
}

for (i = 0; i < TASKS_NUM * TX_NUM; i++) {
    syncCalls.push(server.bind(null, WORK_LENGTH));
}
async.parallel(syncCalls, function (err, res) {

    tic = Date.now();
    async.parallel(syncCalls, function (err, res) {

        console.log('[index.js:33] sync time: ' + (Date.now() - tic));

        tic = Date.now();
            async.parallel(weaverRoundRobinCalls, function (err, res) {

            console.log('[index.js:48] weaver first time: ' + (Date.now() - tic));
            
            tic = Date.now();
            async.parallel(weaverFirstFreeCalls, function (err, res) {

                console.log('[index.js:48] weaver second time: ' + (Date.now() - tic));
                weaver.kill();
            });
        });
    });
});
