// Writes the generated blocks of the start page in src/start from the plugin's client modules
// in ../ds-bot (read only, as scripts/icon.mjs does):
// - start.html, between <!-- whale --> markers: the Main Bot's whale from characterMarkup('whale',
//   'deepseek'), cut at the tail stock into two copies so the tail can move on its own. The mask
//   is st-eyes, the clips st-tail-cut and st-torso-cut; the fill stays var(--bt-ink-deepseek).
// - start.css, between /* tokens */ markers: the DeepSeek theme's light and dark colors.
// - start.css, between /* springs */ markers: motion.js's springs as linear() curves.
// Usage: node scripts/start-assets.mjs [--check]   (--check exits 1 when a block is stale and
// writes nothing)
import { readFileSync, writeFileSync } from 'node:fs'
import { INKS } from '../../ds-bot/src/client/inks.js'
import { allThemes, themeCss } from '../../ds-bot/src/client/themes.js'

const client = new URL('../../ds-bot/src/client/', import.meta.url)
const page = new URL('../src/start/', import.meta.url)

const THEME_TOKENS = ['--bt-main', '--bt-card', '--bt-ink', '--bt-ink-2', '--bt-line', '--bt-line-2', '--bt-hover', '--bt-accent', '--bt-accent-ink']
// The status colors are the same in both modes; the plugin's base sheet defines them.
const BASE_TOKENS = ['--bt-green', '--bt-danger']
const SPRINGS = ['shape', 'tap', 'pop', 'stretch', 'list']

const ATENEA_ISOTIPO = {
  base: 'M1651 5619 c-218 -43 -372 -165 -472 -374 -59 -123 -74 -190 -74 -335 l0 -125 108 -270 109 -270 -22 -58 c-30 -79 -104 -158 -187 -199 -100 -49 -183 -50 -391 -4 -90 20 -181 36 -202 36 -85 0 -159 -117 -120 -190 5 -10 38 -39 72 -65 252 -190 586 -211 898 -58 79 39 109 61 180 132 132 133 192 265 193 426 0 111 -15 167 -94 339 -82 178 -103 252 -104 356 0 139 52 218 157 239 43 9 63 8 108 -5 110 -32 240 -205 299 -396 72 -237 113 -673 96 -1030 l-7 -156 -37 -7 c-87 -16 -318 -102 -456 -169 -322 -157 -581 -362 -845 -666 -359 -412 -572 -778 -685 -1172 -54 -190 -69 -293 -69 -463 -1 -158 8 -218 51 -350 130 -405 471 -628 893 -585 262 27 467 130 689 345 190 184 296 329 425 585 137 268 204 454 301 835 90 351 119 531 128 800 l2 70 32 -33 c54 -56 84 -166 137 -507 19 -122 43 -243 53 -270 17 -47 21 -50 57 -53 22 -2 49 -1 61 2 26 7 343 335 644 666 248 274 699 724 813 813 117 91 282 197 306 197 38 0 72 -22 72 -46 0 -12 -20 -62 -45 -111 -35 -71 -69 -116 -157 -214 -262 -288 -848 -880 -1355 -1369 -239 -230 -287 -305 -237 -361 26 -29 112 -69 149 -69 33 0 171 54 460 180 396 172 661 233 852 197 209 -40 348 -165 383 -345 34 -170 -35 -354 -210 -569 l-73 -89 -151 151 c-86 86 -189 178 -241 214 -169 119 -352 196 -524 221 -112 17 -304 8 -404 -19 -296 -78 -510 -291 -536 -533 -23 -208 23 -366 142 -482 121 -118 259 -169 512 -187 282 -21 524 2 819 76 234 59 238 59 328 -11 248 -192 589 -230 876 -98 153 70 269 172 396 349 103 143 221 286 335 407 56 59 91 104 89 114 -15 78 -216 86 -364 15 -70 -34 -110 -75 -271 -276 -170 -212 -257 -295 -358 -341 -105 -48 -219 -19 -338 86 l-57 52 105 100 c240 229 367 473 382 735 30 519 -354 847 -962 819 -77 -3 -169 -13 -205 -21 -103 -23 -106 -22 -72 28 38 54 177 193 372 372 188 172 402 391 489 500 84 105 193 270 244 370 40 78 41 83 41 185 1 161 -6 191 -64 250 -30 31 -76 63 -117 83 -64 30 -74 32 -183 32 -92 0 -130 -5 -190 -23 -156 -49 -365 -172 -540 -317 -52 -44 -288 -270 -525 -502 -290 -285 -436 -423 -450 -423 -19 0 -26 15 -54 123 -79 289 -159 420 -372 604 l-36 31 -7 339 c-11 516 -26 652 -106 962 -137 527 -510 854 -889 780z m544 -2484 c14 -31 12 -55 -15 -252 -86 -627 -202 -1018 -456 -1526 -107 -215 -192 -345 -301 -458 -261 -271 -534 -335 -716 -169 -164 150 -189 388 -81 775 111 394 341 756 748 1174 221 227 454 386 682 465 100 35 122 34 139 -9z m1387 -2098 c99 -38 161 -81 309 -219 191 -178 231 -223 227 -255 -3 -30 -25 -40 -178 -78 -197 -49 -403 -61 -532 -31 -154 36 -301 143 -327 238 -39 140 77 306 254 365 58 19 166 10 247 -20z',
  sheen: [
    'M1612 5575 c-30 -8 -61 -19 -70 -25 -16 -9 -15 -9 1 -10 9 0 35 -11 57 -25 22 -14 42 -25 45 -25 3 0 24 -12 48 -27 37 -24 172 -101 297 -171 25 -14 104 -60 175 -102 189 -111 245 -142 245 -133 1 4 7 -3 15 -17 24 -42 17 -13 -14 54 -94 209 -281 398 -458 467 -76 29 -261 37 -341 14z',
    'M4684 4001 c-80 -22 -167 -57 -236 -96 -45 -25 -70 -48 -29 -25 11 5 21 6 23 1 2 -4 35 -26 73 -48 39 -22 147 -84 240 -138 94 -54 206 -119 250 -145 54 -31 80 -51 79 -63 -3 -30 6 -19 36 46 27 56 30 71 30 167 0 138 -10 169 -68 221 -103 91 -248 121 -398 80z',
    'M4731 3687 c16 -12 79 -45 79 -42 0 7 -63 45 -74 45 -5 0 -7 -1 -5 -3z',
  ],
}

