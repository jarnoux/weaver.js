/*jslint node: true*/
'use strict';

module.exports = function (args, callback) {

	setTimeout(function () {

		console.log('[server.js:6] pid: ' + process.pid);
		callback(null, args[1]);
	}, 1000 * Math.random());
};
