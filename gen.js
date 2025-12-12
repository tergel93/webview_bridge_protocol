#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const PROTOCOL_PATH = path.join(ROOT, 'protocol.json');
const BRIDGE_NAME = 'JsBridge';
const SUPPORTED = new Set(['ts', 'js', 'java', 'objc', 'cpp']);

const typeMap = {
  ts: {
    string: 'string',
    boolean: 'boolean',
    uint: 'number',
    int: 'number',
    double: 'number',
    void: 'void',
  },
  java: {
    string: 'String',
    boolean: 'boolean',
    uint: 'long',
    int: 'int',
    double: 'double',
    void: 'void',
  },
  objc: {
    string: 'NSString *',
    boolean: 'BOOL',
    uint: 'NSUInteger',
    int: 'NSInteger',
    double: 'double',
    void: 'void',
  },
  cpp: {
    string: 'const char *',
    boolean: 'bool',
    uint: 'uint64_t',
    int: 'int32_t',
    double: 'double',
    void: 'void',
  },
};

function normalizeType(t) {
  if (!t || typeof t !== 'string') return 'void';
  return String(t).replace(/,$/, '').trim();
}

function pickReturn(m) {
  if (!m.returns) return { type: 'void', desc: '' };
  if (typeof m.returns === 'string') return { type: m.returns, desc: '' };
  if (typeof m.returns === 'object') {
    return {
      type: m.returns.type || 'void',
      desc: m.returns.desc || '',
    };
  }
  return { type: 'void', desc: '' };
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readSpec(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const spec = JSON.parse(raw);
  if (!spec.methods || !Array.isArray(spec.methods)) {
    throw new Error('protocol.json: 缺少 methods 数组');
  }
  return spec;
}

function docComment(desc, indent = '') {
  if (!desc) return '';
  const body = desc.split('\n').map(line => `${indent} * ${line}`).join('\n');
  return `${indent}/**\n${body}\n${indent} */\n`;
}

function parseTargets(argv) {
  // supported format: --lang=ts,js,java,objc  or --all
  const langArg = argv.find(a => a.startsWith('--lang='));
  const all = argv.includes('--all');
  if (!langArg && !all) return Array.from(SUPPORTED); // all supported languages
  if (all) return Array.from(SUPPORTED);
  const list = langArg.replace('--lang=', '').split(',').map(s => s.trim()).filter(Boolean);
  const invalid = list.filter(l => !SUPPORTED.has(l));
  if (invalid.length) {
    throw new Error(`Unsupported lang(s): ${invalid.join(', ')}. Supported: ${Array.from(SUPPORTED).join(',')}`);
  }
  return list;
}

function parseOutDir(argv) {
  const outArg = argv.find(a => a.startsWith('--out='));
  if (!outArg) return path.join(ROOT, 'generated');
  const out = outArg.replace('--out=', '').trim();
  if (!out) return path.join(ROOT, 'generated');
  const expanded = out.startsWith('~')
    ? path.join(os.homedir() || '', out.slice(1))
    : out;
  return path.isAbsolute(expanded) ? expanded : path.join(ROOT, expanded);
}

function renderTs(spec) {
  const version = String(spec.version ?? '');
  const methods = spec.methods.map(m => {
    const tags = [];
    if (m.min_version != null) tags.push(`@since ${m.min_version}`);
    const retInfo = pickReturn(m);
    if (retInfo.desc) tags.push(`@returns ${retInfo.desc}`);
    const descText = [m.desc, ...tags].filter(Boolean).join('\n');
    const desc = docComment(descText, '  ');
    const params = (m.params || [])
      .map(p => `${p.name}: ${typeMap.ts[normalizeType(p.type)] || 'any'}`)
      .join(', ');
    const ret = typeMap.ts[normalizeType(retInfo.type)] || 'any';
    return `${desc}  ${m.name}(${params}): ${ret};`;
  }).join('\n\n');
  const header = `// Generated from protocol.json (version ${spec.version}). Do not edit manually.`;
  return `${header}\nexport interface ${BRIDGE_NAME} {\n${methods}\n}\n\nexport const VERSION = "${version}";\n`;
}

function renderJs(spec) {
  const version = String(spec.version ?? '');
  const methods = spec.methods.map(m => {
    const tags = [];
    if (m.min_version != null) tags.push(`@since ${m.min_version}`);
    const retInfo = pickReturn(m);
    if (retInfo.desc) tags.push(`@returns ${retInfo.desc}`);
    const descText = [m.desc, ...tags].filter(Boolean).join('\n');
    const desc = docComment(descText, '  ');
    const params = (m.params || []).map(p => p.name).join(', ');
    return `${desc}  ${m.name}(${params}) {\n    throw new Error('Not implemented');\n  }`;
  }).join('\n\n');
  const header = `// Generated from protocol.json (version ${spec.version}). Do not edit manually.`;
  return `${header}\nclass ${BRIDGE_NAME} {\n  static VERSION = "${version}";\n\n${methods}\n}\n\nmodule.exports = ${BRIDGE_NAME};\n`;
}

function renderJava(spec) {
  const version = String(spec.version ?? '');
  const methods = spec.methods.map(m => {
    const tags = [];
    if (m.min_version != null) tags.push(`@since ${m.min_version}`);
    const retInfo = pickReturn(m);
    if (retInfo.desc) tags.push(`@returns ${retInfo.desc}`);
    const descText = [m.desc, ...tags].filter(Boolean).join('\n');
    const desc = docComment(descText, '  ');
    const params = (m.params || [])
      .map(p => `${typeMap.java[normalizeType(p.type)] || 'Object'} ${p.name}`)
      .join(', ');
    const ret = typeMap.java[normalizeType(retInfo.type)] || 'Object';
    return `${desc}  ${ret} ${m.name}(${params});`;
  }).join('\n\n');
  const header = `// Generated from protocol.json (version ${spec.version}). Do not edit manually.`;
  return `${header}\npublic interface ${BRIDGE_NAME} {\n  String VERSION = "${version}";\n\n${methods}\n}\n`;
}

function renderObjc(spec) {
  const version = String(spec.version ?? '');
  const methods = spec.methods.map(m => {
    const tags = [];
    if (m.min_version != null) tags.push(`@since ${m.min_version}`);
    const retInfo = pickReturn(m);
    if (retInfo.desc) tags.push(`@returns ${retInfo.desc}`);
    const descText = [m.desc, ...tags].filter(Boolean).join('\n');
    const desc = docComment(descText, '/// ');
    const ret = typeMap.objc[normalizeType(retInfo.type)] || 'id';
    const params = m.params || [];
    if (!params.length) {
      return `${desc}- (${ret})${m.name};`;
    }
    const first = params[0];
    const firstType = typeMap.objc[normalizeType(first.type)] || 'id';
    const rest = params.slice(1).map(p => {
      const t = typeMap.objc[normalizeType(p.type)] || 'id';
      return `${p.name}:(${t})${p.name}`;
    });
    const tail = rest.length ? ' ' + rest.join(' ') : '';
    return `${desc}- (${ret})${m.name}:(${firstType})${first.name}${tail};`;
  }).join('\n\n');
  return `// Generated from protocol.json (version ${spec.version}). Do not edit manually.\n#import <Foundation/Foundation.h>\n\nNS_ASSUME_NONNULL_BEGIN\n#define ${BRIDGE_NAME.toUpperCase()}_VERSION @"${version}"\n@protocol ${BRIDGE_NAME}\n${methods}\n@end\nNS_ASSUME_NONNULL_END\n`;
}

function renderC(spec) {
  const version = String(spec.version ?? '');
  const methods = spec.methods.map(m => {
    const tags = [];
    if (m.min_version != null) tags.push(`@since ${m.min_version}`);
    const retInfo = pickReturn(m);
    if (retInfo.desc) tags.push(`@returns ${retInfo.desc}`);
    const descText = [m.desc, ...tags].filter(Boolean).join('\n');
    const desc = docComment(descText, '');
    const params = (m.params || [])
      .map(p => `${typeMap.cpp[normalizeType(p.type)] || 'void *'} ${p.name}`)
      .join(', ');
    const args = params || 'void';
    const ret = typeMap.cpp[normalizeType(retInfo.type)] || 'void *';
    return `${desc}${ret} ${BRIDGE_NAME}_${m.name}(${args});`;
  }).join('\n\n');
  const guard = `${BRIDGE_NAME.toUpperCase()}_HPP`;
  return `// Generated from protocol.json (version ${spec.version}). Do not edit manually.\n#ifndef ${guard}\n#define ${guard}\n\n#include <stdint.h>\n#include <stdbool.h>\n\n#define ${BRIDGE_NAME.toUpperCase()}_VERSION "${version}"\n\n#ifdef __cplusplus\nextern "C" {\n#endif\n\n${methods}\n\n#ifdef __cplusplus\n}\n#endif\n\n#endif // ${guard}\n`;
}

function main() {
  const spec = readSpec(PROTOCOL_PATH);
  const targets = parseTargets(process.argv.slice(2));
  const OUT_DIR = parseOutDir(process.argv.slice(2));

  ensureDir(OUT_DIR);

  if (targets.includes('ts')) {
    fs.writeFileSync(path.join(OUT_DIR, `${BRIDGE_NAME}.d.ts`), renderTs(spec));
  }
  if (targets.includes('js')) {
    fs.writeFileSync(path.join(OUT_DIR, `${BRIDGE_NAME}.js`), renderJs(spec));
  }
  if (targets.includes('java')) {
    fs.writeFileSync(path.join(OUT_DIR, `${BRIDGE_NAME}.java`), renderJava(spec));
  }
  if (targets.includes('objc')) {
    fs.writeFileSync(path.join(OUT_DIR, `${BRIDGE_NAME}.h`), renderObjc(spec));
  }
  if (targets.includes('cpp')) {
    fs.writeFileSync(path.join(OUT_DIR, `${BRIDGE_NAME}.hpp`), renderC(spec));
  }
  console.log(`Generated (${targets.join(',')}) in: ${OUT_DIR}`);
}

main();