function rig() {
  const mask = '<mask id="st-eyes" maskUnits="userSpaceOnUse" x="-100" y="-100" width="300" height="300"><rect x="-100" y="-100" width="300" height="300" fill="#fff"/><g id="gaze" class="bt-gaze"><g id="eye-pair" class="bt-eyes" fill="#000"><g transform="translate(0 0)"><rect class="bt-eye" x="0" y="0" width="0" height="0"/></g><g transform="translate(0 0)"><rect class="bt-eye" x="0" y="0" width="0" height="0"/></g><g transform="translate(0 0)"><path class="bt-eye-happy" opacity="0" d="" fill="none"/></g><g transform="translate(0 0)"><path class="bt-eye-happy" opacity="0" d="" fill="none"/></g></g></g></mask>'
  const grad = '<linearGradient id="st-atenea-grad" x1="15%" y1="0%" x2="85%" y2="100%"><stop offset="0%" stop-color="#38BDF8"/><stop offset="28%" stop-color="#00C8FF"/><stop offset="68%" stop-color="#0891B2"/><stop offset="100%" stop-color="#0A4A6A"/></linearGradient>'
  const sheenPaths = ATENEA_ISOTIPO.sheen.map(d => `<path d="${d}" fill="#fff" fill-opacity=".65"/>`).join('')
  const layers = `<g id="atenea-layers" transform="translate(10.748 85.991) scale(0.012521 -0.012521)" fill-rule="evenodd"><path d="${ATENEA_ISOTIPO.base}" fill="url(#st-atenea-grad)"/>${sheenPaths}</g>`
  return `<svg class="whale-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><defs>${grad}${mask}<g id="tail"></g>${layers}</defs><g class="bt-b"><g id="torso"><use href="#atenea-layers"/></g></g></svg>`
}

