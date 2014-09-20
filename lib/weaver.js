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
        this.pool = {};
        this.freeWorkersQueue = [];
        this.freeWorkers = {};
        this.transactions = {};
        this.nextTxid = 0;
        this.roundRobinOffset = 0;
        this.taskWaiters = [];

        // Init process pool
        for (i = 0; i < config.poolSize; i++) {
            crtWorker = child_process.fork('./lib/worker.js', [config.module]);

            crtWorker.on('message', EventEmitter.prototype.emit.bind(self, 'result', i));

            this.pool[i] = crtWorker;
            this._addFreeWorker(i);
        }
        this.on('result', this._processNewResult.bind(this));
        this.on('result', this._addFreeWorker.bind(this));
        this.on('result', this._unblockNextWaiter.bind(this));
    };

util.inherits(Weaver, EventEmitter);

Weaver.prototype.roundRobin = function (tasks, callback) {
    var self = this,
        myTxid = this._newTransaction(tasks);

    // Queue messages in workers
    tasks.forEach(function (task, i) {
        var workerIndex = (self.roundRobinOffset + i) % self.config.poolSize;

        self.pool[workerIndex].send({
            args: task.args,
            txid: myTxid,
            taskid: i
        });
    });

    // Keep track of the position of the next worker to start at
    self.roundRobinOffset += tasks.length;

    this.on('transactionEnd', function (txid, err, res) {
        if (txid === myTxid) {
            callback(err, res);
        }
    });
};

Weaver.prototype.firstFree = function(tasks, callback) {
    var self = this,
        myTxid = this._newTransaction(tasks),
        nextTaskId,
        nextFreeWorkerId;

    for (nextTaskId = 0; nextTaskId < tasks.length; nextTaskId++) {
        nextFreeWorkerId = this._getNextFreeWorker();
        if (nextFreeWorkerId !== undefined) {
            this._sendTask(myTxid, tasks[nextTaskId], nextTaskId, nextFreeWorkerId);
            // Make sure the worker doesnt wait for work after it sends a result
            nextTaskId++;
            if (nextTaskId < tasks.length) {
                this._sendTask(myTxid, tasks[nextTaskId], nextTaskId, nextFreeWorkerId);
            }
        } else {
            this.taskWaiters.push({
                task: tasks[nextTaskId],
                txid: myTxid,
                taskid: nextTaskId
            });
        }
    }

    this.on('transactionEnd', function (txid, err, res) {
        if (txid === myTxid) {
            callback(err, res);
        }
    });
};

Weaver.prototype._sendTask = function (txid, task, taskid, workerId) {

    this.pool[workerId].send({
        args: task.args,
        txid: txid,
        taskid: taskid
    });
}

Weaver.prototype._unblockNextWaiter = function(workerId) {
    var nextWaiter = this.taskWaiters.shift();

    if (nextWaiter) {
        this._sendTask(nextWaiter.txid, nextWaiter.task, nextWaiter.taskid, workerId);
    }
}

Weaver.prototype._processNewResult = function (workerId, message) {
    var transaction = this.transactions[message.txid],
        txDone = false;

    if (!transaction) {
        console.log('Warning: Received message for done transaction: ', message);
    }

    transaction.results[message.taskid] = message.result;

    // We are done if we receive an error OR
    // if we received all the results for this transaction.
    txDone = message.err || Object.keys(transaction.results).length === transaction.tasks.length;

    if (txDone) {
        this.emit('transactionEnd', message.txid, message.err, transaction.results);
        delete this.transactions[message.txid];
    }
};

Weaver.prototype._addFreeWorker = function(index) {
    if (!this.freeWorkers[index]) {
        this.freeWorkersQueue.push(index);
        this.freeWorkers[index] = true;
    }
};
Weaver.prototype._getNextFreeWorker = function() {
    var freeWorker = this.freeWorkersQueue.shift();
    
    this.freeWorkers[freeWorker] = false;
    return freeWorker;
};

Weaver.prototype._getNextTxid = function() {
    return this.nextTxid++;
};

Weaver.prototype._newTransaction = function(tasks) {
    var txid = this._getNextTxid();

    this.transactions[txid] = {
        tasks: tasks,
        results: {}
    };
    return txid;
};

Weaver.prototype.kill = function() {
    var self = this;

    Object.keys(this.pool).forEach(function (id) {
        self.pool[id].kill();
    });
};

module.exports = Weaver;
