// Vivi autocomplete provider
// I had to take a moment to myself after the first 90 lines to cry -Xansidev
const vscode = require('vscode');

// Language data. Signatures are "name(param, param)"; no parens = constant.

const MODULES = {
  Strings: [
    'index_of(s, needle)', 'is_digit(c)', 'has_prefix(s, prefix)', 'has_suffix(s, suffix)',
    'contains(s, needle)', 'substring(s, start, end)', 'split(s, sep)', 'join(a, b)',
    'replace(s, from, to)', 'trim(s)', 'to_upper(s)', 'to_lower(s)', 'reverse(s)',
    'to_pascal_case(s)', 'to_camel_case(s)', 'to_snake_case(s)',
  ],
  Math: [
    'pi', 'e', 'tau', 'inf', 'nan', 'epsilon', 'ln2', 'ln10',
    'abs(x)', 'min(a, b)', 'max(a, b)', 'clamp(x, lo, hi)', 'lerp(a, b, t)',
    'sign(x)', 'copysign(x, y)', 'trunc(x)', 'floor(x)', 'ceil(x)', 'round(x)',
    'fmod(x, y)', 'modf(x)', 'sqrt(x)', 'cbrt(x)', 'hypot(x, y)', 'pow(x, y)',
    'exp(x)', 'expm1(x)', 'log(x)', 'log10(x)', 'log2(x)',
    'sin(x)', 'cos(x)', 'tan(x)', 'asin(x)', 'acos(x)', 'atan(x)', 'atan2(y, x)',
    'sinh(x)', 'cosh(x)', 'tanh(x)', 'asinh(x)', 'acosh(x)', 'atanh(x)',
    'deg_to_rad(x)', 'rad_to_deg(x)', 'gcd(a, b)', 'lcm(a, b)', 'factorial(n)',
    'gamma(x)', 'erf(x)', 'erfc(x)',
  ],
  Io: [
    'println(...)', 'printf(fmt, ...)', 'eprint(...)', 'eprintln(...)', 'eprintf(fmt, ...)',
    'input(prompt)', 'read_line()',
    'file_write(path, text)', 'file_append(path, text)', 'file_exists(path)',
    'file_read(path)', 'file_lines(path)',
    'clear_screen()', 'clear_line()', 'cursor_to(x, y)', 'cursor_hide()', 'cursor_show()',
    'rgb(r, g, b, s)', 'bold(s)', 'dim(s)', 'italic(s)', 'underline(s)', 'inverse(s)',
    'red(s)', 'green(s)', 'blue(s)', 'yellow(s)', 'cyan(s)', 'bg_red(s)', 'bg_green(s)',
  ],
  Sys: [
    'run(cmd)', 'capture(cmd)', 'feed(cmd, input)', 'pipe(cmd_a, cmd_b)', 'redirect(cmd, path)',
  ],
  Time: [
    'program_start', 'now()', 'dt()', 'dateTime(t, tz)', 'getTime(t, tz, is24h)',
    'getMonth(i)', 'getDay(d, m, y)', 'getYear(y)', 'formatDate(day, month, year)',
  ],
  Json: [
    'json_parse(text)', 'json_parse_strict(text)', 'json_error()',
    'json_stringify(v)', 'json_pretty(v, indent)', 'json_quote(s)',
  ],
};

// Always available: _base.vivi + core/reflection/raw builtins
const PRELUDE = [
  'print(...)', 'panic(msg)', 'exit(code)',
  'malloc(size)', 'free(ptr)', 'memcpy(dst, src, n)', 'timestamp()', 'traceback()',
  'rand()', 'seed(n)', 'hash(s)', 'cast(value, type)',
  'type_of(v)', 'kind_of(v)', 'type_name(v)', 'fields(v)', 'methods(v)',
  'has_field(v, name)', 'has_method(v, name)', 'has_function(name)', 'has_type(name)',
  'has_symbol(name)', 'is_type(v)', 'is_exported(name)', 'symbols()', 'functions()',
  'types()', 'constants()', 'imports()', 'emit(code)', 'eval(code)',
  '_mmap(size)', '_munmap(ptr, size)', '_poke(ptr, value)', '_peek(ptr)',
];

const CORE_METHODS = [
  'len()', 'char_at(i)', 'push(v)', 'pop()', 'add(i, v)', 'take(i)', 'sort()', 'empty()',
];

