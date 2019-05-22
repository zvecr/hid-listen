/* eslint-disable no-underscore-dangle */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-param-reassign */
/* eslint-disable no-bitwise */
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const whilst = require('async/whilst');
const HID = require('node-hid');
const streamBuffers = require('stream-buffers');
const byline = require('byline');
const { SmartBuffer } = require('smart-buffer');

// Patch linux for its missing usagePage
if (process.platform === 'linux') {
  HID.devices = new Proxy(HID.devices, {
    apply(target, ctx, args) {
      const devices = target.apply(ctx, args);
      devices.forEach((d) => {
        if (!d.usagePage || !d.usage) {
          const hidraw = `/sys/class/hidraw/${path.basename(d.path)}/device/report_descriptor`;
          if (fs.existsSync(hidraw)) {
            const report = fs.readFileSync(hidraw);

            d.usagePage = (report[2] << 8) + report[1];
            d.usage = report[4];
          }
        }
      });
      return devices;
    },
  });
}

// Patch for HID.HID.read to use timeout to work round blocking reads and .close()
//   not allowing the process to quit - https://github.com/node-hid/node-hid/issues/61
HID.HID = new Proxy(HID.HID, {
  construct(Target, args) {
    const ret = new Target(...args);
    ret.read = function readUseTimeout(callback) {
      try {
        const data = this.readTimeout(1000);

        setTimeout(() => {
          callback(null, Buffer.from(data));
        }, 0);
      } catch (err) {
        callback(err, null);
      }
    };
    return ret;
  },
});

function isRawHid(device) {
  return (device.usagePage === 0xFF31 && device.usage === 0x0074);
}

function createLineBuffer() {
  const buffer = new streamBuffers.ReadableStreamBuffer();
  return [buffer, byline(buffer)];
}

class HIDListen extends EventEmitter {
  constructor({ tick = 1000 } = {}) {
    super();

    this._tick = tick;

    this.once('newListener', () => {
      setTimeout(() => {
        this.eventLoop();
      }, 100);
    });
  }

  removeAllListeners() {
    super.removeAllListeners();
    if (this.dev) {
      this.dev.close();
    }
  }

  eventLoop() {
    whilst(cb => cb(null, this.eventNames().length > 0), (next) => {
      const deviceInfo = HID.devices().find(isRawHid);
      if (!deviceInfo) {
        setTimeout(() => {
          this.emit('tick');
          next();
        }, this._tick);
        return;
      }

      const device = new HID.HID(deviceInfo.path);

      const [buffer, stream] = createLineBuffer();
      stream.on('data', (data) => {
        this.emit('data', data.toString(), device);
      });

      device.on('data', (data) => {
        if (data && data.length) {
          buffer.put(SmartBuffer.fromBuffer(data).readStringNT(), 'utf8');
        }
      });
      device.on('error', () => {
        this.emit('disconnect', device);
        next();
      });

      this.dev = device;
      this.emit('connect', device);
    });
  }
}

module.exports = HIDListen;
