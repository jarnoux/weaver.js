/*jslint node: true*/
'use strict';

var mod = require(process.argv[2]),
    handleMessage = function (m) {

        mod(m.args, function (err, result) {
            process.send({
                txid: m.txid,
                taskid: m.taskid,
                err: err,
                result: result
            });
        });
    };

process.on('message', handleMessage);
