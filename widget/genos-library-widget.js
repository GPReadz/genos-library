// Geno's Library home-screen widget for the Scriptable app.
// Works as a small, medium or large widget and shows your covers side by side.
// Tap it to open your library.
// The app fills in the three values below when you copy this script from Settings.

const SUPABASE_URL = "__SUPABASE_URL__";
const SUPABASE_KEY = "__SUPABASE_KEY__";
const WIDGET_CODE = "__WIDGET_CODE__";
const APP_URL = "__APP_URL__";

const C = {
  bg: new Color("#14100d"),
  card: new Color("#241a12"),
  text: new Color("#f3ece2"),
  muted: new Color("#b4a796"),
  accent: new Color("#d8b36a"),
  wood: new Color("#4a3220")
};

async function loadSnapshot() {
  const req = new Request(`${SUPABASE_URL}/rest/v1/rpc/get_widget`);
  req.method = "POST";
  req.headers = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };
  req.body = JSON.stringify({ p_secret: WIDGET_CODE });
  req.timeoutInterval = 15;
  const data = await req.loadJSON();
  if (!data || typeof data !== "object" || data.code || data.message) return null;
  return data;
}

async function loadImage(url) {
  if (!url) return null;
  try {
    const req = new Request(String(url).replace(/^http:/, "https:"));
    req.timeoutInterval = 10;
    req.headers = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" };
    const img = await req.loadImage();
    return img && img.size && img.size.width > 0 ? img : null;
  } catch (e) {
    return null;
  }
}

// Redraw a cover at the exact size it shows on the widget. Big photos and
// full-size covers otherwise come out blank, because widgets drop large images.
function shrink(image, w, h, fill) {
  try {
    const scale = 2;
    const W = Math.round(w * scale), H = Math.round(h * scale);
    const iw = image.size.width, ih = image.size.height;
    const s = fill ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih);
    const dw = iw * s, dh = ih * s;
    const ctx = new DrawContext();
    ctx.size = new Size(W, H);
    ctx.opaque = false;
    ctx.respectScreenScale = false;
    ctx.drawImageInRect(image, new Rect((W - dw) / 2, (H - dh) / 2, dw, dh));
    return ctx.getImage();
  } catch (e) {
    return null;
  }
}

function pickOne(list) {
  return list && list.length ? list[Math.floor(Math.random() * list.length)] : null;
}

// Covers are saved on the phone after the first download, so the home-screen
// widget (which has little time and memory) can show them without re-downloading.
const FM = FileManager.local();
const CACHE = FM.joinPath(FM.cacheDirectory(), "genos-library-covers");
if (!FM.fileExists(CACHE)) FM.createDirectory(CACHE, true);
function cacheName(url, w, h, fill) {
  const key = `${url}|${w}x${h}|${fill ? 1 : 0}`;
  let a = 5381, b = 52711;
  for (let i = 0; i < key.length; i++) { const c = key.charCodeAt(i); a = (a * 33) ^ c; b = (b * 33) ^ c; }
  return FM.joinPath(CACHE, `${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}.png`);
}
async function coverImage(url, w, h, fill) {
  if (!url) return null;
  const path = cacheName(url, w, h, fill);
  try { if (FM.fileExists(path)) { const img = FM.readImage(path); if (img) return img; } } catch (e) {}
  const big = await loadImage(url);
  if (!big) return null;
  const small = shrink(big, w, h, fill);
  if (small) { try { FM.writeImage(path, small); } catch (e) {} }
  return small;
}

// A cover (or a genre-colored stand-in) at a fixed size.
function addCover(parent, item, w, h, image, square) {
  const box = parent.addStack();
  box.size = new Size(w, h);
  box.cornerRadius = 4;
  box.backgroundColor = new Color(item && item.color ? item.color : "#7a6a5a");
  const small = image;
  if (small) {
    if (square) box.backgroundColor = C.card;
    const pic = box.addImage(small);
    pic.imageSize = new Size(w, h);
  } else {
    box.setPadding(3, 3, 3, 3);
    box.centerAlignContent();
    const t = box.addText(item ? item.title : "");
    t.font = Font.boldSystemFont(Math.max(7, Math.round(w / 6)));
    t.textColor = Color.white();
    t.minimumScaleFactor = 0.5;
    t.centerAlignText();
  }
}

// Widget size in points for this phone (Apple's published sizes).
function widgetSize(family) {
  const sw = Math.min(Device.screenSize().width, Device.screenSize().height);
  const t = sw >= 428 ? { small: 170, medium: [364, 170], large: [364, 382] }
          : sw >= 390 ? { small: 158, medium: [338, 158], large: [338, 354] }
          : sw >= 375 ? { small: 155, medium: [329, 155], large: [329, 345] }
          :             { small: 141, medium: [292, 141], large: [292, 311] };
  const v = t[family];
  return Array.isArray(v) ? { w: v[0], h: v[1] } : { w: v, h: v };
}

