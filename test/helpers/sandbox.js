// Copyright IBM Corp. 2013. All Rights Reserved.
// Node module: strong-caching-http-client
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

'use strict';

var fs = require('fs');
var path = require('path');

exports.PATH = path.resolve(__dirname, '..', 'sandbox');
exports.reset = reset;
exports.rmtreeSync = rmtreeSync;

function reset() {
  rmtreeSync(exports.PATH);
  fs.mkdirSync(exports.PATH);
}

/**
 * Recursively deletes a directory tree if it exists.
 * @param dir Directory or file name to delete.
 */
function rmtreeSync(dir) {
  try {
    var stat = fs.statSync(dir);
    if (!stat.isDirectory()) {
      fs.unlinkSync(dir);
      return;
    }
  } catch (err) {
    if (err.code == 'ENOENT') return;
    throw err;
  }

  var list = fs.readdirSync(dir);
  for (var i = 0; i < list.length; i++) {
    var filename = path.join(dir, list[i]);
    rmtreeSync(filename);
  }
  fs.rmdirSync(dir);
}

