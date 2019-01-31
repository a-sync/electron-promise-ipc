'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PromiseIpc = exports.PromiseIpcMain = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); // eslint-disable-line


var _electron = require('electron');

var _v = require('uuid/v4');

var _v2 = _interopRequireDefault(_v);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _serializeError = require('serialize-error');

var _serializeError2 = _interopRequireDefault(_serializeError);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var PromiseIpcMain = exports.PromiseIpcMain = function () {
  function PromiseIpcMain(opts) {
    _classCallCheck(this, PromiseIpcMain);

    if (opts) {
      this.maxTimeoutMs = opts.maxTimeoutMs;
    }
  }

  // Send requires webContents -- see http://electron.atom.io/docs/api/ipc-main/


  _createClass(PromiseIpcMain, [{
    key: 'send',
    value: function send(route, webContents) {
      for (var _len = arguments.length, dataArgs = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
        dataArgs[_key - 2] = arguments[_key];
      }

      var _this = this;

      return new _bluebird2.default(function (resolve, reject) {
        var replyChannel = route + '#' + (0, _v2.default)();
        var timeout = void 0;
        var didTimeOut = false;

        // ipcRenderer will send a message back to replyChannel when it finishes calculating
        _electron.ipcMain.once(replyChannel, function (event, status, returnData) {
          clearTimeout(timeout);
          if (didTimeOut) {
            return null;
          }
          switch (status) {
            case 'success':
              return resolve(returnData);
            case 'failure':
              return reject(returnData);
            default:
              return reject(new Error('Unexpected IPC call status "' + status + '" in ' + route));
          }
        });
        webContents.send.apply(webContents, [route, replyChannel].concat(dataArgs));

        if (_this.maxTimeoutMs) {
          timeout = setTimeout(function () {
            didTimeOut = true;
            reject(new Error(route + ' timed out.'));
          }, _this.maxTimeoutMs);
        }
      });
    }

    // If I ever implement `off`, then this method will actually use `this`.
    // eslint-disable-next-line class-methods-use-this

  }, {
    key: 'on',
    value: function on(route, listener) {
      _electron.ipcMain.on(route, function (event, replyChannel) {
        for (var _len2 = arguments.length, dataArgs = Array(_len2 > 2 ? _len2 - 2 : 0), _key2 = 2; _key2 < _len2; _key2++) {
          dataArgs[_key2 - 2] = arguments[_key2];
        }

        // Chaining off of Promise.resolve() means that listener can return a promise, or return
        // synchronously -- it can even throw. The end result will still be handled promise-like.
        _bluebird2.default.resolve().then(function () {
          return listener.apply(undefined, dataArgs);
        }).then(function (results) {
          event.sender.send(replyChannel, 'success', results);
        }).catch(function (e) {
          event.sender.send(replyChannel, 'failure', (0, _serializeError2.default)(e));
        });
      });
    }
  }, {
    key: 'off',
    value: function off(route) {
      return _electron.ipcMain.removeAllListeners(route);
    }
  }]);

  return PromiseIpcMain;
}();

var PromiseIpc = exports.PromiseIpc = PromiseIpcMain;

var mainExport = new PromiseIpcMain();
mainExport.PromiseIpc = PromiseIpcMain;
mainExport.PromiseIpcMain = PromiseIpcMain;

exports.default = mainExport;

module.exports = mainExport;
//# sourceMappingURL=mainProcess.js.map