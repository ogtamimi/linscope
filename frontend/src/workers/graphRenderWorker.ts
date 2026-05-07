/// <reference lib="webworker" />

let canvas: OffscreenCanvas | null = null
let ctx: OffscreenCanvasRenderingContext2D | null = null
let colors: any = {}
let nodes: any[] = []
let edges: any[] = []
let frameRequestId: number | null = null
let animationActive = true
let quality = 1.0
let maxNodes = 35

self.onmessage = (e) => {
  const { type, canvas: offcanvas, colors: cols, maxNodes: maxN, maxEdges, events, quality: q, maxNodes: newMax } = e.data
  
  if (type === 'init') {
    canvas = offcanvas
    colors = cols
    maxNodes = maxN
    ctx = canvas.getContext('2d')
    startAnimation()
  } else if (type === 'events') {
    if (q) quality = q
    if (newMax) maxNodes = newMax
    // إضافة الأحداث الجديدة مع تحديد العدد الأقصى
    const newEvents = events || []
    for (const ev of newEvents.slice(-Math.floor(15 * quality))) {
      spawnNode(ev)
    }
    if (nodes.length > maxNodes) nodes = nodes.slice(-maxNodes)
    if (edges.length > maxNodes * 2) edges = edges.slice(-maxNodes * 2)
  }
}

function spawnNode(event: any) {
  if (!canvas) return
  const W = canvas.width, H = canvas.height
  if (W === 0 || H === 0) return
  const angle = Math.random() * Math.PI * 2
  const r = 80 + Math.random() * Math.min(W, H) * 0.2
  const node = {
    id: event.id,
    x: W/2 + Math.cos(angle)*r + (Math.random()-0.5)*60,
    y: H/2 + Math.sin(angle)*r + (Math.random()-0.5)*60,
    vx: (Math.random()-0.5)*0.5,
    vy: (Math.random()-0.5)*0.5,
    proc: event.process.slice(0,8),
    color: colors[event.event] || colors.unknown,
    r: event.event === 'exec' ? 9 : 7,
    alpha: 0,
    age: 0,
    maxAge: 180 + Math.random() * 150
  }
  if (nodes.length > 0) {
    const parent = nodes[Math.floor(Math.random() * Math.min(nodes.length, 6))]
    edges.push({ from: parent, to: node, alpha: 1, age: 0, maxAge: node.maxAge })
  }
  nodes.push(node)
}

function updatePhysics(dt: number) {
  for (const n of nodes) {
    n.x += n.vx * dt * 30
    n.y += n.vy * dt * 30
    if (canvas) {
      n.x = Math.min(Math.max(n.x, n.r+5), canvas.width - n.r-5)
      n.y = Math.min(Math.max(n.y, n.r+5), canvas.height - n.r-5)
    }
    n.vx *= 0.98
    n.vy *= 0.98
  }
}

function draw() {
  if (!canvas || !ctx) return
  const W = canvas.width, H = canvas.height
  if (W === 0 || H === 0) return
  
  ctx.clearRect(0, 0, W, H)
  // خلفية وأضواء خفيفة
  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, W, H)
  
  // حواف
  for (let i=edges.length-1; i>=0; i--) {
    const e = edges[i]
    e.age++
    e.alpha = Math.max(0, 1 - e.age/e.maxAge)
    if (e.alpha <= 0.02) { edges.splice(i,1); continue }
    ctx.beginPath()
    ctx.moveTo(e.from.x, e.from.y)
    ctx.lineTo(e.to.x, e.to.y)
    ctx.strokeStyle = `rgba(88,166,255,${e.alpha * 0.3})`
    ctx.lineWidth = 0.8
    ctx.stroke()
  }
  
  // عقد
  for (let i=nodes.length-1; i>=0; i--) {
    const n = nodes[i]
    n.age++
    n.alpha = n.age < 15 ? n.age/15 : Math.max(0, 1 - (n.age-15)/(n.maxAge-15))
    if (n.alpha <= 0.02) { nodes.splice(i,1); continue }
    
    // رسم مع توهج خفيف فقط إذا الجودة عالية
    ctx.beginPath()
    ctx.arc(n.x, n.y, n.r, 0, Math.PI*2)
    ctx.fillStyle = n.color + Math.round(n.alpha * 200).toString(16).padStart(2,'0')
    ctx.fill()
    if (quality > 0.7 && n.alpha > 0.3) {
      ctx.font = `8px monospace`
      ctx.fillStyle = `rgba(230,237,243,${n.alpha*0.6})`
      ctx.fillText(n.proc, n.x-12, n.y-8)
    }
  }
  
  // نقطة مركزية
  ctx.beginPath()
  ctx.arc(W/2, H/2, 5, 0, Math.PI*2)
  ctx.fillStyle = `rgba(88,166,255,0.4)`
  ctx.fill()
  
  frameRequestId = requestAnimationFrame(() => {
    if (animationActive) draw()
  })
}

function startAnimation() {
  animationActive = true
  let lastTime = performance.now()
  function animate() {
    const now = performance.now()
    const dt = Math.min(0.033, (now - lastTime) / 1000)
    lastTime = now
    updatePhysics(dt)
    draw()
    if (animationActive) frameRequestId = requestAnimationFrame(animate)
  }
  frameRequestId = requestAnimationFrame(animate)
}
