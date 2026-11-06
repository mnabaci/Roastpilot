const WORDS: Readonly<Record<string, unknown>> = {
  True: true,
  true: true,
  False: false,
  false: false,
  None: null,
  null: null,
  nan: NaN,
  NaN: NaN,
  inf: Infinity,
};

const ESCAPES: Readonly<Record<string, string>> = { n: '\n', r: '\r', t: '\t' };

/**
 * Reads a Python literal (dicts, lists, tuples, strings, numbers, True/False/None), which also
 * covers JSON. Artisan saves `.alog` files with Python's `repr`. Throws on anything else.
 */
export function parsePythonLiteral(text: string): unknown {
  let at = 0;
  const fail = (): never => {
    throw new Error(`Unexpected input at offset ${String(at)}`);
  };
  const skipSpace = () => {
    while (/\s/.test(text.charAt(at))) at++;
  };

  const readString = (): string => {
    const quote = text.charAt(at++);
    let out = '';
    for (;;) {
      if (at >= text.length) return fail();
      const char = text.charAt(at++);
      if (char === quote) return out;
      if (char !== '\\') {
        out += char;
        continue;
      }
      const escape = text.charAt(at++);
      const hexLength = escape === 'x' ? 2 : escape === 'u' ? 4 : 0;
      if (hexLength > 0) {
        const code = Number.parseInt(text.slice(at, at + hexLength), 16);
        if (Number.isNaN(code)) return fail();
        out += String.fromCharCode(code);
        at += hexLength;
      } else {
        out += ESCAPES[escape] ?? escape;
      }
    }
  };

  const readSequence = (close: string): unknown[] => {
    at++;
    const items: unknown[] = [];
    for (;;) {
      skipSpace();
      if (text.charAt(at) === close) {
        at++;
        return items;
      }
      items.push(readValue());
      skipSpace();
      if (text.charAt(at) === ',') at++;
      else if (text.charAt(at) !== close) return fail();
    }
  };

  const readDict = (): Record<string, unknown> => {
    at++;
    const entries: [string, unknown][] = [];
    for (;;) {
      skipSpace();
      if (text.charAt(at) === '}') {
        at++;
        // fromEntries defines own properties, so a `__proto__` key in a file stays plain data.
        return Object.fromEntries(entries);
      }
      const key = readValue();
      skipSpace();
      if (text.charAt(at++) !== ':') return fail();
      entries.push([String(key), readValue()]);
      skipSpace();
      if (text.charAt(at) === ',') at++;
      else if (text.charAt(at) !== '}') return fail();
    }
  };

  const readWord = (): unknown => {
    const match = /^[-+]?(?:\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+|[A-Za-z]+)/.exec(
      text.slice(at, at + 64),
    );
    if (!match) return fail();
    const word = match[0];
    at += word.length;
    if (/^[-+]?[.\d]/.test(word)) return Number(word);
    const negative = word.startsWith('-');
    const name = word.replace(/^[-+]/, '');
    if (!Object.hasOwn(WORDS, name)) return fail();
    return negative ? -Number(WORDS[name]) : WORDS[name];
  };

  function readValue(): unknown {
    skipSpace();
    const char = text.charAt(at);
    if (char === '{') return readDict();
    if (char === '[') return readSequence(']');
    if (char === '(') return readSequence(')');
    if (char === "'" || char === '"') return readString();
    // Files from Python 2 versions of Artisan mark strings u'...'.
    if (char === 'u' && /['"]/.test(text.charAt(at + 1))) {
      at++;
      return readString();
    }
    return readWord();
  }

  const value = readValue();
  skipSpace();
  if (at < text.length) fail();
  return value;
}
