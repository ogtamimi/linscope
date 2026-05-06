// Web Worker for heavy graph calculations
interface WorkerNode {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  r: number
  alpha: number
  age: number
  maxAge: number
}

interface WorkerEdge {
  fromId: string
  toId: string
  alpha: number
  age: number
  maxAge: number
}

interface UpdateMessage {
  type: 'updatePositions'
  nodes: WorkerNode[]
  edges: WorkerEdge[]
  width: number
  height: number
  dt: number
}

let nodes: WorkerNode[] = []
let edges: WorkerEdge[] = []

const update = (
  nodes: WorkerNode[],
  edges: WorkerEdge[],
  width: number,
  height: number,
  dt: number
) => {
  // Update node positions
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    
    // Apply gravity to center
    const dx = width / 2 - n.x
    const dy = height / 2 - n.y
    const dist = Math.sqrt(dx * dx + dy * dy) + 1
    const force = 0.0001 * (dist - 100)
    n.vx += (dx / dist) * force
    n.vy += (dy / dist) * force
    
    // Apply repulsion from other nodes
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue
      const other = nodes[j]
      const dx = n.x - other.x
      const dy = n.y - other.y
      const dist = Math.sqrt(dx * dx + dy * dy) + 0.1
      if (dist < 150) {
        const repel = 50 / (dist * dist)
        n.vx += (dx / dist) * repel
        n.vy += (dy / dist) * repel
      }
    }
    
    // Friction and velocity
    n.vx *= 0.95
    n.vy *= 0.95
    n.x += n.vx * dt
    n.y += n.vy * dt
    
    // Boundary constraints
    const padding = 50
    if (n.x < padding) {
      n.x = padding
      n.vx = Math.abs(n.vx) * 0.5
    }
    if (n.x > width - padding) {
      n.x = width - padding
      n.vx = -Math.abs(n.vx) * 0.5
    }
    if (n.y < padding) {
      n.y = padding
      n.vy = Math.abs(n.vy) * 0.5
    }
    if (n.y > height - padding) {
      n.y = height - padding
      n.vy = -Math.abs(n.vy) * 0.5
    }
    
    // Age tracking
    n.age++
    n.alpha = Math.max(0, 1 - (n.age / n.maxAge))
  }
  
  // Update edges
  for (let i = 0; i < edges.length; i++) {
    edges[i].age++
    edges[i].alpha = Math.max(0, 1 - (edges[i].age / edges[i].maxAge))
  }
}

self.onmessage = (event: MessageEvent<UpdateMessage>) => {
  const { type, nodes: inNodes, edges: inEdges, width, height, dt } = event.data
  
  if (type === 'updatePositions') {
    nodes = inNodes
    edges = inEdges
    update(nodes, edges, width, height, dt)
    
    self.postMessage({
      type: 'updated',
      nodes: nodes,
      edges: edges
    })
  }
}
