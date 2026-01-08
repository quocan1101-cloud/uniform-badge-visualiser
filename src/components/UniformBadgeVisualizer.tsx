import React, { useMemo, useRef, useState } from 'react'
import slots from '../data/slots.json'
import badges from '../data/badges.json'

type SlotKey = keyof typeof slots
type Slot = typeof slots[SlotKey]
type BadgeId = keyof typeof badges
type Badge = typeof badges[BadgeId]

type Placed = {
  id: string
  label: string
  slot: SlotKey
  x: number
  y: number
  w: number
  h: number
  z: number
  color: string
  asset?: string
}

// --- Text fit helpers ---
let _measureCtx: CanvasRenderingContext2D | null = null;
function getCtx() {
  if (_measureCtx) return _measureCtx;
  const c = document.createElement('canvas');
  _measureCtx = c.getContext('2d');
  return _measureCtx;
}

/**
 * Returns a font size (px) that fits the given label inside a box.
 * - Constrained by box height (maxHeightRatio of boxH)
 * - Constrained by box width (using canvas measureText at a baseline size)
 */
function fitFontSize(
  label: string,
  boxW: number,
  boxH: number,
  opts?: { padding?: number; maxHeightRatio?: number; weight?: number | string; family?: string }
) {
  const ctx = getCtx();
  const padding = opts?.padding ?? 8;                  // left/right padding inside the box
  const maxHeightRatio = opts?.maxHeightRatio ?? 0.7;  // text height vs box height
  const weight = opts?.weight ?? 600;
  const family = opts?.family ?? 'Inter, Arial, sans-serif';

  const maxFontByHeight = Math.max(10, boxH * maxHeightRatio);
  if (!ctx) return Math.floor(Math.min(18, maxFontByHeight)); // fallback

  // Measure at a known baseline size, then scale
  const BASE = 100;
  ctx.font = `${weight} ${BASE}px ${family}`;
  const measured = ctx.measureText(label).width || BASE * 0.6 * label.length;

  const availableW = Math.max(10, boxW - padding * 2);
  const fontByWidth = (availableW / measured) * BASE;

  const final = Math.max(10, Math.floor(Math.min(maxFontByHeight, fontByWidth)));
  return final;
}


const RANK_IDS = Object.entries(badges).filter(([, b]) => (b as any).category === 'rank').map(([id]) => id)
const SAF_IDS  = Object.entries(badges).filter(([, b]) => (b as any).category === 'saf').map(([id]) => id)
const FOR_IDS  = Object.entries(badges).filter(([, b]) => (b as any).category === 'foreign').map(([id]) => id)
const MED_IDS  = Object.entries(badges).filter(([, b]) => (b as any).category === 'medal').map(([id]) => id)
const PROF_IDS = Object.entries(badges).filter(([, b]) => (b as any).category === 'proficiency').map(([id]) => id)

