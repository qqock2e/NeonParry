'use strict';

module.exports = {
  "appId": "io.qqock2e.neonparry",
  "productName": "Neon Parry",
  "asar": true,
  "npmRebuild": false,
  "afterPack": "build/after-pack.cjs",
  "directories": {
    "output": "release",
    "buildResources": "build"
  },
  "files": [
    "src/main/**",
    "src/renderer/**",
    "package.json"
  ],
  "electronLanguages": [
    "en-US",
    "ko"
  ],
  "mac": {
    "category": "public.app-category.games",
    "icon": "build/icons/icon.icns",
    "identity": "-",
    "hardenedRuntime": true,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.plist",
    "target": [
      {
        "target": "zip",
        "arch": [
          "universal"
        ]
      }
    ],
    "artifactName": "Neon-Parry-${version}-macOS-universal.zip"
  },
  "win": {
    "icon": "build/icons/icon.ico",
    "signExecutable": false,
    "requestedExecutionLevel": "asInvoker",
    "target": [
      {
        "target": "portable",
        "arch": [
          "x64"
        ]
      }
    ]
  },
  "portable": {
    "artifactName": "Neon-Parry-${version}-Windows-x64.exe",
    "requestExecutionLevel": "user"
  }
};