// A label over a cover. Albums sit centered in the same-sized frame.
function addSlot(parent, label, item, image, w, h) {
  const col = parent.addStack();
  col.layoutVertically();
  col.size = new Size(w, 0);
  const l = col.addText(label.toUpperCase());
  l.font = Font.semiboldSystemFont(8);
  l.textColor = C.accent;
  l.lineLimit = 1;
  l.minimumScaleFactor = 0.6;
  col.addSpacer(3);
  if (item) {
    addCover(col, item, w, h, image, label === "Spin next" || label === "Listening");
  } else {
    const box = col.addStack();
    box.size = new Size(w, h);
    box.cornerRadius = 4;
    box.backgroundColor = C.card;
    box.setPadding(4, 4, 4, 4);
    box.centerAlignContent();
    const t = box.addText("Nothing yet");
    t.font = Font.systemFont(9);
    t.textColor = C.muted;
    t.centerAlignText();
  }
}

// The covers to show: what you're reading, what you're watching, and an album to spin.
function slotsFor(data, count) {
  const reading = data.reading || [];
  const watching = data.watching || [];
  const slots = [];
  reading.slice(0, 2).forEach(b => slots.push(["Reading", b]));
  if (!reading.length) slots.push(["Reading", null]);
  slots.push(["Watching", watching[0] || null]);
  const now = (data.listening || [])[0];
  const album = now || pickOne(data.albums);
  if (album) slots.push([now ? "Listening" : "Spin next", album]);
  return slots.slice(0, count);
}

async function addCoverRow(w, slots, coverW, coverH, gap) {
  const images = await Promise.all(slots.map(([label, item]) => coverImage(item && item.cover, coverW, coverH, label !== "Spin next" && label !== "Listening")));
  const row = w.addStack();
  row.layoutHorizontally();
  row.topAlignContent();
  slots.forEach(([label, item], i) => {
    if (i) row.addSpacer(gap);
    addSlot(row, label, item, images[i], coverW, coverH);
  });
}

async function build(family) {
  const w = new ListWidget();
  const bg = new LinearGradient();
  bg.colors = [new Color("#1d1611"), C.bg];
  bg.locations = [0, 1];
  w.backgroundGradient = bg;
  w.url = APP_URL;
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);

  let data = null;
  try { data = await loadSnapshot(); } catch (e) { data = null; }

  if (!data) {
    w.setPadding(12, 12, 12, 12);
    const t = w.addText("Geno's Library");
    t.font = Font.boldSystemFont(14);
    t.textColor = C.text;
    w.addSpacer(6);
    const m = w.addText("Open the app once, then check your widget code in Settings.");
    m.font = Font.systemFont(11);
    m.textColor = C.muted;
    return w;
  }

  const size = widgetSize(family);
  const pad = 12, gap = 8, labelH = 13;

  if (family === "small") {
    w.setPadding(pad, pad, pad, pad);
    const r = (data.reading || [])[0];
    const item = r || null;
    const coverH = size.h - pad * 2 - labelH;
    const row = w.addStack();
    row.layoutHorizontally();
    row.addSpacer();
    const sw = Math.round(coverH * 2 / 3);
    addSlot(row, "Reading", item, await coverImage(item && item.cover, sw, coverH, true), sw, coverH);
    row.addSpacer();
    return w;
  }

  if (family === "medium") {
    w.setPadding(pad, pad, pad, pad);
    const slots = slotsFor(data, 4);
    const coverH = size.h - pad * 2 - labelH;
    const coverW = Math.min(Math.round(coverH * 2 / 3), Math.floor((size.w - pad * 2 - gap * (slots.length - 1)) / slots.length));
    const row = w.addStack();
    row.layoutHorizontally();
    row.addSpacer();
    await addCoverRow(row, slots, coverW, Math.round(coverW * 1.5), gap + 6);
    row.addSpacer();
    return w;
  }

  // Large: header, current covers, then a row of TBR picks.
  w.setPadding(14, pad, 14, pad);
  const head = w.addStack();
  head.layoutHorizontally();
  head.centerAlignContent();
  const h = head.addText("Geno's Library");
  h.font = new Font("Georgia", 17);
  h.textColor = C.text;
  head.addSpacer();
  const c = head.addText(`${data.tbrCount || 0} TBR · ${data.readThisYear || 0} read this year`);
  c.font = Font.systemFont(10);
  c.textColor = C.muted;
  w.addSpacer(10);
  const count = 4;
  const coverW = Math.floor((size.w - pad * 2 - gap * (count - 1)) / count);
  const coverH = Math.min(Math.round(coverW * 1.5), Math.floor((size.h - 28 - 24 - 10 - 12 - labelH * 2) / 2));
  const top = slotsFor(data, count);
  const used = new Set(top.map(([, it]) => it && it.title));
  const rest = (data.tbrPicks || []).filter(b => !used.has(b.title)).sort(() => Math.random() - 0.5).slice(0, count).map(b => ["On your TBR", b]);
  for (const [i, slots] of [top, rest].entries()) {
    if (i) w.addSpacer(12);
    const line = w.addStack();
    line.layoutHorizontally();
    line.addSpacer();
    await addCoverRow(line, slots, Math.min(coverW, Math.round(coverH * 2 / 3)), coverH, gap);
    line.addSpacer();
  }
  w.addSpacer();
  return w;
}

const family = config.widgetFamily || "medium";
const widget = await build(family);
if (config.runsInWidget) {
  Script.setWidget(widget);
} else if (family === "small") {
  await widget.presentSmall();
} else if (family === "medium") {
  await widget.presentMedium();
} else {
  await widget.presentLarge();
}
Script.complete();