export default function UniformBadgeVisualizer() {
  const [selectedRank, setSelectedRank] = useState<string>('')
  const [selectedSAF, setSelectedSAF] = useState<string[]>([])
  const [selectedFOR, setSelectedFOR] = useState<string[]>([])
  const [selectedMED, setSelectedMED] = useState<string[]>([])
  const [selectedPROF, setSelectedPROF] = useState<string[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const { layout, warnings } = useMemo(() => {
    const ids = [
      selectedRank,
      ...selectedSAF,
      ...selectedFOR,
      ...selectedMED,
      ...selectedPROF
    ].filter(Boolean)
    return computeLayout(ids)
  }, [selectedRank, selectedSAF, selectedFOR, selectedMED, selectedPROF])

  const onChangeSAF: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    const values = Array.from(e.target.selectedOptions).map(o => o.value).slice(0, 3)
    setSelectedSAF(values); setConfirmed(false)
  }
  const onChangeFOR: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    const values = Array.from(e.target.selectedOptions).map(o => o.value).slice(0, 3)
    setSelectedFOR(values); setConfirmed(false)
  }
  const onChangeMED: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    const values = Array.from(e.target.selectedOptions).map(o => o.value)
    setSelectedMED(values); setConfirmed(false)
  }
  const onChangePROF: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    const values = Array.from(e.target.selectedOptions).map(o => o.value)
    setSelectedPROF(values); setConfirmed(false)
  }

  const confirm = () => setConfirmed(true)

  const downloadPNG = async () => {
    const svg = svgRef.current
    if (!svg) return
    const serializer = new XMLSerializer()
    const svgString = serializer.serializeToString(svg)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const svgData = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`

    await new Promise<void>(resolve => {
      img.onload = () => resolve()
      img.src = svgData
    })

    const width = 1000
    const height = 1200
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0)
    const png = canvas.toDataURL('image/png')

    const a = document.createElement('a')
    a.href = png
    a.download = 'uniform-arrangement.png'
    a.click()
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6 grid md:grid-cols-5 gap-6">
      <div className="md:col-span-2">
        <h1 className="text-2xl font-semibold mb-2">Uniform Badge Visualizer</h1>
        <p className="text-sm text-gray-500 mb-4">
          Select badges to see the position they should be placed.
        </p>

        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Rank (Left Sleeve)</label>
            <select value={selectedRank} onChange={(e) => { setSelectedRank(e.target.value); setConfirmed(false) }} className="w-full border rounded-lg p-2 bg-white">
              <option value="">Select rank...</option>
              {RANK_IDS.map((id) => (<option key={id} value={id}>{(badges as any)[id].label}</option>))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">SAF Badges (max 3) — Pyramid</label>
            <select multiple size={5} value={selectedSAF} onChange={onChangeSAF} className="w-full border rounded-lg p-2 bg-white">
              {SAF_IDS.map((id) => (<option key={id} value={id}>{(badges as any)[id].label}</option>))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Foreign Badges (max 3) — Pyramid</label>
            <select multiple size={5} value={selectedFOR} onChange={onChangeFOR} className="w-full border rounded-lg p-2 bg-white">
              {FOR_IDS.map((id) => (<option key={id} value={id}>{(badges as any)[id].label}</option>))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Medals (Centered under Right Pocket)</label>
            <select multiple size={5} value={selectedMED} onChange={onChangeMED} className="w-full border rounded-lg p-2 bg-white">
              {MED_IDS.map((id) => (<option key={id} value={id}>{(badges as any)[id].label}</option>))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Proficiency Badges (Right Sleeve, Vertical)</label>
            <select multiple size={5} value={selectedPROF} onChange={onChangePROF} className="w-full border rounded-lg p-2 bg-white">
              {PROF_IDS.map((id) => (<option key={id} value={id}>{(badges as any)[id].label}</option>))}
            </select>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded p-2 mb-3">
            <strong>Note:</strong> {warnings.join(' ')}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={confirm} className="px-4 py-2 rounded-xl bg-gray-900 text-white shadow hover:shadow-md active:scale-[0.99]">Confirm arrangement</button>
          <button onClick={downloadPNG} className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50">Export PNG</button>
        </div>
      </div>

      <div className="md:col-span-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm font-medium mb-2">Arrangement preview</div>
          <div className="overflow-auto border rounded-xl">
            <svg ref={svgRef} viewBox="0 0 1000 1200" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto bg-white">
              <image href="/uniforms/no1_top.PNG" x="160" y="0" width="700" height="1400" preserveAspectRatio="xMidYMid meet" />
              <g opacity="0.12">
                {Object.entries(slots).sort((a, b) => a[1].z - b[1].z).map(([slot, box]) => (
                  <g key={slot}>
                    <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="#10b981" />
                    <text x={box.x + 6} y={box.y + 16} fontSize="16" fill="#000">{slot}</text>
                  </g>
                ))}
              </g>
              {confirmed && (
                <g id="badges">
                  {layout.sort((a, b) => a.z - b.z).map((b) => (
                    <g key={b.id}>
                      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6} fill={b.color} />
                      <text x={b.x + b.w / 2} y={b.y + b.h / 2} fontSize={fitFontSize(b.label, b.w, b.h)} textAnchor="middle" dominantBaseline="middle" fill="#fff">
                      {b.label}
                      </text>
                    </g>
                  ))}
                </g>
              )}
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

function computeLayout(selectedIds: string[]): { layout: Placed[], warnings: string[] } {
  const placed: Placed[] = []
  const warnings: string[] = []
  const bySlot: Record<string, Placed[]> = {}

  // Group by slot
  for (const id of selectedIds) {
    const spec = (badges as any)[id] as Badge | undefined
    if (!spec) continue
    const slotKey = spec.slot as SlotKey
    const box = (slots as any)[slotKey] as Slot | undefined
    if (!box) continue
    const entry: Placed = { id, label: (spec as any).label, slot: slotKey, x: box.x, y: box.y, w: box.w, h: box.h, z: box.z, color: (spec as any).color, asset: (spec as any).asset }
    bySlot[slotKey] ??= []
    bySlot[slotKey].push(entry)
  }

  for (const [slotKey, items] of Object.entries(bySlot)) {
    const box = (slots as any)[slotKey] as Slot
    if (slotKey === 'safBadges' || slotKey === 'foreignBadges') {
      const n = Math.min(3, items.length)
      if (items.length > 3) warnings.push(`${slotKey} allows max 3; extra selections ignored.`)
      const gap = 8
      const tileH = Math.min(box.h, 60)
      const tileW = Math.min(box.w, 90)

      if (n === 1) {
        const it = items[0]
        it.x = box.x + (box.w - tileW) / 2
        it.y = box.y
        it.w = tileW; it.h = tileH
        placed.push(it)
      } else if (n === 2) {
        const totalW = tileW * 2 + gap
        let startX = box.x + (box.w - totalW) / 2
        items.slice(0,2).forEach((it, i) => {
          it.x = startX + i * (tileW + gap)
          it.y = box.y
          it.w = tileW; it.h = tileH
          placed.push(it)
        })
      } else if (n >= 3) {
        const top = items[0]
        top.x = box.x + (box.w - tileW) / 2
        top.y = box.y
        top.w = tileW; top.h = tileH
        placed.push(top)

        const totalW = tileW * 2 + gap
        let startX = box.x + (box.w - totalW) / 2
        items.slice(1,3).forEach((it, i) => {
          it.x = startX + i * (tileW + gap)
          it.y = box.y + tileH + gap
          it.w = tileW; it.h = tileH
          placed.push(it)
        })
      }
    } else if (slotKey === 'medalsBelowRightPocket') {
      const gap = 10
      const tileH = Math.min(box.h, 400)
      const tileW = 50
      const n = items.length
      const totalW = n * tileW + (n - 1) * gap
      let startX = box.x + (box.w - totalW) / 2
      items.forEach((it, i) => {
        it.x = startX + i * (tileW + gap)
        it.y = box.y
        it.w = tileW; it.h = tileH
        placed.push(it)
      })
    } else if (slotKey === 'rightSleeveProficiency') {
      const gap = 8
      const tileH = 36
      items.forEach((it, i) => {
        it.x = box.x
        it.y = box.y + i * (tileH + gap)
        it.w = box.w
        it.h = tileH
        placed.push(it)
      })
    } else {
      placed.push(items[0])
      if (items.length > 1) warnings.push(`${slotKey}: multiple selections; only first shown.`)
    }
  }

  return { layout: placed, warnings }
}
