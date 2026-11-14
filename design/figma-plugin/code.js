// Roastpilot design system builder: finishes the components, the record header and an example
// screen in the "Roastpilot Design System" Figma file. Run it from that file
// (Plugins > Development > Roastpilot design system builder). Every step checks first and skips
// what's already there, so running it twice is safe. It needs the variables, styles, icons and
// components already in the file (Color, Dimensions, Text/*, Control/*, Button, Badge, ...).

const STEPS = [];
const step = (name, fn) => STEPS.push({ name, fn });

// ---------- helpers ----------
let page, coverPage, V, P, TS;
const FONTS = ['Regular', 'Medium', 'Semi Bold', 'Bold'];

async function setup() {
  for (const style of FONTS) await figma.loadFontAsync({ family: 'Inter', style });
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const prim = collections.find((c) => c.name === 'Primitives');
  if (!prim)
    throw new Error('No Primitives collection: run this in the Roastpilot Design System file');
  const vars = await figma.variables.getLocalVariablesAsync();
  V = (name) => {
    const v = vars.find((x) => x.name === name && x.variableCollectionId !== prim.id);
    if (!v) throw new Error(`Variable not found: ${name}`);
    return v;
  };
  P = (name) =>
    figma.variables.setBoundVariableForPaint(
      { type: 'SOLID', color: { r: 0, g: 0, b: 0 } },
      'color',
      V(name),
    );
  const styles = await figma.getLocalTextStylesAsync();
  TS = (name) => {
    const s = styles.find((x) => x.name === name);
    if (!s) throw new Error(`Text style not found: ${name}`);
    return s.id;
  };
  page = figma.root.children.find((p) => p.name === 'Components');
  coverPage = figma.root.children.find((p) => p.name === 'Cover');
  if (!page || !coverPage) throw new Error('Pages "Cover" and "Components" are needed');
  await coverPage.loadAsync();
  await figma.setCurrentPageAsync(page);
}

