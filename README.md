Unify WebView bridge functions via **one shared protocol definition**, then generate
JS / TS / Java / Objective-C / C(C++) stubs.

### Quick Start

1. Edit `protocol.json` to describe bridge methods
2. Run:

```bash
node gen.js
```
3. Generated files will appear in generated/

### CLI Options

```bash
node gen.js
node gen.js --lang=ts,js,java,objc,cpp
node gen.js --out=PATH
node gen.js --all
```

--lang=...
Generate selected targets (comma-separated)

--out=PATH
Output directory

Supports ~

Relative paths are resolved from project root

Existing directories are not cleared; same-name files are overwritten

--all
Same as default behavior

### Outputs

Written to generated/ with base name JsBridge: 
- JsBridge.d.ts — TS interface + VERSION 
- JsBridge.js — JS class + static VERSION 
- JsBridge.java — Java interface + String VERSION 
- JsBridge.h — ObjC protocol + JSBRIDGE_VERSION macro 
- JsBridge.hpp — C-style API with extern "C" guards (for C++ hosts; C users can rename if needed)
