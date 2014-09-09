/*jslint node: true*/
'use strict';

var os = require('os'),
    child_process = require('child_process'),
    Weaver = function (config) {
        var i,
            crtWorker;

        config.poolSize = config.poolSize || os.cpus().length;

        this.config = config;
        this.pool = [];
        this.transactions = {};
        this.nextTxid = 0;
        this.taskOffset = 0;

        // Init process pool
        for (i = 0; i < config.poolSize; i++) {
            crtWorker = child_process.fork('./lib/worker.js', config.args, {
                env: {
                    POOLSIZE: config.poolSize,
                    WORKER_ID: i
                }
            });

            crtWorker.on('message', this._handleNewResult.bind(this));

            this.pool.push(crtWorker);
        }
    };

Weaver.prototype.parallel = function (tasks, callback) {
    var self = this,
        txid = this._getNextTxid();

    // Queue messages in workers
    tasks.forEach(function (task, i) {
        // Round-robin on the worker index
        var processId = (self.taskOffset + i) % self.pool.length;

        self.pool[processId].send({
            module: tasks[i].module || self.config.module,
            args: tasks[i].args,
            txid: txid,
            taskid: i
        });
    });

    // Keep track of the position of the next worker to start at
    self.taskOffset += tasks.length;

    // Setup tasks callback
    this.transactions[txid] = {
        tasks: tasks,
        callback: callback,
        results: {} //prepopulate with null error
    };
};

Weaver.prototype.kill = function() {
    this.pool.forEach(function (process) {
        process.kill();
    });
};

Weaver.prototype._handleNewResult = function (message) {
    var transaction = this.transactions[message.txid],
        txDone = false;

    transaction.results[message.taskid] = message.result || null;

    // We are done if we receive an error OR
    // if we received all the results for this transaction.
    txDone = message.err ||
        Object.keys(transaction.results).length === transaction.tasks.length;

    if (txDone) {
        transaction.callback.call(null, message.err, transaction.results);
        delete this.transactions[message.txid];
    }
};

Weaver.prototype._getNextTxid = function() {
    return this.nextTxid++;
};

module.exports = Weaver;
