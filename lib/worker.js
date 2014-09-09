/*jslint node: true*/
'use strict';

var handleMessage = function (m) {
    var mod = require(m.module);

    mod.call(null, m.args, function (err, result) {
        process.send({
            txid: m.txid,
            taskid: m.taskid,
            err: err,
            result: result
        });
    });
};

process.on('message', handleMessage);
