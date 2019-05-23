# hid-listen
> Library for acquiring debugging information from usb hid devices

[![npm version](https://badge.fury.io/js/hid-listen.svg)](https://badge.fury.io/js/hid-listen)
[![Build Status](https://travis-ci.org/zvecr/hid-listen.svg?branch=master)](https://travis-ci.org/zvecr/hid-listen)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/e82a584a1db24d4897a7fe754ce10255)](https://www.codacy.com/app/zvecr/hid-listen?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=zvecr/hid-listen&amp;utm_campaign=Badge_Grade)
[![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=zvecr/hid-listen)](https://dependabot.com)

NodeJS implementation of <https://www.pjrc.com/teensy/hid_listen.html>.

## Install

```shell
$ npm install hid-listen
```

## Usage

```js
const HIDListen = require('hid-listen');

const inst = new HIDListen();
inst.on('connect', () => {
    console.log('Listening:');
});
inst.on('disconnect', () => {
    console.log('Device disconnected.');
    console.log('Waiting for new device:');
});
inst.on('data', (data) => {
    console.log(data);
});
```
