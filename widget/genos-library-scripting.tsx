// Geno's Library home-screen widget for the Scripting app (widget.tsx).
// Shows your covers side by side and keeps them in full color, even when the
// Home Screen is set to Clear or Tinted.
// The app fills in the values below when you copy this script from Settings.

import { HStack, Image, Spacer, Text, VStack, Widget, fetch } from "scripting"

const SUPABASE_URL = "__SUPABASE_URL__"
const SUPABASE_KEY = "__SUPABASE_KEY__"
const WIDGET_CODE = "__WIDGET_CODE__"
const APP_URL = "__APP_URL__"

const ACCENT = "#d8b36a"
const MUTED = "#b4a796"
const CARD = "#241a12"

type Item = { title: string; sub?: string; cover?: string; color?: string }
type Snapshot = {
  reading?: Item[]
  watching?: Item[]
  tbrPicks?: Item[]
  albums?: Item[]
  tbrCount?: number
  readThisYear?: number
}
type Slot = { label: string; item: Item | null; square: boolean; path: string | null }

async function loadSnapshot(): Promise<Snapshot | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_widget`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: WIDGET_CODE })
    })
    if (!res.ok) return null
    const data = await res.json()
    return data && typeof data === "object" && !data.message ? data : null
  } catch (e) {
    return null
  }
}

function pickOne<T>(list?: T[]): T | null {
  return list && list.length ? list[Math.floor(Math.random() * list.length)] : null
}

// Covers are shrunk to widget size and saved where the widget can read them,
// so they load fast and stay within the widget's memory limit.
const CACHE = `${FileManager.appGroupDocumentsDirectory}/genos-library-covers`

function cacheName(url: string, w: number, h: number): string {
  const key = `${url}|${w}x${h}`
  let a = 5381, b = 52711
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i)
    a = ((a * 33) ^ c) >>> 0
    b = ((b * 33) ^ c) >>> 0
  }
  return `${CACHE}/${a.toString(36)}${b.toString(36)}.jpg`
}

async function coverFile(url: string | undefined, w: number, h: number, square: boolean): Promise<string | null> {
  if (!url) return null
  const pw = Math.round(w * 2), ph = Math.round((square ? w : h) * 2)
  const path = cacheName(url, pw, ph)
  try {
    if (!FileManager.existsSync(CACHE)) FileManager.createDirectorySync(CACHE, true)
    if (FileManager.existsSync(path)) return path
    const res = await fetch(String(url).replace(/^http:/, "https:"))
    if (!res.ok) return null
    const img = UIImage.fromData(await res.data())
    if (!img || !img.width || !img.height) return null
    // Crop to the frame's shape (covers fill the frame, album art stays square).
    const target = pw / ph
    let sw = img.width, sh = img.height
    if (sw / sh > target) sw = sh * target
    else sh = sw / target
    const small = img.renderedIn(
      { width: pw, height: ph },
      { position: { x: (img.width - sw) / 2, y: (img.height - sh) / 2 }, size: { width: sw, height: sh } }
    ) || img.preparingThumbnail({ width: pw, height: ph })
    const jpg = small && small.toJPEGData(0.85)
    if (!jpg) return null
    FileManager.writeAsDataSync(path, jpg)
    return path
  } catch (e) {
    return null
  }
}

function slotsFor(data: Snapshot, count: number): { label: string; item: Item | null; square: boolean }[] {
  const reading = data.reading || []
  const watching = data.watching || []
  const slots: { label: string; item: Item | null; square: boolean }[] = []
  reading.slice(0, 2).forEach(b => slots.push({ label: "Reading", item: b, square: false }))
  if (!reading.length) slots.push({ label: "Reading", item: null, square: false })
  slots.push({ label: "Watching", item: watching[0] || null, square: false })
  const album = pickOne(data.albums)
  if (album) slots.push({ label: "Spin next", item: album, square: true })
  return slots.slice(0, count)
}

function Cover({ slot, w, h }: { slot: Slot; w: number; h: number }) {
  const shape = { type: "rect", cornerRadius: 4 } as any
  if (slot.item && slot.path) {
    return <VStack frame={{ width: w, height: h }} widgetBackground={CARD}>
      <Image
        filePath={slot.path}
        resizable
        scaleToFit={slot.square}
        scaleToFill={!slot.square}
        widgetAccentedRenderingMode="fullColor"
        frame={{ width: w, height: slot.square ? w : h }}
        clipShape={shape}
      />
    </VStack>
  }
  return <VStack
    frame={{ width: w, height: h }}
    background={slot.item ? (slot.item.color || "#7a6a5a") : CARD}
    clipShape={shape}
  >
    <Spacer />
    <Text
      font={slot.item ? 11 : 9}
      fontWeight={slot.item ? "bold" : "regular"}
      foregroundStyle={slot.item ? "white" : MUTED}
      multilineTextAlignment="center"
      lineLimit={5}
     
      padding={4}
    >{slot.item ? slot.item.title : "Nothing yet"}</Text>
    <Spacer />
  </VStack>
}

function SlotView({ slot, w, h }: { slot: Slot; w: number; h: number }) {
  return <VStack spacing={3} alignment="leading">
    <Text font={8} fontWeight="semibold" foregroundStyle={ACCENT} lineLimit={1}>
      {slot.label.toUpperCase()}
    </Text>
    <Cover slot={slot} w={w} h={h} />
  </VStack>
}

function Row({ slots, w, h, gap }: { slots: Slot[]; w: number; h: number; gap: number }) {
  return <HStack spacing={gap} alignment="top">
    {slots.map(s => <SlotView slot={s} w={w} h={h} />)}
  </HStack>
}

async function withCovers(list: { label: string; item: Item | null; square: boolean }[], w: number, h: number): Promise<Slot[]> {
  const paths = await Promise.all(list.map(s => coverFile(s.item?.cover, w, h, s.square)))
  return list.map((s, i) => ({ ...s, path: paths[i] }))
}

async function main() {
  const data = await loadSnapshot()
  const size = Widget.displaySize
  const family = Widget.family
  const pad = 12, gap = 14, labelH = 13
  const bg = { light: "#1d1611", dark: "#14100d" } as any

  if (!data) {
    Widget.present(<VStack padding={12} alignment="leading" widgetBackground={bg} widgetURL={APP_URL} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}>
      <Text font={14} fontWeight="bold" foregroundStyle="#f3ece2">Geno's Library</Text>
      <Text font={11} foregroundStyle={MUTED}>Open the app once, then copy the widget script again from Settings.</Text>
    </VStack>)
    return
  }

  const refresh = { policy: "after", date: new Date(Date.now() + 30 * 60 * 1000) } as any

  if (family === "systemSmall") {
    const coverH = size.height - pad * 2 - labelH
    const coverW = Math.round(coverH * 2 / 3)
    const r = (data.reading || [])[0] || null
    const [slot] = await withCovers([{ label: "Reading", item: r, square: false }], coverW, coverH)
    Widget.present(<VStack widgetBackground={bg} widgetURL={APP_URL} frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
      <SlotView slot={slot} w={coverW} h={coverH} />
    </VStack>, refresh)
    return
  }

  if (family === "systemLarge") {
    const count = 4, g = 8
    const coverW = Math.floor((size.width - pad * 2 - g * (count - 1)) / count)
    const coverH = Math.min(Math.round(coverW * 1.5), Math.floor((size.height - 28 - 24 - 10 - 12 - labelH * 2) / 2))
    const w = Math.min(coverW, Math.round(coverH * 2 / 3))
    const top = slotsFor(data, count)
    const used = new Set(top.map(s => s.item && s.item.title))
    const rest = (data.tbrPicks || []).filter(b => !used.has(b.title)).sort(() => Math.random() - 0.5)
      .slice(0, count).map(b => ({ label: "On your TBR", item: b, square: false }))
    const [a, b] = await Promise.all([withCovers(top, w, coverH), withCovers(rest, w, coverH)])
    Widget.present(<VStack spacing={10} padding={{ top: 14, bottom: 14, leading: pad, trailing: pad }} widgetBackground={bg} widgetURL={APP_URL} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "top" }}>
      <HStack>
        <Text font={{ name: "Georgia", size: 17 }} foregroundStyle="#f3ece2">Geno's Library</Text>
        <Spacer />
        <Text font={10} foregroundStyle={MUTED}>{`${data.tbrCount || 0} TBR · ${data.readThisYear || 0} read this year`}</Text>
      </HStack>
      <Row slots={a} w={w} h={coverH} gap={g} />
      {b.length ? <Row slots={b} w={w} h={coverH} gap={g} /> : <Spacer />}
      <Spacer />
    </VStack>, refresh)
    return
  }

  // Medium: Reading · Watching · Spin next, side by side.
  const list = slotsFor(data, 4)
  const coverH0 = size.height - pad * 2 - labelH
  const coverW = Math.min(Math.round(coverH0 * 2 / 3), Math.floor((size.width - pad * 2 - gap * (list.length - 1)) / list.length))
  const coverH = Math.round(coverW * 1.5)
  const slots = await withCovers(list, coverW, coverH)
  Widget.present(<HStack widgetBackground={bg} widgetURL={APP_URL} frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
    <Spacer />
    <Row slots={slots} w={coverW} h={coverH} gap={gap} />
    <Spacer />
  </HStack>, refresh)
}

main()
