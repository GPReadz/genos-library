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
    const req = new Request(url);
    req.timeoutInterval = 8;
    return await req.loadImage();
  } catch (e) {
    return null;
  }
}

function pickOne(list) {
  return list && list.length ? list[Math.floor(Math.random() * list.length)] : null;
}

// A cover (or a genre-colored stand-in) at a fixed size.
function addCover(parent, item, w, h, image, square) {
  const box = parent.addStack();
  box.size = new Size(w, h);
  box.cornerRadius = 4;
  box.backgroundColor = new Color(item && item.color ? item.color : "#7a6a5a");
  if (image) {
    if (square) {
      box.backgroundColor = C.card;
      box.centerAlignContent();
      const pic = box.addImage(image);
      pic.imageSize = new Size(w, w);
    } else {
      const pic = box.addImage(image);
      pic.imageSize = new Size(w, h);
      pic.applyFillingContentMode();
    }
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
    addCover(col, item, w, h, image, label === "Spin next");
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

// The covers to show: what you're reading and watching, then picks to fill.
function slotsFor(data, count) {
  const reading = data.reading || [];
  const watching = data.watching || [];
  const picks = [...(data.tbrPicks || [])].sort(() => Math.random() - 0.5);
  const slots = [];
  reading.slice(0, 2).forEach(b => slots.push(["Reading", b]));
  if (!reading.length) slots.push(["Reading", null]);
  slots.push(["Watching", watching[0] || null]);
  const album = pickOne(data.albums);
  if (album && slots.length < count) slots.push(["Spin next", album]);
  while (slots.length < count) {
    const b = picks.shift();
    if (!b) break;
    slots.splice(slots.length - (album ? 1 : 0), 0, ["Read next", b]);
  }
  return slots.slice(0, count);
}

async function addCoverRow(w, slots, coverW, coverH, gap) {
  const images = await Promise.all(slots.map(([, item]) => loadImage(item && item.cover)));
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
    const item = r || pickOne(data.tbrPicks);
    const coverH = size.h - pad * 2 - labelH;
    const row = w.addStack();
    row.layoutHorizontally();
    row.addSpacer();
    addSlot(row, r ? "Reading" : "Read next", item, await loadImage(item && item.cover), Math.round(coverH * 2 / 3), coverH);
    row.addSpacer();
    return w;
  }

  if (family === "medium") {
    w.setPadding(pad, pad, pad, pad);
    const count = 4;
    const coverH = size.h - pad * 2 - labelH;
    const coverW = Math.min(Math.round(coverH * 2 / 3), Math.floor((size.w - pad * 2 - gap * (count - 1)) / count));
    const row = w.addStack();
    row.layoutHorizontally();
    row.addSpacer();
    await addCoverRow(row, slotsFor(data, count), coverW, Math.round(coverW * 1.5), gap);
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
  const rest = (data.tbrPicks || []).filter(b => !used.has(b.title)).sort(() => Math.random() - 0.5).slice(0, count).map(b => ["Read next", b]);
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

const family = config.widgetFamily || "large";
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
