/*jslint node: true*/
'use strict';

module.exports = function (args, callback) {
    var primes = [],
        isPrime = false;

    var tic = Date.now();
    for (var i = 3; i < args; i++) {
        isPrime = true;
        for (var j = 2; j <= Math.sqrt(i); j++) {
            if (i % j === 0) {
                isPrime = false;
                break;
            }
        }
        if (isPrime) {
            primes.push(i);
        }
    }
    callback && callback(null, primes.length);
};