const rules = css => [...css.matchAll(/\{([^}]*)\}/gu)].map(([, body]) => new Map(body.split(';').filter(Boolean).map(item => item.split(/:(.*)/su).slice(0, 2))))
function pick(vars, names, from) {
  return names.map((name) => {
    if (!vars.has(name)) throw new Error(`${from} no longer sets ${name}`)
    return `${name}:${vars.get(name)}`
  }).join(';')
}

function tokens() {
  const [light, dark] = rules(themeCss(allThemes().deepseek))
  const base = readFileSync(new URL('styles.js', client), 'utf8').match(/^body\{(--bt-[^}]*)\}$/mu)
  if (!base) throw new Error('styles.js: the base body rule was not found')
  const [ink, inkDark] = INKS.deepseek
  return [
    '/* Generated from the DeepSeek theme in ds-bot/src/client/themes.js, inks.js and styles.js by scripts/start-assets.mjs; do not edit. */',
    `:root{color-scheme:light dark;${pick(light, THEME_TOKENS, 'themeCss')};--bt-ink-deepseek:${ink};${pick(rules(`{${base[1]}}`)[0], BASE_TOKENS, 'styles.js')}}`,
    `@media (prefers-color-scheme:dark){:root{${pick(dark, THEME_TOKENS, 'themeCss')};--bt-ink-deepseek:${inkDark}}}`,
  ]
}

// motion.js imports React for its hooks; its springs are plain arithmetic, so the module runs
// here with the React names stubbed out.
async function motion() {
  const source = readFileSync(new URL('motion.js', client), 'utf8')
  const imports = source.match(/^import .*$/gmu) ?? []
  const react = imports.length === 1 ? imports[0].match(/^import \{([^}]*)\} from 'react'\r?$/u) : null
  if (!react) throw new Error('motion.js: expected its only import to be from react')
  const stub = `const {${react[1].replaceAll(' as ', ': ')}} = {}`
  return import(`data:text/javascript,${encodeURIComponent(source.replace(imports[0], stub))}`)
}

async function springs() {
  const curves = await motion()
  return [
    '/* Generated from ds-bot/src/client/motion.js by scripts/start-assets.mjs; do not edit. */',
    ':root {',
    ...SPRINGS.flatMap((name) => {
      const curve = curves[`SPRING_${name.toUpperCase()}`]
      if (!curve) throw new Error(`motion.js no longer exports SPRING_${name.toUpperCase()}`)
      return [`  --spring-${name}: ${curve.easing};`, `  --spring-${name}-ms: ${curve.duration}ms;`]
    }),
    '}',
  ]
}

// Replaces what lies between the two markers; a block of lines takes the file's own line ends,
// which git may have turned into CRLF on checkout.
function between(text, open, close, block) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const body = Array.isArray(block) ? `${eol}${block.join(eol)}${eol}` : block
  const a = text.indexOf(open)
  const b = text.indexOf(close, a + open.length)
  if (a < 0 || b < 0) throw new Error(`markers ${open} ${close} not found`)
  return `${text.slice(0, a + open.length)}${body}${text.slice(b)}`
}

const files = {
  'start.html': html => between(html, '<!-- whale -->', '<!-- /whale -->', rig()),
  'start.css': async css => between(between(css, '/* tokens */', '/* /tokens */', tokens()), '/* springs */', '/* /springs */', await springs()),
}
const check = process.argv.includes('--check')
const stale = []
for (const [name, generate] of Object.entries(files)) {
  const file = new URL(name, page)
  const text = readFileSync(file, 'utf8')
  const next = await generate(text)
  if (next === text) continue
  stale.push(name)
  if (!check) writeFileSync(file, next)
}
if (check && stale.length) {
  console.error(`start page: stale generated blocks in ${stale.join(', ')}; run node scripts/start-assets.mjs`)
  process.exit(1)
}
console.log(check ? 'start page: generated blocks are current' : stale.length ? `start page: wrote ${stale.join(', ')}` : 'start page: nothing to write')
