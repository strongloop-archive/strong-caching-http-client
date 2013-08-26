/* Copyright (c) 2013 Strongloop, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

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