const KEYWORDS = [
  'if', 'else', 'while', 'for', 'in', 'switch', 'default', 'break', 'continue',
  'return', 'fallthrough', 'try', 'catch', 'defer', 'and', 'or', 'not', 'as',
  'fn', 'struct', 'enum', 'ext', 'local', 'static', 'self', 'argc', 'argv',
];
const CONSTANTS = ['true', 'false', 'null'];
const TYPES = [
  'i8', 'i16', 'i32', 'i64', 'u8', 'u16', 'u32', 'u64', 'f16', 'f32', 'f64',
  'bool', 'string', 'rune', 'int', 'float', 'void',
];
const DIRECTIVES = [
  ['#import', '#import "${1|Strings,Math,Io,Sys,Time,Json|}"', 'Import a module'],
  ['#phrase', '#phrase ${1:name} :: (${2:cond}, block ${3:body}) {\n\t$0\n}', 'Grammar extension (top level only)'],
  ['#method', '#method ${1:i32} ${2:name} :: () {\n\t$0\n}', 'Method chained onto a value'],
  ['#proctime', '#proctime ', 'Compile-time (proctime) code'],
  ['#interop', '#interop ', 'Interop declaration'],
];

const SNIPPETS = [
  ['func', 'name :: (args) { }', '${1:name} :: (${2}) {\n\t$0\n}'],
  ['main', 'void main :: (argc, argv)', 'void main :: (argc, argv) {\n\t$0\n}'],
  ['struct', 'struct block', 'struct ${1:Name} {\n\ti32 ${2:x}: 0,\n\ti32 ${3:y}: 0\n}'],
  ['enum', 'enum block', 'enum ${1:Name} {\n\t${2:A},\n\t${3:B}\n}'],
  ['for', 'for i := 0; i < n; i++', 'for ${1:i} := 0; $1 < ${2:n}; $1++ {\n\t$0\n}'],
  ['forin', 'for v in arr', 'for ${1:v} in ${2:arr} {\n\t$0\n}'],
  ['forr', 'for 0..n', 'for ${1:0}..${2:10} {\n\t$0\n}'],
  ['if', 'if block', 'if ${1:cond} {\n\t$0\n}'],
  ['ifelse', 'if / else', 'if ${1:cond} {\n\t$2\n} else {\n\t$0\n}'],
  ['while', 'while block', 'while ${1:cond} {\n\t$0\n}'],
  ['switch', 'switch block', 'switch ${1:value} {\n\t${2:1}:\n\t\t$3\n\tdefault:\n\t\t$0\n}'],
  ['try', 'try / catch', 'try {\n\t$1\n} catch (${2:err}) {\n\t$0\n}'],
  ['defer', 'defer statement', 'defer ${0}'],
  ['lambda', 'anonymous fn', '(${1}) {\n\t$0\n}'],
];

// Helpers

function parseSig(sig) {
  const i = sig.indexOf('(');
  if (i === -1) return { name: sig, params: null };
  const inner = sig.slice(i + 1, sig.lastIndexOf(')')).trim();
  return { name: sig.slice(0, i), params: inner ? inner.split(',').map((s) => s.trim()) : [] };
}

function fnItem(sig, detail, kind) {
  const { name, params } = parseSig(sig);
  const item = new vscode.CompletionItem(
    name,
    params === null ? vscode.CompletionItemKind.Constant : kind || vscode.CompletionItemKind.Function
  );
  item.detail = detail ? `${sig}  (${detail})` : sig;
  if (params !== null) {
    const body = params.map((p, i) => `\${${i + 1}:${p}}`).join(', ');
    item.insertText = new vscode.SnippetString(`${name}(${body})`);
  }
  return item;
}

function parseImports(text) {
  const imports = [];
  const re = /^\s*#import\s+"(\w+)"(?:\s+as\s+(\w+))?/gm;
  let m;
  while ((m = re.exec(text))) imports.push({ module: m[1], alias: m[2] || null });
  return imports;
}

function parseSymbols(text) {
  const out = new Map();
  let m;
  const decl = /\b([A-Za-z_]\w*)\s*(?:::|:=)\s*(\()?/g;
  while ((m = decl.exec(text))) {
    if (!out.has(m[1])) out.set(m[1], m[2] ? 'function' : 'variable');
  }
  const typ = /\b(struct|enum)\s+([A-Za-z_]\w*)/g;
  while ((m = typ.exec(text))) out.set(m[2], m[1]);
  return out;
}

function parseEnums(text) {
  const enums = new Map();
  const re = /\benum\s+(\w+)\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(text))) {
    enums.set(m[1], m[2].split(',').map((s) => s.trim()).filter(Boolean));
  }
  return enums;
}

function parseUserMethods(text) {
  const names = new Set();
  const re = /#method\s+(?:[\w\[\]|]+\s+)?(\w+)\s*(?:::|:=)/g;
  let m;
  while ((m = re.exec(text))) names.add(m[1]);
  return names;
}

function parsePhrases(text) {
  const names = new Set();
  const re = /#phrase\s+(?:[\w\[\]|]+\s+)?(\w+)\s*(?:::|:=)/g;
  let m;
  while ((m = re.exec(text))) names.add(m[1]);
  return names;
}

function insideString(prefix) {
  let open = false;
  for (let i = 0; i < prefix.length; i++) {
    if (prefix[i] === '\\') { i++; continue; }
    if (prefix[i] === '"') open = !open;
  }
  return open;
}

