/**
 * Pelari uji render dashboard admin.
 *
 * Dipisah dari berkas uji utama karena JSX harus di-bundle lebih dulu
 * (esbuild), sedangkan lingkungan DOM tiruan (jsdom) disiapkan di sini.
 *
 * Pemakaian: node jalan.cjs <modul-hasil-bundle> <mode>
 *   mode 0 = /api/diagnose membalas 200 TANPA summary (penyebab crash)
 *   mode 1 = /api/diagnose normal
 */
const { JSDOM } = require('jsdom');

const modul = process.argv[2];
const mode = Number(process.argv[3] || 0);

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://cilegon-enggih.vercel.app/admin',
  pretendToBeVisual: true
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.localStorage = dom.window.localStorage;
global.sessionStorage = dom.window.sessionStorage;
global.matchMedia = dom.window.matchMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {}
});
global.IntersectionObserver = dom.window.IntersectionObserver = class {
  observe() {}
  disconnect() {}
  unobserve() {}
};
global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
global.IS_REACT_ACT_ENVIRONMENT = true;
global.process = process;

/* React mensintesis event dari konstruktor DOM — semuanya harus tersedia. */
global.MouseEvent = dom.window.MouseEvent;
global.Event = dom.window.Event;
global.KeyboardEvent = dom.window.KeyboardEvent;
global.InputEvent = dom.window.InputEvent;

dom.window.fetch = global.fetch;
global.__MODE__ = mode;
dom.window.__MODE__ = mode;

require(modul);
