// Geno's Library home-screen widget for the Scriptable app.
// Works as a small, medium or large widget. Tap it to open your library.
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
function addCover(parent, item, w, h, image) {
  const box = parent.addStack();
  box.size = new Size(w, h);
  box.cornerRadius = 3;
  box.backgroundColor = new Color(item && item.color ? item.color : "#7a6a5a");
  if (image) {
    const pic = box.addImage(image);
    pic.imageSize = new Size(w, h);
    pic.applyFillingContentMode();
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

// One row: cover on the left, a label and the title on the right.
function addRow(parent, label, item, image, coverW, coverH, empty) {
  const row = parent.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  if (item) {
    addCover(row, item, coverW, coverH, image);
    row.addSpacer(8);
  }
  const col = row.addStack();
  col.layoutVertically();
  const l = col.addText(label.toUpperCase());
  l.font = Font.semiboldSystemFont(9);
  l.textColor = C.accent;
  const t = col.addText(item ? item.title : empty);
  t.font = item ? Font.boldSystemFont(13) : Font.systemFont(12);
  t.textColor = item ? C.text : C.muted;
  t.lineLimit = 2;
  if (item && item.sub) {
    const s = col.addText(item.sub);
    s.font = Font.systemFont(10);
    s.textColor = C.muted;
    s.lineLimit = 1;
  }
  row.addSpacer();
}

async function build(family) {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
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

  const reading = data.reading || [];
  const watching = data.watching || [];
  const next = pickOne(data.tbrPicks);
  const album = pickOne(data.albums);

  if (family === "small") {
    w.setPadding(10, 10, 10, 10);
    const item = reading[0] || next;
    const label = reading[0] ? "Reading" : "Read next";
    const l = w.addText(label.toUpperCase());
    l.font = Font.semiboldSystemFont(9);
    l.textColor = C.accent;
    w.addSpacer(6);
    const row = w.addStack();
    row.layoutHorizontally();
    addCover(row, item, 48, 72, await loadImage(item && item.cover));
    row.addSpacer(6);
    const col = row.addStack();
    col.layoutVertically();
    const t = col.addText(item ? item.title : "Add books to your TBR");
    t.font = Font.boldSystemFont(12);
    t.textColor = C.text;
    t.lineLimit = 4;
    t.minimumScaleFactor = 0.7;
    if (item && item.sub) {
      const s = col.addText(item.sub);
      s.font = Font.systemFont(10);
      s.textColor = C.muted;
      s.lineLimit = 2;
    }
    w.addSpacer();
    const f = w.addText(`${data.tbrCount || 0} on your TBR`);
    f.font = Font.systemFont(9);
    f.textColor = C.muted;
    return w;
  }

  if (family === "medium") {
    w.setPadding(10, 12, 10, 12);
    const r = reading[0] || null;
    const [imgR, imgW, imgN] = await Promise.all([
      loadImage(r && r.cover), loadImage(watching[0] && watching[0].cover), loadImage(next && next.cover)
    ]);
    addRow(w, "Reading", r, imgR, 26, 39, "Nothing yet");
    w.addSpacer(5);
    addRow(w, "Watching", watching[0] || null, imgW, 26, 39, "Nothing yet");
    w.addSpacer(5);
    addRow(w, "Read next", next, imgN, 26, 39, "Your TBR is empty");
    return w;
  }

  // Large
  w.setPadding(14, 14, 14, 14);
  const head = w.addStack();
  head.layoutHorizontally();
  const h = head.addText("Geno's Library");
  h.font = new Font("Georgia", 18);
  h.textColor = C.text;
  head.addSpacer();
  const c = head.addText(`${data.tbrCount || 0} TBR · ${data.readThisYear || 0} read this year`);
  c.font = Font.systemFont(10);
  c.textColor = C.muted;
  w.addSpacer(10);

  const rows = [];
  reading.slice(0, 2).forEach((b, i) => rows.push([i === 0 ? "Reading" : "Also reading", b]));
  if (!reading.length) rows.push(["Reading", null]);
  rows.push(["Watching", watching[0] || null]);
  rows.push(["Spinning next", album]);
  rows.push(["Read next", next]);
  const images = await Promise.all(rows.map(([, item]) => loadImage(item && item.cover)));
  rows.forEach(([label, item], i) => {
    addRow(w, label, item, images[i], 34, 51, "Nothing yet");
    if (i < rows.length - 1) w.addSpacer(8);
  });
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