function allModuleNames() {
  const extra = vscode.workspace.getConfiguration('vivi').get('extraModules', []);
  return [...new Set([...Object.keys(MODULES), ...extra])];
}

// Provider

const provider = {
  provideCompletionItems(doc, pos) {
    const prefix = doc.lineAt(pos).text.slice(0, pos.character);
    const text = doc.getText();
    const Kind = vscode.CompletionItemKind;

    // 1) #import "<module>"  ->  list modules not yet imported
    let m = /#import\s+"(\w*)$/.exec(prefix);
    if (m) {
      const imported = new Set(parseImports(text).map((i) => i.module));
      const range = new vscode.Range(pos.line, pos.character - m[1].length, pos.line, pos.character);
      return allModuleNames()
        .filter((n) => !imported.has(n))
        .map((n) => {
          const it = new vscode.CompletionItem(n, Kind.Module);
          it.range = range;
          it.detail = MODULES[n] ? `Vivi module (${MODULES[n].length} exports)` : 'Vivi module';
          return it;
        });
    }

    // Skip comments and other strings
    if (/^\s*(\/\/|;;|# )/.test(prefix) || /\/\/|;;/.test(prefix.replace(/"[^"]*"/g, ''))) return undefined;
    if (insideString(prefix)) return undefined;

    // 2) #directive  ->  #import / #phrase / #method
    m = /#(\w*)$/.exec(prefix);
    if (m) {
      const range = new vscode.Range(pos.line, pos.character - m[0].length, pos.line, pos.character);
      return DIRECTIVES.map(([label, snip, detail]) => {
        const it = new vscode.CompletionItem(label, Kind.Keyword);
        it.insertText = new vscode.SnippetString(snip);
        it.range = range;
        it.filterText = label;
        it.detail = detail;
        return it;
      });
    }

    // 3) member access: alias. / Enum. / value.
    m = /([A-Za-z_]\w*)\.(\w*)$/.exec(prefix);
    if (m) {
      const [, head] = m;
      const imports = parseImports(text);
      const imp = imports.find((i) => i.alias === head);
      if (imp && MODULES[imp.module]) {
        return MODULES[imp.module].map((s) => fnItem(s, imp.module));
      }
      const enums = parseEnums(text);
      if (enums.has(head)) {
        return enums.get(head).map((n) => {
          const it = new vscode.CompletionItem(n, Kind.EnumMember);
          it.detail = `enum ${head}`;
          return it;
        });
      }
      const items = CORE_METHODS.map((s) => fnItem(s, 'method', Kind.Method));
      for (const n of parseUserMethods(text)) {
        const it = new vscode.CompletionItem(n, Kind.Method);
        it.detail = '#method';
        items.push(it);
      }
      // flat-imported functions can be chained too (s.to_upper())
      for (const imp2 of imports.filter((i) => !i.alias)) {
        for (const s of MODULES[imp2.module] || []) {
          if (s.includes('(')) items.push(fnItem(s, imp2.module, Kind.Method));
        }
      }
      return items;
    }

    // 4) general completions
    const items = [];
    for (const k of KEYWORDS) items.push(new vscode.CompletionItem(k, Kind.Keyword));
    for (const k of CONSTANTS) items.push(new vscode.CompletionItem(k, Kind.Constant));
    for (const t of TYPES) items.push(new vscode.CompletionItem(t, Kind.TypeParameter));

    for (const [label, detail, body] of SNIPPETS) {
      const it = new vscode.CompletionItem(label, Kind.Snippet);
      it.insertText = new vscode.SnippetString(body);
      it.detail = detail;
      items.push(it);
    }

    for (const s of PRELUDE) items.push(fnItem(s, 'prelude'));
    for (const imp of parseImports(text)) {
      if (imp.alias || !MODULES[imp.module]) continue; // namespaced -> only via alias.
      for (const s of MODULES[imp.module]) items.push(fnItem(s, imp.module));
    }
    for (const imp of parseImports(text)) {
      if (!imp.alias) continue;
      const it = new vscode.CompletionItem(imp.alias, Kind.Module);
      it.detail = `namespace for ${imp.module}`;
      items.push(it);
    }

    for (const p of parsePhrases(text)) items.push(new vscode.CompletionItem(p, Kind.Keyword));

    for (const [name, what] of parseSymbols(text)) {
      const kind =
        what === 'function' ? Kind.Function :
        what === 'struct' ? Kind.Struct :
        what === 'enum' ? Kind.Enum : Kind.Variable;
      const it = new vscode.CompletionItem(name, kind);
      it.detail = what;
      it.sortText = '0' + name; // your own symbols first (its not my language so i say "your" outwards.)
      items.push(it);
    }
    return items;
  },
};

function activate(context) {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider('vivi', provider, '#', '.', '"')
  );
}

function deactivate() {}

module.exports = { activate, deactivate };