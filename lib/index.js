/* eslint-disable prefer-destructuring */
/* eslint-disable no-param-reassign */
/* eslint-disable no-bitwise */
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const forever = require('async/forever');
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
  constructor() {
    super();

    setTimeout(() => {
      this.eventLoop();
    }, 100);
  }

  close() {
    this.removeAllListeners();
    if (this.dev) {
      this.dev.close();
    }
  }

  eventLoop() {
    forever((next) => {
      const deviceInfo = HID.devices().find(isRawHid);

      if (!deviceInfo) {
        if (this.eventNames().length) {
          setTimeout(() => {
            this.emit('tick');
            next();
          }, 1000);
        }
        return;
      }

      this.emit('connect');

      const [buffer, stream] = createLineBuffer();
      stream.on('data', (data) => {
        this.emit('data', data.toString());
      });

      const device = new HID.HID(deviceInfo.path);
      device.on('data', (data) => {
        if (data && data.length) {
          buffer.put(SmartBuffer.fromBuffer(data).readStringNT(), 'utf8');
        }
      });
      device.on('error', () => {
        this.emit('disconnect');
        next();
      });

      this.dev = device;
    });
  }
}

module.exports = HIDListen;