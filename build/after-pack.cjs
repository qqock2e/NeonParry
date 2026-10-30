'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

module.exports = async context => {
  if (context.electronPlatformName !== 'darwin') return;
  const bundle = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  // File Provider may attach Finder metadata while the bundle is assembled.
  // Clear only signing-incompatible metadata; preserve all security attributes.
  for (const attribute of ['com.apple.FinderInfo', 'com.apple.ResourceFork']) {
    const result = spawnSync('/usr/bin/xattr', ['-dr', attribute, bundle], {encoding: 'utf8'});
    if (result.error) throw result.error;
    if (result.status !== 0) {
      const errors = (result.stderr || '').split('\n').filter(line => line && !line.includes('No such xattr'));
      if (errors.length) throw new Error(errors.join('\n'));
    }
  }
};
