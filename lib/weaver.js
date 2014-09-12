/*jslint node: true, loopfunc: true*/
'use strict';

var os = require('os'),
    child_process = require('child_process'),
    EventEmitter = require('events').EventEmitter,
    util = require('util'),
    Weaver = function (config) {
        var self = this,
            i,
            crtWorker;

        config.poolSize = config.poolSize || os.cpus().length;

        this.config = config;
        this.pool = [];
        this.freeWorkers = [];
        this.transactions = {};
        this.nextTxid = 0;
        this.taskOffset = 0;

        // Init process pool
        for (i = 0; i < config.poolSize; i++) {
            crtWorker = child_process.fork('./lib/worker.js', [config.module]);

            crtWorker.on('message', function (m) {
                self.emit('result', crtWorker, m);
            });

            this.pool.push(crtWorker);
            this.freeWorkers.push(crtWorker);
        }
        this.on('result', this._processNewResult.bind(this));
        this.on('result', this._recycleWorker.bind(this));
    };

util.inherits(Weaver, EventEmitter);

Weaver.prototype.roundRobin = function (tasks, callback) {
    var self = this,
        myTxid = this._getNextTxid(),
        i;

    // Queue messages in workers
    for (i = 0; i < tasks.length; i++) {
        var processId = (self.taskOffset + i) % self.pool.length;

        var tic = Date.now();
        this._removeFreeWorker(processId);
        self.pool[processId].send({
            args: tasks[i].args,
            txid: myTxid,
            taskid: i
        });
    }

    // Keep track of the position of the next worker to start at
    self.taskOffset += tasks.length;

    // Setup tasks callback
    this.transactions[myTxid] = {
        tasks: tasks,
        results: {} //prepopulate with null error
    };

    this.on('transactionEnd', function (txid, err, res) {
        if (txid === myTxid) {
            callback(err, res);
        }
    });
};

Weaver.prototype.firstFree = function(tasks, callback) {
    var self = this,
        txid = this._getNextTxid();

    tasks.forEach(function (task, i) {


    });
};

Weaver.prototype.kill = function() {
    this.pool.forEach(function (process) {
        process.kill();
    });
};

Weaver.prototype._processNewResult = function (process, message) {
    var transaction = this.transactions[message.txid],
        txDone = false;

    if (!transaction) {
        console.log('[weaver.js:87] error, received result for', JSON.stringify(message, null, 4));
        return;
    }
    transaction.results[message.taskid] = message.result || null;

    // We are done if we receive an error OR
    // if we received all the results for this transaction.
    txDone = message.err || Object.keys(transaction.results).length === transaction.tasks.length;

    if (txDone) {
        this.emit('transactionEnd', message.txid, message.err, transaction.results);
        this.transactions[message.txid] = undefined;
    }
};

Weaver.prototype._recycleWorker = function(process, message) {
    this.freeWorkers.push(process);
};
Weaver.prototype._getNextFreeWorker = function() {
    return this.freeWorkers.shift();
};
Weaver.prototype._removeFreeWorker = function(id) {
    var workerIndex = this.freeWorkers.indexOf(this.pool[id]);
    if (workerIndex === -1) {
        console.log('[weaver.js:116] ERROR cannot find worker: ' + '');
    } else {
        this.freeWorkers.splice(workerIndex, 1);
    }
};

Weaver.prototype._getNextTxid = function() {
    return this.nextTxid++;
};

module.exports = Weaver;