function radius(node, name) {
  for (const k of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'])
    node.setBoundVariable(k, V(name));
}
async function T(chars, style, color, name) {
  const t = figma.createText();
  t.autoRename = false;
  if (name) t.name = name;
  await t.setTextStyleIdAsync(TS(style));
  t.characters = chars;
  t.fills = [P(color)];
  return t;
}
/** An auto-layout frame that hugs its content, with no fill. */
function AL(dir, props) {
  const f = figma.createFrame();
  f.layoutMode = dir;
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = 'AUTO';
  f.fills = [];
  f.clipsContent = false;
  if (props) Object.assign(f, props);
  return f;
}
function fixedBox(dir, w, h, props) {
  const f = AL(dir, props);
  f.resize(w, h);
  f.primaryAxisSizingMode = 'FIXED';
  f.counterAxisSizingMode = 'FIXED';
  return f;
}
const pageBottom = (p) => Math.max(0, ...p.children.map((n) => n.y + n.height));
async function doc(name, desc, content) {
  const d = AL('VERTICAL', {
    name: `${name} · docs`,
    itemSpacing: 16,
    paddingLeft: 48,
    paddingRight: 48,
    paddingTop: 48,
    paddingBottom: 48,
  });
  d.fills = [P('surface/default')];
  radius(d, 'radius/xl');
  d.appendChild(await T(name, 'Text/Title', 'ink/default'));
  const t = await T(desc, 'Text/Body', 'ink/muted');
  d.appendChild(t);
  t.textAutoResize = 'HEIGHT';
  t.resize(640, t.height);
  const y = pageBottom(page) + 80;
  d.appendChild(content);
  page.appendChild(d);
  d.x = 0;
  d.y = y;
  return d;
}
function fit(set) {
  set.fills = [P('bg')];
  set.resize(
    Math.max(...set.children.map((c) => c.x + c.width)) + 24,
    Math.max(...set.children.map((c) => c.y + c.height)) + 24,
  );
}
function stack(set, gap = 24) {
  let y = 24;
  for (const c of set.children) {
    c.x = 24;
    c.y = y;
    y += c.height + gap;
  }
}
function row(set, gap = 24) {
  let x = 24;
  for (const c of set.children) {
    c.y = 24;
    c.x = x;
    x += c.width + gap;
  }
}
function gridPlace(set, cols, gapX = 24, gapY = 24) {
  const w = Math.max(...set.children.map((c) => c.width));
  const h = Math.max(...set.children.map((c) => c.height));
  set.children.forEach((c, i) => {
    c.x = 24 + (i % cols) * (w + gapX);
    c.y = 24 + Math.floor(i / cols) * (h + gapY);
  });
}
const has = (name) => page.findOne((x) => x.type === 'COMPONENT_SET' && x.name === name);
const need = (name) => {
  const s = has(name);
  if (!s) throw new Error(`Needs component set ${name}`);
  return s;
};
const icon = (name) => {
  const c = page.findOne((x) => x.type === 'COMPONENT' && x.name === `Icon/${name}`);
  if (!c) throw new Error(`Needs Icon/${name}`);
  return c;
};
function tint(node, color, fill) {
  for (const n of node.findAll((n) => 'strokes' in n && n.strokes.length)) {
    n.strokes = [P(color)];
    if (fill) n.fills = [P(color)];
  }
}
function inst(name, color, size) {
  const i = icon(name).createInstance();
  i.name = 'Icon';
  tint(i, color);
  if (size) i.rescale(size / 20);
  return i;
}
const key = (set, prefix) =>
  Object.keys(set.componentPropertyDefinitions).find((k) => k.startsWith(`${prefix}#`));
function variant(setName, variantName, props) {
  const set = need(setName);
  const v = set.children.find((c) => c.name === variantName);
  if (!v) throw new Error(`${setName} has no variant ${variantName}`);
  const i = v.createInstance();
  if (props) {
    const mapped = {};
    for (const [k, val] of Object.entries(props)) mapped[key(set, k)] = val;
    i.setProperties(mapped);
  }
  return i;
}
const button = (variantName, size, label) =>
  variant('Button', `Variant=${variantName}, Size=${size}, State=Default`, { Label: label });
function combine(comps, name, description) {
  const set = figma.combineAsVariants(comps, page);
  set.name = name;
  set.description = description;
  return set;
}
function bindText(set, prop, def, nodes, extra) {
  const k = set.addComponentProperty(prop, 'TEXT', def);
  for (const n of nodes)
    n.componentPropertyReferences = Object.assign({ characters: k }, extra || {});
  return k;
}
function focusRing(node) {
  const c = V('focus');
  node.effects = [
    figma.variables.setBoundVariableForEffect(
      {
        type: 'DROP_SHADOW',
        color: { r: 0.3, g: 0.83, b: 0.94, a: 1 },
        offset: { x: 0, y: 0 },
        radius: 0,
        spread: 2,
        visible: true,
        blendMode: 'NORMAL',
      },
      'color',
      c,
    ),
  ];
}
function newComponent(name, dir) {
  const c = figma.createComponent();
  c.name = name;
  c.fills = [];
  if (dir) {
    c.layoutMode = dir;
    c.primaryAxisSizingMode = 'AUTO';
    c.counterAxisSizingMode = 'AUTO';
  }
  return c;
}

// ---------- inputs ----------
step('TextAreaField', async () => {
  if (has('TextAreaField')) return 'skip';
  const comps = [],
    labels = [],
    vals = [];
  for (const st of ['Default', 'Hover', 'Focus', 'Disabled']) {
    const c = newComponent(`State=${st}`, 'VERTICAL');
    c.itemSpacing = 6;
    c.resize(320, 100);
    c.counterAxisSizingMode = 'FIXED';
    c.primaryAxisSizingMode = 'AUTO';
    if (st === 'Disabled') c.opacity = 0.5;
    const l = await T('Notes', 'Text/Label', 'ink/muted', 'Label');
    c.appendChild(l);
    labels.push(l);
    const box = AL('VERTICAL', {
      name: 'Input',
      paddingLeft: 14,
      paddingRight: 14,
      paddingTop: 10,
      paddingBottom: 10,
    });
    box.fills = [P('surface/default')];
    box.strokes = [P(st === 'Hover' || st === 'Focus' ? 'border/strong' : 'border/default')];
    box.strokeWeight = 1;
    radius(box, 'radius/md');
    if (st === 'Focus') focusRing(box);
    c.appendChild(box);
    box.layoutSizingHorizontal = 'FILL';
    box.minHeight = 44;
    const v = await T(
      'Bergamot | Jasmine | Peach. Rest 3 days before brewing.',
      'Text/Body',
      'ink/default',
      'Value',
    );
    box.appendChild(v);
    v.layoutSizingHorizontal = 'FILL';
    v.textAutoResize = 'HEIGHT';
    vals.push(v);
    comps.push(c);
  }
  const set = combine(
    comps,
    'TextAreaField',
    'Multi-line text that grows with its content up to 192px, then scrolls. Code: TextAreaField.tsx',
  );
  bindText(set, 'Label', 'Notes', labels);
  bindText(set, 'Value', 'Bergamot | Jasmine | Peach. Rest 3 days before brewing.', vals);
  row(set, 32);
  fit(set);
  await doc('TextAreaField', 'Default, Hover, Focus, Disabled. Grows with its text.', set);
});

step('Select/Option', async () => {
  if (has('Select/Option')) return 'skip';
  const comps = [],
    names = [],
    details = [];
  for (const sel of ['No', 'Yes'])
    for (const hl of ['No', 'Yes']) {
      const c = newComponent(`Selected=${sel}, Highlighted=${hl}`, 'HORIZONTAL');
      c.counterAxisAlignItems = 'CENTER';
      c.itemSpacing = 8;
      c.paddingLeft = c.paddingRight = 12;
      c.paddingTop = c.paddingBottom = 6;
      c.resize(280, 44);
      c.primaryAxisSizingMode = 'FIXED';
      c.counterAxisSizingMode = 'AUTO';
      c.minHeight = 44;
      radius(c, 'radius/md');
      c.fills = hl === 'Yes' ? [P('surface/hover')] : [];
      const ch = inst('check', 'ink/default', 16);
      ch.name = 'Check';
      ch.opacity = sel === 'Yes' ? 1 : 0;
      c.appendChild(ch);
      const col = AL('VERTICAL', { name: 'Text' });
      c.appendChild(col);
      col.layoutSizingHorizontal = 'FILL';
      const n = await T('Ethiopia Guji', 'Text/Body', 'ink/default', 'Name');
      col.appendChild(n);
      names.push(n);
      const d = await T('1,250 g · washed', 'Text/Label', 'ink/muted', 'Detail');
      col.appendChild(d);
      details.push(d);
      comps.push(c);
    }
  const set = combine(
    comps,
    'Select/Option',
    'One option in a Select list: a check when chosen, the name, an optional detail line.',
  );
  bindText(set, 'Name', 'Ethiopia Guji', names);
  const show = set.addComponentProperty('Show detail', 'BOOLEAN', true);
  bindText(set, 'Detail', '1,250 g · washed', details, { visible: show });
  gridPlace(set, 2);
  fit(set);
  await doc(
    'Select/Option',
    'Columns: not highlighted, highlighted. Rows: not selected, selected.',
    set,
  );
});

step('Select', async () => {
  if (has('Select')) return 'skip';
  const opt = need('Select/Option');
  const c = newComponent('Search=Yes', 'VERTICAL');
  c.itemSpacing = 2;
  c.paddingLeft = c.paddingRight = c.paddingTop = c.paddingBottom = 4;
  c.resize(288, 200);
  c.counterAxisSizingMode = 'FIXED';
  c.primaryAxisSizingMode = 'AUTO';
  c.fills = [P('surface/raised')];
  c.strokes = [P('border/strong')];
  c.strokeWeight = 1;
  radius(c, 'radius/lg');
  const sr = AL('HORIZONTAL', {
    name: 'Search',
    itemSpacing: 8,
    counterAxisAlignItems: 'CENTER',
    paddingLeft: 12,
    paddingRight: 12,
  });
  c.appendChild(sr);
  sr.layoutSizingHorizontal = 'FILL';
  sr.counterAxisSizingMode = 'FIXED';
  sr.resize(sr.width, 44);
  sr.strokes = [P('border/default')];
  sr.strokeTopWeight = 0;
  sr.strokeLeftWeight = 0;
  sr.strokeRightWeight = 0;
  sr.strokeBottomWeight = 1;
  sr.appendChild(inst('search', 'ink/muted', 16));
  sr.appendChild(await T('Search…', 'Text/Body', 'ink/muted', 'Placeholder'));
  for (const [n, d, sel, hl] of [
    ['Colombia Huila', '625 g · natural', 'No', 'No'],
    ['Ethiopia Guji', '1,250 g · washed', 'Yes', 'No'],
    ['Kenya Nyeri', '300 g · washed', 'No', 'Yes'],
  ]) {
    const o = opt.children
      .find((x) => x.name === `Selected=${sel}, Highlighted=${hl}`)
      .createInstance();
    o.setProperties({ [key(opt, 'Name')]: n, [key(opt, 'Detail')]: d });
    c.appendChild(o);
    o.layoutSizingHorizontal = 'FILL';
  }
  const set = combine(
    [c],
    'Select',
    'The list a SelectField opens: as wide as its field (min 192px), search on top when there are many options, 384px max then scrolls. Same panel as Menu. Code: Select.tsx',
  );
  stack(set);
  fit(set);
  await doc('Select', 'Open list with search, a chosen option and a highlighted one.', set);
});

step('FilterSelect', async () => {
  if (has('FilterSelect')) return 'skip';
  const comps = [],
    labels = [];
  for (const act of ['No', 'Yes']) {
    const c = newComponent(`Active=${act}`, 'HORIZONTAL');
    c.counterAxisAlignItems = 'CENTER';
    c.primaryAxisAlignItems = 'CENTER';
    c.itemSpacing = 4;
    c.paddingLeft = c.paddingRight = 10;
    c.resize(100, 44);
    c.primaryAxisSizingMode = 'AUTO';
    c.counterAxisSizingMode = 'FIXED';
    radius(c, 'radius/md');
    c.fills = [P(act === 'Yes' ? 'heat/tint' : 'surface/raised')];
    const col = act === 'Yes' ? 'heat/default' : 'ink/default';
    const t = await T(act === 'Yes' ? 'Ethiopia Guji' : 'All beans', 'Control/SM', col, 'Label');
    c.appendChild(t);
    labels.push(t);
    c.appendChild(inst('chevron-down', col, 16));
    comps.push(c);
  }
  const set = combine(
    comps,
    'FilterSelect',
    'A compact filter chip over a list (History). Quiet while it shows everything; heat-tint once it filters. Code: FilterSelect.tsx',
  );
  bindText(set, 'Label', 'All beans', labels);
  row(set);
  fit(set);
  await doc('FilterSelect', 'Inactive (no filter) and Active.', set);
});

step('StarRating', async () => {
  if (has('StarRating')) return 'skip';
  const comps = [];
  for (const mode of ['Read', 'Edit'])
    for (const val of [0, 1, 2, 3, 4, 5]) {
      const c = newComponent(`Mode=${mode}, Value=${val}`, 'HORIZONTAL');
      c.counterAxisAlignItems = 'CENTER';
      c.itemSpacing = mode === 'Read' ? 1 : 0;
      for (let s = 1; s <= 5; s++) {
        const col = s <= val ? (mode === 'Read' ? 'ink/default' : 'heat/default') : 'border/strong';
        const star = icon('star').createInstance();
        star.name = `Star ${s}`;
        tint(star, col, true);
        if (mode === 'Read') {
          star.rescale(14 / 20);
          c.appendChild(star);
        } else {
          const b = fixedBox('HORIZONTAL', 44, 44, {
            name: `Star ${s}`,
            primaryAxisAlignItems: 'CENTER',
            counterAxisAlignItems: 'CENTER',
          });
          star.rescale(24 / 20);
          b.appendChild(star);
          c.appendChild(b);
        }
      }
      comps.push(c);
    }
  const set = combine(
    comps,
    'StarRating',
    'A roast’s rating. Read: 14px stars in tables. Edit: five 44px buttons with 24px stars; hover previews. Code: StarRating.tsx',
  );
  set.children.forEach((c, i) => {
    c.x = i < 6 ? 24 : 160;
    c.y = 24 + (i % 6) * 52;
  });
  fit(set);
  await doc('StarRating', 'Columns: Read, Edit. Rows: 0 to 5 stars.', set);
});

// ---------- brand, navigation, layout ----------
const BEAN = 'M32 8 C 47 8 52 21 52 32 C 52 44 45 56 32 56 C 17 56 12 44 12 32 C 12 20 18 8 32 8 Z';
const CUT = 'M32 6 C 24 18 25 26 32 32 C 39 38 40 46 32 58';

step('Mark', async () => {
  if (has('Mark')) return 'skip';
  const comps = [];
  for (const withName of ['No', 'Yes']) {
    const c = newComponent(`Name=${withName}`, 'HORIZONTAL');
    c.itemSpacing = 8;
    c.counterAxisAlignItems = 'CENTER';
    const svg = figma.createNodeFromSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><clipPath id="b"><path d="${BEAN}" transform="rotate(-40 32 32)"/></clipPath></defs><rect width="64" height="64" rx="16" fill="#FF6B3D"/><g transform="rotate(-40 32 32)"><path d="${BEAN}" fill="#0B0C0E"/></g><g clip-path="url(#b)"><path d="${CUT}" transform="rotate(-40 32 32)" fill="none" stroke="#FF6B3D" stroke-width="4.2" stroke-linecap="round"/></g></svg>`,
    );
    svg.name = 'Tile';
    svg.fills = [];
    for (const n of svg.findAll(() => true)) {
      if ('fills' in n && Array.isArray(n.fills) && n.fills.length && n.fills[0].type === 'SOLID') {
        const { r } = n.fills[0].color;
        n.fills = [P(r > 0.5 ? 'heat/fill' : 'bg')];
      }
      if ('strokes' in n && n.strokes.length) n.strokes = [P('heat/fill')];
    }
    svg.rescale(24 / 64);
    c.appendChild(svg);
    if (withName === 'Yes')
      c.appendChild(await T('Roastpilot', 'Text/Heading', 'ink/default', 'Name'));
    comps.push(c);
  }
  const set = combine(
    comps,
    'Mark',
    'The Roastpilot mark: a roasted bean with its centre cut on an ember tile, 24px. With the name in the top bar. Code: Mark.tsx, mark-paths.ts',
  );
  row(set, 48);
  fit(set);
  await doc('Mark', 'Tile alone, and with the name.', set);
});

step('Cover: use the Mark', async () => {
  const cover = coverPage.findOne((n) => n.type === 'FRAME' && n.name === 'Cover');
  if (!cover) return 'skip';
  const dot = cover.findOne((n) => n.name === 'Ember');
  if (!dot) return 'skip';
  const parent = dot.parent;
  const idx = parent.children.indexOf(dot);
  const m = variant('Mark', 'Name=No');
  m.rescale(40 / 24);
  parent.insertChild(idx, m);
  dot.remove();
});

step('NavList/Item', async () => {
  if (has('NavList/Item')) return 'skip';
  const comps = [],
    labels = [],
    details = [];
  for (const st of ['Default', 'Hover', 'Open']) {
    const c = newComponent(`State=${st}`, 'HORIZONTAL');
    c.counterAxisAlignItems = 'CENTER';
    c.itemSpacing = 8;
    c.paddingLeft = c.paddingRight = 12;
    c.paddingTop = c.paddingBottom = 6;
    c.resize(232, 44);
    c.primaryAxisSizingMode = 'FIXED';
    c.counterAxisSizingMode = 'AUTO';
    c.minHeight = 44;
    radius(c, 'radius/md');
    c.fills = st === 'Open' ? [P('surface/raised')] : st === 'Hover' ? [P('surface/hover')] : [];
    const col = AL('VERTICAL', { name: 'Text' });
    c.appendChild(col);
    col.layoutSizingHorizontal = 'FILL';
    const l = await T(
      'Ethiopia Guji',
      'Text/Body',
      st === 'Default' ? 'ink/muted' : 'ink/default',
      'Label',
    );
    col.appendChild(l);
    labels.push(l);
    const d = await T('1,250 g · Ethiopia · washed', 'Text/Label', 'ink/muted', 'Detail');
    col.appendChild(d);
    details.push(d);
    comps.push(c);
  }
  const set = combine(
    comps,
    'NavList/Item',
    'One record in the sidebar list: name and a detail line. The open one sits on surface-raised; the others are muted until hovered.',
  );
  bindText(set, 'Label', 'Ethiopia Guji', labels);
  const show = set.addComponentProperty('Show detail', 'BOOLEAN', true);
  bindText(set, 'Detail', '1,250 g · Ethiopia · washed', details, { visible: show });
  stack(set, 12);
  fit(set);
  await doc('NavList/Item', 'Default (muted), Hover, Open.', set);
});

async function navList() {
  const list = AL('VERTICAL', { name: 'NavList', itemSpacing: 4 });
  for (const [label, detail, st] of [
    ['Colombia Huila', '625 g · Colombia · natural', 'Default'],
    ['Ethiopia Guji', '1,250 g · Ethiopia · washed', 'Open'],
    ['Kenya Nyeri', '300 g · Kenya · washed', 'Default'],
  ])
    list.appendChild(variant('NavList/Item', `State=${st}`, { Label: label, Detail: detail }));
  return list;
}

step('NavList', async () => {
  if (has('NavList')) return 'skip';
  const c = newComponent('Mode=Open', 'VERTICAL');
  c.itemSpacing = 4;
  const list = await navList();
  for (const n of [...list.children]) c.appendChild(n);
  list.remove();
  const set = combine(
    [c],
    'NavList',
    'The sidebar list of records (Beans, Profiles, Roasters, Settings): one open at a time. In select mode each row gets a tick box. Code: NavList.tsx',
  );
  stack(set);
  fit(set);
  await doc('NavList', 'Three beans, the middle one open.', set);
});

step('ErrorState', async () => {
  if (has('ErrorState')) return 'skip';
  const c = newComponent('Type=Default', 'VERTICAL');
  c.counterAxisAlignItems = 'CENTER';
  c.itemSpacing = 16;
  c.paddingLeft = c.paddingRight = 20;
  c.paddingTop = c.paddingBottom = 32;
  c.resize(480, 200);
  c.counterAxisSizingMode = 'FIXED';
  c.primaryAxisSizingMode = 'AUTO';
  c.appendChild(inst('triangle-alert', 'status/warning', 32));
  const title = await T('Roasters hit a problem', 'Text/Heading', 'ink/default', 'Title');
  c.appendChild(title);
  const detail = await T(
    'Cannot read properties of undefined (reading ‘includes’)',
    'Text/Body',
    'ink/muted',
    'Detail',
  );
  c.appendChild(detail);
  const actions = AL('HORIZONTAL', { name: 'Actions', itemSpacing: 8 });
  actions.appendChild(button('Primary', 'MD', 'Reload'));
  actions.appendChild(button('Ghost', 'MD', 'Open log folder'));
  c.appendChild(actions);
  const set = combine(
    [c],
    'ErrorState',
    'When a screen fails to render: what broke, the error in one line (full text in a tooltip), Reload and Open log folder. Code: ErrorState.tsx',
  );
  bindText(set, 'Title', 'Roasters hit a problem', [title]);
  bindText(set, 'Detail', 'Cannot read properties of undefined (reading ‘includes’)', [detail]);
  stack(set);
  fit(set);
  await doc('ErrorState', 'Centred, 480px wide.', set);
});

step('SidebarLayout', async () => {
  if (has('SidebarLayout')) return 'skip';
  const c = newComponent('Type=Default', 'HORIZONTAL');
  c.resize(1200, 720);
  c.primaryAxisSizingMode = 'FIXED';
  c.counterAxisSizingMode = 'FIXED';
  c.fills = [P('bg')];
  const side = AL('VERTICAL', {
    name: 'Sidebar',
    itemSpacing: 12,
    paddingTop: 24,
    paddingBottom: 24,
    paddingLeft: 24,
  });
  c.appendChild(side);
  side.resize(256, 720);
  side.primaryAxisSizingMode = 'FIXED';
  side.counterAxisSizingMode = 'FIXED';
  side.layoutSizingVertical = 'FILL';
  const head = AL('HORIZONTAL', {
    name: 'Header',
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    counterAxisAlignItems: 'CENTER',
    paddingRight: 12,
  });
  side.appendChild(head);
  head.layoutSizingHorizontal = 'FILL';
  head.minHeight = 44;
  const title = await T('Beans', 'Text/Title', 'ink/default', 'Title');
  head.appendChild(title);
  head.appendChild(variant('Menu', 'Open=No'));
  const list = await navList();
  side.appendChild(list);
  list.layoutSizingHorizontal = 'FILL';
  const add = button('Ghost', 'SM', 'Add bean');
  add.setProperties({ [key(need('Button'), 'Show icon')]: true });
  side.appendChild(add);
  const main = AL('VERTICAL', {
    name: 'Main',
    paddingLeft: 24,
    paddingRight: 24,
    paddingTop: 24,
    paddingBottom: 24,
  });
  c.appendChild(main);
  main.layoutSizingHorizontal = 'FILL';
  main.layoutSizingVertical = 'FILL';
  const slot = AL('VERTICAL', {
    name: 'Content',
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER',
  });
  main.appendChild(slot);
  slot.layoutSizingHorizontal = 'FILL';
  slot.layoutSizingVertical = 'FILL';
  slot.strokes = [P('border/strong')];
  slot.dashPattern = [6, 6];
  slot.strokeWeight = 1;
  radius(slot, 'radius/xl');
  slot.appendChild(await T('Page content', 'Text/Label', 'ink/muted'));
  const set = combine(
    [c],
    'SidebarLayout',
    'History, Beans, Profiles, Roasters and Settings: a 256px sidebar (title, ⋯, the list, an Add button) and the record page beside it, each scrolling on its own. Code: SidebarLayout.tsx',
  );
  bindText(set, 'Title', 'Beans', [title]);
  stack(set);
  fit(set);
  await doc('SidebarLayout', 'Swap the Content slot for a record page.', set);
});

// ---------- roast pieces ----------
step('StatCard', async () => {
  if (has('StatCard')) return 'skip';
  const comps = [],
    labels = [],
    values = [],
    units = [],
    contexts = [];
  const TONE = { Ink: 'ink/default', Heat: 'heat/default', Air: 'air/default', Env: 'env' };
  for (const size of ['Default', 'Compact'])
    for (const [tone, col] of Object.entries(TONE)) {
      const c = newComponent(`Size=${size}, Tone=${tone}`, 'VERTICAL');
      const compact = size === 'Compact';
      c.itemSpacing = compact ? 4 : 6;
      c.paddingLeft = c.paddingRight = compact ? 12 : 20;
      c.paddingTop = c.paddingBottom = compact ? 8 : 18;
      c.resize(compact ? 168 : 240, 100);
      c.counterAxisSizingMode = 'FIXED';
      c.primaryAxisSizingMode = 'AUTO';
      c.fills = [P(compact ? 'surface/raised' : 'surface/default')];
      radius(c, compact ? 'radius/lg' : 'radius/xl');
      const l = await T('Bean temp', 'Text/Label', 'ink/muted', 'Label');
      c.appendChild(l);
      labels.push(l);
      const line = AL('HORIZONTAL', {
        name: 'Reading',
        itemSpacing: 6,
        counterAxisAlignItems: 'BASELINE',
      });
      const v = await T('198', compact ? 'Readout/LG' : 'Readout/XL', col, 'Value');
      const u = await T('°C', compact ? 'Text/Label' : 'Text/Heading', 'ink/muted', 'Unit');
      line.appendChild(v);
      line.appendChild(u);
      values.push(v);
      units.push(u);
      c.appendChild(line);
      const ctx = await T('+12.4 °C/min', 'Text/Label', 'ink/muted', 'Context');
      c.appendChild(ctx);
      contexts.push(ctx);
      comps.push(c);
    }
  const set = combine(
    comps,
    'StatCard',
    'A big live number: label above, value and unit, one line of context below. Tone colours the value by what it measures: Heat for bean temp, Air for rate of rise, Env for ET. Compact for summaries. Code: StatCard.tsx',
  );
  bindText(set, 'Label', 'Bean temp', labels);
  bindText(set, 'Value', '198', values);
  bindText(set, 'Unit', '°C', units);
  const show = set.addComponentProperty('Show context', 'BOOLEAN', true);
  bindText(set, 'Context', '+12.4 °C/min', contexts, { visible: show });
  gridPlace(set, 4);
  fit(set);
  await doc('StatCard', 'Rows: Default, Compact. Columns: Ink, Heat, Air, Env.', set);
});

step('PhaseStepper', async () => {
  if (has('PhaseStepper')) return 'skip';
  const comps = [],
    labels = [],
    details = [];
  for (const st of ['Done', 'Current', 'Upcoming', 'Skipped']) {
    const c = newComponent(`State=${st}`, 'HORIZONTAL');
    c.itemSpacing = 8;
    const dotWrap = AL('VERTICAL', { name: 'Dot', paddingTop: 8 });
    const dot = figma.createEllipse();
    dot.resize(10, 10);
    dot.fills = [
      P(st === 'Done' ? 'status/good' : st === 'Current' ? 'heat/fill' : 'border/strong'),
    ];
    dotWrap.appendChild(dot);
    c.appendChild(dotWrap);
    const col = AL('VERTICAL', { name: 'Text' });
    const l = await T(
      'Dry end',
      st === 'Current' ? 'Control/MD' : 'Text/Body',
      st === 'Done' || st === 'Current' ? 'ink/default' : 'ink/muted',
      'Label',
    );
    col.appendChild(l);
    labels.push(l);
    const d = await T(
      st === 'Skipped' ? 'Skipped' : '4:12 · 150 °C',
      'Text/Label',
      'ink/muted',
      'Detail',
    );
    col.appendChild(d);
    details.push(d);
    c.appendChild(col);
    comps.push(c);
  }
  const stepSet = combine(
    comps,
    'PhaseStepper/Step',
    'One phase of the roast: green dot when done, ember when current (label semibold), grey when upcoming or skipped.',
  );
  bindText(stepSet, 'Label', 'Dry end', labels);
  const show = stepSet.addComponentProperty('Show detail', 'BOOLEAN', true);
  for (const d of details) d.componentPropertyReferences = { visible: show };
  row(stepSet, 32);
  fit(stepSet);
  await doc('PhaseStepper/Step', 'Done, Current, Upcoming, Skipped.', stepSet);

  const c = newComponent('Phase=First crack', 'HORIZONTAL');
  c.itemSpacing = 28;
  for (const [label, st, detail] of [
    ['Charge', 'Done', '0:00 · 180 °C'],
    ['Dry end', 'Done', '4:12 · 150 °C'],
    ['First crack', 'Current', ''],
    ['Drop', 'Upcoming', ''],
  ]) {
    const s = stepSet.children.find((x) => x.name === `State=${st}`).createInstance();
    s.setProperties({
      [key(stepSet, 'Label')]: label,
      [key(stepSet, 'Show detail')]: Boolean(detail),
    });
    if (detail) {
      const t = s.findOne((n) => n.type === 'TEXT' && n.name === 'Detail');
      if (t) t.characters = detail;
    }
    c.appendChild(s);
  }
  const set = combine(
    [c],
    'PhaseStepper',
    'Roast progress across the top of the Roast screen: Charge, Dry end, First crack, Drop, each with its time and temperature once reached. Code: PhaseStepper.tsx',
  );
  stack(set);
  fit(set);
  await doc('PhaseStepper', 'Mid-roast, waiting for first crack.', set);
});

async function slider(tone, at, h) {
  const s = figma.createFrame();
  s.name = 'Slider';
  s.fills = [];
  s.clipsContent = false;
  s.resize(320, h);
  const y = (h - 8) / 2;
  const track = figma.createRectangle();
  track.name = 'Track';
  track.resize(320, 8);
  track.y = y;
  track.fills = [P('border/strong')];
  radius(track, 'radius/full');
  track.constraints = { horizontal: 'STRETCH', vertical: 'CENTER' };
  const fill = figma.createRectangle();
  fill.name = 'Fill';
  fill.resize(320 * at, 8);
  fill.y = y;
  fill.fills = [P(tone)];
  radius(fill, 'radius/full');
  fill.constraints = { horizontal: 'SCALE', vertical: 'CENTER' };
  const thumb = figma.createEllipse();
  thumb.name = 'Thumb';
  thumb.resize(20, 20);
  thumb.x = 320 * at - 10;
  thumb.y = (h - 20) / 2;
  thumb.fills = [P(tone)];
  thumb.strokes = [P('surface/default')];
  thumb.strokeWeight = 2;
  thumb.constraints = { horizontal: 'SCALE', vertical: 'CENTER' };
  s.appendChild(track);
  s.appendChild(fill);
  s.appendChild(thumb);
  return s;
}

step('OutputControl', async () => {
  if (has('OutputControl')) return 'skip';
  const comps = [],
    labels = [],
    outs = [];
  for (const [tone, col, name, pct] of [
    ['Heat', 'heat/fill', 'Heater', 0.55],
    ['Air', 'air/default', 'Fan', 0.7],
  ])
    for (const size of ['Default', 'SM'])
      for (const mode of ['Auto', 'Manual']) {
        const sm = size === 'SM';
        const c = newComponent(`Tone=${tone}, Size=${size}, Mode=${mode}`, 'VERTICAL');
        c.itemSpacing = sm ? 6 : 10;
        c.resize(320, 80);
        c.counterAxisSizingMode = 'FIXED';
        c.primaryAxisSizingMode = 'AUTO';
        const top = AL('HORIZONTAL', {
          name: 'Top',
          primaryAxisAlignItems: 'SPACE_BETWEEN',
          counterAxisAlignItems: 'CENTER',
          itemSpacing: 8,
        });
        c.appendChild(top);
        top.layoutSizingHorizontal = 'FILL';
        const l = await T(
          name,
          sm ? 'Text/Label' : 'Control/MD',
          sm ? 'ink/muted' : 'ink/default',
          'Label',
        );
        top.appendChild(l);
        labels.push(l);
        const right = AL('HORIZONTAL', {
          name: 'Reading',
          itemSpacing: 10,
          counterAxisAlignItems: 'CENTER',
        });
        const badge = variant('Badge', `Tone=${mode === 'Manual' ? 'Heat' : 'Air'}`, {
          Label: mode,
        });
        badge.name = 'Mode';
        right.appendChild(badge);
        const o = await T(
          `${Math.round(pct * 100)}%`,
          sm ? 'Control/MD' : 'Readout/LG',
          'ink/default',
          'Output',
        );
        right.appendChild(o);
        outs.push(o);
        top.appendChild(right);
        const s = await slider(col, pct, sm ? 44 : 28);
        c.appendChild(s);
        s.layoutSizingHorizontal = 'FILL';
        if (mode === 'Manual' && !sm) c.appendChild(button('Ghost', 'SM', 'Resume auto'));
        comps.push(c);
      }
  const set = combine(
    comps,
    'OutputControl',
    'Heater or fan output: label, Auto/Manual badge, the value, a slider in its colour. Moving it takes over from Auto (Manual); Resume auto hands back. SM is the compact form in the outputs strip. Code: OutputControl.tsx',
  );
  bindText(set, 'Label', 'Heater', labels);
  const show = set.addComponentProperty('Show mode', 'BOOLEAN', true);
  for (const c of set.children) {
    const m = c.findOne((n) => n.name === 'Mode');
    if (m) m.componentPropertyReferences = { visible: show };
  }
  gridPlace(set, 4, 32, 32);
  fit(set);
  await doc('OutputControl', 'Heat and Air tones; Default and SM; Auto and Manual.', set);
});

step('CoachCard', async () => {
  if (has('CoachCard')) return 'skip';
  const comps = [];
  for (const kind of ['Suggestion', 'Heads-up']) {
    const sug = kind === 'Suggestion';
    const c = newComponent(`Kind=${kind}`, 'VERTICAL');
    c.itemSpacing = 8;
    c.paddingLeft = c.paddingRight = 16;
    c.paddingTop = c.paddingBottom = 12;
    c.resize(400, 120);
    c.counterAxisSizingMode = 'FIXED';
    c.primaryAxisSizingMode = 'AUTO';
    c.fills = [P(sug ? 'heat/tint' : 'surface/raised')];
    c.strokes = [P(sug ? 'heat/default' : 'border/default')];
    c.strokeWeight = 1;
    radius(c, 'radius/xl');
    c.appendChild(await T(sug ? 'Coach suggests' : 'Heads-up', 'Text/Label', 'ink/muted', 'Label'));
    if (sug) {
      const block = AL('VERTICAL', { name: 'Change', itemSpacing: 4 });
      block.appendChild(
        await T('Heat at dry end 55% → 50%', 'Text/Body', 'ink/default', 'Changes'),
      );
      const why = await T(
        'The last two roasts ran 15 s fast to first crack.',
        'Text/Body',
        'ink/muted',
        'Reason',
      );
      block.appendChild(why);
      c.appendChild(block);
      block.layoutSizingHorizontal = 'FILL';
      why.layoutSizingHorizontal = 'FILL';
      why.textAutoResize = 'HEIGHT';
      const actions = AL('HORIZONTAL', {
        name: 'Actions',
        itemSpacing: 10,
        primaryAxisAlignItems: 'MAX',
      });
      c.appendChild(actions);
      actions.layoutSizingHorizontal = 'FILL';
      actions.appendChild(button('Outline', 'SM', 'Dismiss'));
      actions.appendChild(button('Primary', 'SM', 'Apply'));
    } else {
      const line = await T(
        'Development is short for this bean: drop a little later.',
        'Text/Body',
        'ink/default',
        'Line',
      );
      c.appendChild(line);
      line.layoutSizingHorizontal = 'FILL';
      line.textAutoResize = 'HEIGHT';
      const actions = AL('HORIZONTAL', { name: 'Actions', primaryAxisAlignItems: 'MAX' });
      c.appendChild(actions);
      actions.layoutSizingHorizontal = 'FILL';
      actions.appendChild(button('Outline', 'SM', 'Dismiss'));
    }
    comps.push(c);
  }
  const set = combine(
    comps,
    'CoachCard',
    'The coach after a roast: a Suggestion (ember border and tint) with the profile changes, why, Dismiss and Apply; or a Heads-up with one line and Dismiss. Code: CoachCard.tsx',
  );
  row(set, 32);
  fit(set);
  await doc('CoachCard', 'Suggestion and Heads-up.', set);
});

step('RoastStrip', async () => {
  if (has('RoastStrip')) return 'skip';
  const comps = [];
  for (const prompt of ['No', 'Yes']) {
    const c = newComponent(`Prompt=${prompt}`, 'HORIZONTAL');
    c.counterAxisAlignItems = 'CENTER';
    c.itemSpacing = 16;
    c.paddingLeft = c.paddingRight = 24;
    c.resize(1200, 44);
    c.primaryAxisSizingMode = 'FIXED';
    c.counterAxisSizingMode = 'FIXED';
    c.fills = [P('heat/tint')];
    c.strokes = [P('border/default')];
    c.strokeTopWeight = 0;
    c.strokeLeftWeight = 0;
    c.strokeRightWeight = 0;
    c.strokeBottomWeight = 1;
    const dot = figma.createEllipse();
    dot.resize(8, 8);
    dot.fills = [P('heat/default')];
    c.appendChild(dot);
    c.appendChild(
      await T(
        prompt === 'Yes' ? 'First crack? Press it when you hear it' : 'Roasting · Ethiopia Guji',
        'Control/MD',
        'heat/default',
        'Lead',
      ),
    );
    const nums = AL('HORIZONTAL', { name: 'Numbers', itemSpacing: 16 });
    for (const [l, v] of [
      ['BT', '198 °C'],
      ['RoR', '9.8'],
      ['Time', '8:41'],
    ]) {
      const pair = AL('HORIZONTAL', { name: l, itemSpacing: 4 });
      pair.appendChild(await T(l, 'Text/Label', 'ink/muted'));
      pair.appendChild(await T(v, 'Text/Label', 'ink/default'));
      nums.appendChild(pair);
    }
    c.appendChild(nums);
    const spacer = AL('HORIZONTAL', { name: 'Spacer' });
    c.appendChild(spacer);
    spacer.layoutSizingHorizontal = 'FILL';
    const chev = inst('chevron-down', 'ink/muted');
    chev.rotation = 90;
    c.appendChild(chev);
    comps.push(c);
  }
  const set = combine(
    comps,
    'RoastStrip',
    'Across every other screen while a roast runs: ember tint, a pulsing dot, what’s happening (or what needs you), the live numbers; opens the Roast screen. Code: RoastStrip.tsx',
  );
  stack(set, 16);
  fit(set);
  await doc('RoastStrip', 'Running, and asking for first crack.', set);
});

// ---------- lists, tables, charts ----------
step('RoastList', async () => {
  if (has('RoastList')) return 'skip';
  const comps = [],
    names = [],
    dates = [],
    details = [];
  for (const st of ['Default', 'Hover', 'Selected']) {
    const c = newComponent(`State=${st}`, 'VERTICAL');
    c.itemSpacing = 2;
    c.paddingLeft = c.paddingRight = 16;
    c.paddingTop = c.paddingBottom = 12;
    c.resize(360, 64);
    c.counterAxisSizingMode = 'FIXED';
    c.primaryAxisSizingMode = 'AUTO';
    c.fills =
      st === 'Selected'
        ? [P('surface/raised')]
        : st === 'Hover'
          ? [P('surface/hover')]
          : [P('surface/default')];
    const top = AL('HORIZONTAL', {
      name: 'Top',
      primaryAxisAlignItems: 'SPACE_BETWEEN',
      itemSpacing: 12,
    });
    c.appendChild(top);
    top.layoutSizingHorizontal = 'FILL';
    const n = await T('Ethiopia Guji', 'Control/MD', 'ink/default', 'Name');
    const d = await T('Fri 6 Nov · 09:47', 'Text/Label', 'ink/muted', 'Date');
    top.appendChild(n);
    top.appendChild(d);
    names.push(n);
    dates.push(d);
    const det = await T('Auto · Light · Curve · 375 → 319 g', 'Text/Label', 'ink/muted', 'Detail');
    c.appendChild(det);
    details.push(det);
    comps.push(c);
  }
  const rowSet = combine(
    comps,
    'RoastList/Row',
    'One roast in History: bean, when, and how it ran.',
  );
  bindText(rowSet, 'Name', 'Ethiopia Guji', names);
  bindText(rowSet, 'Date', 'Fri 6 Nov · 09:47', dates);
  bindText(rowSet, 'Detail', 'Auto · Light · Curve · 375 → 319 g', details);
  stack(rowSet, 12);
  fit(rowSet);
  await doc('RoastList/Row', 'Default, Hover, Selected.', rowSet);

  const c = newComponent('Type=Default', 'VERTICAL');
  c.fills = [P('surface/default')];
  radius(c, 'radius/xl');
  c.clipsContent = true;
  const rows = [
    ['Ethiopia Guji', 'Fri 6 Nov · 09:47', 'Auto · Light · Curve · 375 → 319 g', 'Selected'],
    ['Ethiopia Guji', 'Wed 4 Nov · 17:27', 'Auto · Light · Curve · 375 → 321 g', 'Default'],
    ['Colombia Huila', 'Mon 2 Nov · 10:05', 'Manual · 350 → 298 g', 'Default'],
  ];
  rows.forEach(([n, d, det, st], i) => {
    const r = rowSet.children.find((x) => x.name === `State=${st}`).createInstance();
    r.setProperties({
      [key(rowSet, 'Name')]: n,
      [key(rowSet, 'Date')]: d,
      [key(rowSet, 'Detail')]: det,
    });
    if (i < rows.length - 1) {
      r.strokes = [P('border/default')];
      r.strokeTopWeight = 0;
      r.strokeLeftWeight = 0;
      r.strokeRightWeight = 0;
      r.strokeBottomWeight = 1;
    }
    c.appendChild(r);
  });
  const set = combine(
    [c],
    'RoastList',
    'History’s list of roasts: one card, rows divided by hairlines, the open roast on surface-raised. Code: RoastList.tsx',
  );
  stack(set);
  fit(set);
  await doc('RoastList', 'Three roasts, the newest open.', set);
});

async function table(name, columns, rows, opts) {
  const c = newComponent('Type=Default', 'VERTICAL');
  if (opts.card) {
    c.fills = [P('surface/default')];
    radius(c, 'radius/xl');
    c.paddingLeft = c.paddingRight = c.paddingTop = c.paddingBottom = 16;
  }
  const mkRow = async (cells, head, idx) => {
    const r = AL('HORIZONTAL', {
      name: head ? 'Head' : `Row ${idx + 1}`,
      counterAxisAlignItems: 'CENTER',
    });
    if (head) r.paddingBottom = 8;
    else {
      r.paddingTop = r.paddingBottom = opts.tight ? 8 : 12;
      r.strokes = [P('border/default')];
      r.strokeTopWeight = 1;
      r.strokeLeftWeight = 0;
      r.strokeRightWeight = 0;
      r.strokeBottomWeight = 0;
    }
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const cell = fixedBox('HORIZONTAL', col.w, 20, {
        name: col.title || 'Cell',
        counterAxisAlignItems: 'CENTER',
        primaryAxisAlignItems: col.right ? 'MAX' : 'MIN',
        paddingLeft: i === 0 ? 0 : 16,
      });
      cell.counterAxisSizingMode = 'AUTO';
      const v = cells[i];
      if (v && typeof v === 'object' && v.node) cell.appendChild(v.node);
      else if (v !== '' && v != null) {
        const style = !head && i === 0 && opts.boldFirst ? 'Control/SM' : 'Text/Label';
        const color = head || col.muted ? 'ink/muted' : 'ink/default';
        cell.appendChild(await T(String(v), style, color));
      }
      r.appendChild(cell);
    }
    return r;
  };
  c.appendChild(
    await mkRow(
      columns.map((x) => x.title),
      true,
      0,
    ),
  );
  for (let i = 0; i < rows.length; i++) c.appendChild(await mkRow(rows[i], false, i));
  return c;
}

step('RoastTable', async () => {
  if (has('RoastTable')) return 'skip';
  const stars = (n) => ({ node: variant('StarRating', `Mode=Read, Value=${n}`) });
  const cols = [
    { title: 'Roast', w: 170 },
    { title: 'Ran as', w: 260, muted: true },
    { title: 'Time', w: 80, right: true },
    { title: 'FC', w: 80, right: true },
    { title: 'Drop', w: 100, right: true },
    { title: 'Green → roasted', w: 160, right: true },
    { title: 'Loss', w: 80, right: true },
    { title: 'Rating', w: 110, right: true },
  ];
  const rows = [
    [
      'Fri 6 Nov · 09:47',
      'Auto · Light · Curve',
      '11:07',
      '9:22',
      '196.0 °C',
      '375 → 319 g',
      '14.9 %',
      stars(4),
    ],
    [
      'Wed 4 Nov · 17:27',
      'Auto · Light · Curve',
      '11:07',
      '9:22',
      '196.0 °C',
      '375 → 321 g',
      '14.4 %',
      stars(5),
    ],
    ['Mon 2 Nov · 10:05', 'Manual', '10:41', '9:05', '201.5 °C', '350 → 298 g', '14.9 %', stars(3)],
  ];
  const c = await table('RoastTable', cols, rows, { boldFirst: true });
  const set = combine(
    [c],
    'RoastTable',
    'A bean’s or profile’s roasts: when (a link to the roast), how it ran, the key times and temperatures, weights, loss, rating. Label type, tabular numerals, hairlines between rows. Code: RoastTable.tsx',
  );
  stack(set);
  fit(set);
  await doc('RoastTable', 'The roasts table on a bean page.', set);
});

step('EventTable', async () => {
  if (has('EventTable')) return 'skip';
  const cols = [
    { title: 'Event', w: 160 },
    { title: 'Time', w: 90, right: true },
    { title: 'BT', w: 100, right: true },
    { title: 'ET', w: 100, right: true },
    { title: 'RoR', w: 100, right: true },
  ];
  const rows = [
    ['Charge', '0:00', '180.0 °C', '210.0 °C', '—'],
    ['Turning point', '1:05', '92.4 °C', '188.2 °C', '0.0'],
    ['Dry end', '4:12', '150.0 °C', '205.1 °C', '14.2'],
    ['First crack', '9:22', '196.0 °C', '228.4 °C', '8.1'],
    ['Drop', '11:07', '205.3 °C', '231.0 °C', '5.4'],
  ];
  const c = await table('EventTable', cols, rows, { card: true, tight: true });
  const set = combine(
    [c],
    'EventTable',
    'A roast’s events with their readings, on its own card. Code: EventTable.tsx',
  );
  stack(set);
  fit(set);
  await doc('EventTable', 'Events of one roast.', set);
});

step('CompareTable', async () => {
  if (has('CompareTable')) return 'skip';
  const cols = [
    { title: '', w: 160 },
    { title: 'This roast', w: 120, right: true },
    { title: 'Wed 4 Nov', w: 120, right: true },
    { title: 'Difference', w: 120, right: true },
  ];
  const rows = [
    ['Dry end', '4:12', '4:20', '−0:08'],
    ['First crack', '9:22', '9:22', '0:00'],
    ['Drop', '11:07', '11:07', '0:00'],
    ['Development', '1:45 · 15.7 %', '1:45 · 15.7 %', '0:00'],
  ];
  const c = await table('CompareTable', cols, rows, { card: true, tight: true });
  const set = combine(
    [c],
    'CompareTable',
    'Two roasts side by side with the difference. Code: CompareTable.tsx',
  );
  stack(set);
  fit(set);
  await doc('CompareTable', 'This roast against a reference roast.', set);
});

function curve(name, data, color, weight, dash) {
  const v = figma.createVector();
  v.name = name;
  v.vectorPaths = [{ windingRule: 'NONE', data }];
  v.fills = [];
  v.strokes = [P(color)];
  v.strokeWeight = weight;
  v.strokeCap = 'ROUND';
  if (dash) v.dashPattern = dash;
  return v;
}

step('RoastChart', async () => {
  if (has('RoastChart')) return 'skip';
  const W = 960,
    H = 360,
    L = 48,
    R = 16,
    Tt = 16,
    B = 32;
  const pw = W - L - R,
    ph = H - Tt - B;
  const x = (t) => L + (t / 12) * pw; // minutes 0-12
  const y = (temp) => Tt + ph - (temp / 250) * ph; // 0-250 °C
  const c = figma.createComponent();
  c.name = 'State=Roasting';
  c.resize(W, H);
  c.fills = [P('surface/default')];
  radius(c, 'radius/xl');
  c.clipsContent = true;
  const band = (from, to, col, label) => {
    const r = figma.createRectangle();
    r.name = `Band ${label}`;
    r.x = x(from);
    r.y = Tt;
    r.resize(x(to) - x(from), ph);
    r.fills = [P(col)];
    c.appendChild(r);
  };
  band(0, 4.2, 'chart/band-low', 'drying');
  band(4.2, 9.37, 'chart/band-mid', 'maillard');
  band(9.37, 11.12, 'chart/band-high', 'development');
  for (let temp = 0; temp <= 250; temp += 50) {
    const g = figma.createRectangle();
    g.name = `Grid ${temp}`;
    g.x = L;
    g.y = y(temp);
    g.resize(pw, 1);
    g.fills = [P('chart/grid')];
    c.appendChild(g);
    const t = await T(String(temp), 'Text/Label', 'ink/muted');
    t.x = 8;
    t.y = y(temp) - 9;
    c.appendChild(t);
  }
  for (let m = 0; m <= 12; m += 2) {
    const t = await T(`${m}:00`, 'Text/Label', 'ink/muted');
    t.x = Math.min(x(m) - 14, W - R - t.width);
    t.y = H - 24;
    c.appendChild(t);
  }
  const path = (pts) =>
    pts.map(([t, v], i) => `${i ? 'L' : 'M'} ${x(t).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const bt = [
    [0, 180],
    [0.5, 120],
    [1.1, 92],
    [2, 104],
    [3, 128],
    [4.2, 150],
    [5.5, 165],
    [7, 179],
    [8.3, 189],
    [9.37, 196],
    [10.3, 201],
    [11.12, 205],
  ];
  const et = [
    [0, 210],
    [1, 190],
    [2, 194],
    [4.2, 205],
    [6, 214],
    [8, 222],
    [9.37, 228],
    [11.12, 231],
  ];
  const target = [
    [0, 180],
    [1.1, 94],
    [4.2, 150],
    [9.37, 196],
    [11.12, 205],
  ];
  const ror = [
    [1.3, 2],
    [2, 18],
    [3, 20],
    [4.2, 17],
    [6, 13],
    [8, 10],
    [9.37, 8],
    [11.12, 5],
  ].map(([t, r]) => [t, r * 6]);
  c.appendChild(curve('Target', path(target), 'chart/target', 2, [6, 4]));
  c.appendChild(curve('ET', path(et), 'env', 2));
  c.appendChild(curve('RoR', path(ror), 'air/default', 2));
  c.appendChild(curve('BT', path(bt), 'heat/default', 2.5));
  for (const [t, label] of [
    [4.2, 'Dry end'],
    [9.37, 'First crack'],
  ]) {
    const m = figma.createRectangle();
    m.name = `Marker ${label}`;
    m.x = x(t);
    m.y = Tt;
    m.resize(1, ph);
    m.fills = [P('ink/muted')];
    c.appendChild(m);
    const lt = await T(label, 'Text/Label', 'ink/default');
    lt.x = x(t) + 6;
    lt.y = Tt + 4;
    c.appendChild(lt);
  }
  const legend = AL('HORIZONTAL', { name: 'Legend', itemSpacing: 16 });
  for (const [label, col, dash] of [
    ['BT', 'heat/default'],
    ['ET', 'env'],
    ['RoR', 'air/default'],
    ['Target', 'chart/target', true],
  ]) {
    const item = AL('HORIZONTAL', { name: label, itemSpacing: 6, counterAxisAlignItems: 'CENTER' });
    const sw = curve('Swatch', 'M 0 0 L 16 0', col, 2, dash ? [4, 3] : null);
    item.appendChild(sw);
    item.appendChild(await T(label, 'Text/Label', 'ink/muted'));
    legend.appendChild(item);
  }
  c.appendChild(legend);
  legend.x = L + 8;
  legend.y = Tt + 4;
  const set = combine(
    [c],
    'RoastChart',
    'The roast curve (illustration of the uPlot chart): phase bands under a translucent grid; BT in heat, ET in env, RoR in air on its own scale, the profile target dashed, event markers with labels. Live charts are drawn in code: RoastChart.tsx, roast-chart/',
  );
  stack(set);
  fit(set);
  await doc('RoastChart', 'A finished roast with its target, ET and RoR.', set);
});

step('StockChart', async () => {
  if (has('StockChart')) return 'skip';
  const W = 640,
    H = 220,
    L = 48,
    R = 16,
    Tt = 16,
    B = 32;
  const pw = W - L - R,
    ph = H - Tt - B;
  const x = (d) => L + (d / 60) * pw;
  const y = (g) => Tt + ph - (g / 3000) * ph;
  const c = figma.createComponent();
  c.name = 'Type=Default';
  c.resize(W, H);
  c.fills = [P('surface/default')];
  radius(c, 'radius/xl');
  c.clipsContent = true;
  for (let g = 0; g <= 3000; g += 1000) {
    const r = figma.createRectangle();
    r.x = L;
    r.y = y(g);
    r.resize(pw, 1);
    r.fills = [P('chart/grid')];
    c.appendChild(r);
    const t = await T(`${g / 1000} kg`, 'Text/Label', 'ink/muted');
    t.x = 8;
    t.y = y(g) - 9;
    c.appendChild(t);
  }
  const steps = [
    [0, 2000],
    [8, 1625],
    [15, 1250],
    [22, 3250],
    [30, 2875],
    [38, 2500],
    [45, 2125],
    [53, 1750],
    [60, 1750],
  ];
  let d = `M ${x(0)} ${y(steps[0][1])}`;
  for (let i = 1; i < steps.length; i++)
    d += ` L ${x(steps[i][0]).toFixed(1)} ${y(steps[i - 1][1]).toFixed(1)} L ${x(steps[i][0]).toFixed(1)} ${y(steps[i][1]).toFixed(1)}`;
  c.appendChild(curve('Green stock', d, 'heat/default', 2));
  const low = figma.createRectangle();
  low.name = 'Low stock line';
  low.x = L;
  low.y = y(500);
  low.resize(pw, 1);
  low.fills = [P('status/warning')];
  c.appendChild(low);
  const set = combine(
    [c],
    'StockChart',
    'A bean’s green stock over time (illustration): steps down for each roast, up for each purchase, the low-stock line in warning. Code: StockChart.tsx',
  );
  stack(set);
  fit(set);
  await doc('StockChart', 'Two months of one bean.', set);
});

// ---------- record header and example screen ----------
step('RecordHeader', async () => {
  if (has('RecordHeader')) return 'skip';
  const comps = [];
  for (const mode of ['Read', 'Edit']) {
    const c = newComponent(`Mode=${mode}`, 'HORIZONTAL');
    c.itemSpacing = 16;
    c.resize(1120, 80);
    c.primaryAxisSizingMode = 'FIXED';
    c.counterAxisSizingMode = 'AUTO';
    const left = AL('VERTICAL', { name: 'Title', itemSpacing: 4 });
    c.appendChild(left);
    left.layoutSizingHorizontal = 'FILL';
    if (mode === 'Read') {
      const holder = AL('HORIZONTAL', { name: 'Name', counterAxisAlignItems: 'CENTER' });
      holder.minHeight = 44;
      holder.appendChild(await T('Ethiopia Guji', 'Text/Title', 'ink/default', 'Name'));
      left.appendChild(holder);
      const under = AL('HORIZONTAL', {
        name: 'Badges',
        itemSpacing: 8,
        counterAxisAlignItems: 'CENTER',
      });
      under.minHeight = 24;
      under.appendChild(variant('Badge', 'Tone=Neutral', { Label: 'Low stock' }));
      left.appendChild(under);
      const actions = AL('HORIZONTAL', {
        name: 'Actions',
        itemSpacing: 8,
        counterAxisAlignItems: 'CENTER',
      });
      actions.appendChild(button('Primary', 'SM', 'Roast this bean'));
      actions.appendChild(button('Secondary', 'SM', 'Adjust stock'));
      actions.appendChild(button('Secondary', 'SM', 'Edit'));
      actions.appendChild(variant('Menu', 'Open=No'));
      c.appendChild(actions);
    } else {
      const tf = variant('TitleField', 'State=Default', { Value: 'Ethiopia Guji' });
      left.appendChild(tf);
      tf.layoutSizingHorizontal = 'FILL';
      const under = AL('HORIZONTAL', {
        name: 'Badges',
        itemSpacing: 8,
        counterAxisAlignItems: 'CENTER',
      });
      under.minHeight = 24;
      under.appendChild(variant('Badge', 'Tone=Heat', { Label: 'Not saved' }));
      left.appendChild(under);
      const actions = AL('HORIZONTAL', {
        name: 'Actions',
        itemSpacing: 8,
        counterAxisAlignItems: 'CENTER',
      });
      actions.appendChild(button('Ghost', 'SM', 'Cancel'));
      actions.appendChild(button('Primary', 'SM', 'Save'));
      c.appendChild(actions);
    }
    comps.push(c);
  }
  const set = combine(
    comps,
    'RecordHeader',
    'The header of every bean, profile and roaster page (docs/spec/ui.md, Read and edit): the name as the title (a TitleField in Edit), badges and "Not saved" under it, actions on the right (Cancel and Save in Edit). Code: apps/desktop/.../features/RecordHeader.tsx',
  );
  stack(set, 32);
  fit(set);
  await doc('RecordHeader', 'Read and Edit.', set);
});

step('Example: bean page', async () => {
  if (coverPage.findOne((n) => n.type === 'FRAME' && n.name === 'Example · Bean page'))
    return 'skip';
  await figma.setCurrentPageAsync(coverPage);
  try {
    const W = 1440;
    const f = AL('VERTICAL', { name: 'Example · Bean page' });
    f.resize(W, 1100);
    f.primaryAxisSizingMode = 'AUTO';
    f.counterAxisSizingMode = 'FIXED';
    f.fills = [P('bg')];
    // top bar
    const bar = AL('HORIZONTAL', {
      name: 'Top bar',
      itemSpacing: 8,
      counterAxisAlignItems: 'CENTER',
      paddingLeft: 24,
      paddingRight: 24,
      paddingTop: 12,
      paddingBottom: 12,
    });
    f.appendChild(bar);
    bar.layoutSizingHorizontal = 'FILL';
    bar.strokes = [P('border/default')];
    bar.strokeTopWeight = 0;
    bar.strokeLeftWeight = 0;
    bar.strokeRightWeight = 0;
    bar.strokeBottomWeight = 1;
    const brand = variant('Mark', 'Name=Yes');
    bar.appendChild(brand);
    const tabs = AL('HORIZONTAL', { name: 'Tabs', itemSpacing: 4, paddingLeft: 24 });
    for (const tab of ['Roast', 'History', 'Beans', 'Profiles', 'Roasters', 'Settings', 'Logs']) {
      const t = AL('HORIZONTAL', {
        name: tab,
        paddingLeft: 14,
        paddingRight: 14,
        counterAxisAlignItems: 'CENTER',
      });
      t.minHeight = 44;
      radius(t, 'radius/md');
      if (tab === 'Beans') t.fills = [P('surface/raised')];
      t.appendChild(await T(tab, 'Control/SM', tab === 'Beans' ? 'ink/default' : 'ink/muted'));
      tabs.appendChild(t);
    }
    bar.appendChild(tabs);
    const spacer = AL('HORIZONTAL', { name: 'Spacer' });
    bar.appendChild(spacer);
    spacer.layoutSizingHorizontal = 'FILL';
    const stop = button('Danger', 'MD', 'Emergency stop');
    bar.appendChild(stop);
    // body: sidebar + main
    const body = AL('HORIZONTAL', { name: 'Body' });
    f.appendChild(body);
    body.layoutSizingHorizontal = 'FILL';
    const side = AL('VERTICAL', {
      name: 'Sidebar',
      itemSpacing: 12,
      paddingTop: 24,
      paddingBottom: 24,
      paddingLeft: 24,
    });
    body.appendChild(side);
    side.resize(256, side.height);
    side.primaryAxisSizingMode = 'AUTO';
    side.counterAxisSizingMode = 'FIXED';
    const sh = AL('HORIZONTAL', {
      name: 'Header',
      primaryAxisAlignItems: 'SPACE_BETWEEN',
      counterAxisAlignItems: 'CENTER',
      paddingRight: 12,
    });
    side.appendChild(sh);
    sh.layoutSizingHorizontal = 'FILL';
    sh.minHeight = 44;
    sh.appendChild(await T('Beans', 'Text/Title', 'ink/default'));
    sh.appendChild(variant('Menu', 'Open=No'));
    const list = await navList();
    side.appendChild(list);
    list.layoutSizingHorizontal = 'FILL';
    const add = button('Ghost', 'SM', 'Add bean');
    add.setProperties({ [key(need('Button'), 'Show icon')]: true });
    side.appendChild(add);
    const main = AL('VERTICAL', {
      name: 'Page',
      itemSpacing: 16,
      paddingLeft: 24,
      paddingRight: 24,
      paddingTop: 24,
      paddingBottom: 48,
    });
    body.appendChild(main);
    main.layoutSizingHorizontal = 'FILL';
    const header = variant('RecordHeader', 'Mode=Read');
    main.appendChild(header);
    header.layoutSizingHorizontal = 'FILL';
    const stats = AL('HORIZONTAL', { name: 'Stats', itemSpacing: 16 });
    main.appendChild(stats);
    stats.layoutSizingHorizontal = 'FILL';
    for (const [label, value, unit, ctx] of [
      ['Green', '1250', 'g', '4 batches · 3 × 312 g · 1 × 314 g'],
      ['Weight loss', '14.7', '%', 'Average of its roasts'],
    ]) {
      const s = variant('StatCard', 'Size=Default, Tone=Ink', {
        Label: label,
        Value: value,
        Unit: unit,
        Context: ctx,
      });
      stats.appendChild(s);
      s.layoutSizingHorizontal = 'FILL';
    }
    const stock = variant('CollapsibleCard', 'Open=No', {
      Title: 'Stock history',
      Summary: 'Bought 3 times · roasts about 750 g a week · lasts 12 days',
    });
    main.appendChild(stock);
    stock.layoutSizingHorizontal = 'FILL';
    const about = variant('CollapsibleCard', 'Open=Yes', { Title: 'About this bean' });
    main.appendChild(about);
    about.layoutSizingHorizontal = 'FILL';
    const roasts = variant('RoastTable', 'Type=Default');
    main.appendChild(roasts);
    roasts.layoutSizingHorizontal = 'FILL';
    const cover = coverPage.findOne((n) => n.type === 'FRAME' && n.name === 'Cover');
    f.x = cover ? cover.x + cover.width + 160 : 1600;
    f.y = 0;
  } finally {
    await figma.setCurrentPageAsync(page);
  }
});

// ---------- tidy ----------
step('Fix RoastChart labels', async () => {
  // The legend sat over the First crack marker label, and 12:00 ran off the right edge.
  const set = has('RoastChart');
  if (!set) return 'skip';
  const chart = set.children[0];
  let changed = false;
  const legend = chart.findOne((n) => n.name === 'Legend');
  if (legend && legend.x !== 56) {
    legend.x = 56;
    legend.y = 20;
    changed = true;
  }
  const last = chart.findOne((n) => n.type === 'TEXT' && n.characters === '12:00');
  if (last && last.x + last.width > chart.width - 8) {
    last.x = chart.width - 16 - last.width;
    changed = true;
  }
  return changed ? undefined : 'skip';
});

step('Refit component sets', async () => {
  // A set keeps its size when a variant grows (e.g. a longer default text), and clips it.
  let refit = 0;
  for (const set of page.findAll((n) => n.type === 'COMPONENT_SET')) {
    const w = Math.max(...set.children.map((c) => c.x + c.width)) + 24;
    const h = Math.max(...set.children.map((c) => c.y + c.height)) + 24;
    if (w > set.width + 0.5 || h > set.height + 0.5) {
      set.resize(Math.max(w, set.width), Math.max(h, set.height));
      refit++;
    }
  }
  return refit ? undefined : 'skip';
});

// ---------- run ----------
async function main() {
  await setup();
  const done = [],
    skipped = [],
    failed = [];
  for (const s of STEPS) {
    try {
      const r = await s.fn();
      (r === 'skip' ? skipped : done).push(s.name);
    } catch (e) {
      failed.push(`${s.name}: ${e && e.message ? e.message : String(e)}`);
      console.error(s.name, e);
    }
  }
  console.log('Roastpilot builder', { done, skipped, failed });
  const msg = failed.length
    ? `Built ${done.length}, skipped ${skipped.length}, ${failed.length} failed: ${failed.join(' | ')}`
    : `Built ${done.length}, skipped ${skipped.length}. All done.`;
  figma.closePlugin(msg.slice(0, 900));
}

main().catch((e) => figma.closePlugin(`Couldn't start: ${e && e.message ? e.message : String(e)}`));
