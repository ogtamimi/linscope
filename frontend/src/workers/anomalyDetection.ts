// Anomaly Detection Web Worker
// Heuristic: frequency of events per PID and parent/child relationships

const scores = new Map(); // PID -> score
const lastEvents = new Map(); // PID -> timestamps[]

self.onmessage = (e) => {
  const { type, data } = e.data;
  
  if (type === 'events') {
    const events = data;
    const now = Date.now();
    const updatedPids = new Set();

    events.forEach(event => {
      const { pid, ppid, event: eventType } = event;
      if (!pid) return;

      // Track frequency
      if (!lastEvents.has(pid)) lastEvents.set(pid, []);
      const times = lastEvents.get(pid);
      times.push(now);
      
      // Keep only last 5 seconds
      const startIndex = times.findIndex(t => now - t < 5000);
      if (startIndex > 0) times.splice(0, startIndex);

      // Heuristic calculation
      let score = 0;
      
      // 1. Frequency score (max 10 events in 5s before it gets suspicious)
      if (times.length > 20) score += 40;
      else if (times.length > 10) score += 20;

      // 2. High risk events
      if (eventType === 'exec' && ppid === 1) score += 30; // Sensitive parent
      if (eventType === 'connect') score += 10;

      // Update global map
      const current = scores.get(pid) || 0;
      // Decay current score slowly
      const decay = 0.95;
      const finalScore = Math.min(100, (current * decay) + score);
      
      scores.set(pid, finalScore);
      updatedPids.add(pid);
    });

    // Send back scores for active nodes
    const results = {};
    scores.forEach((score, pid) => {
      // Periodic decay for inactive nodes
      if (!updatedPids.has(pid)) {
        const decayed = score * 0.9;
        if (decayed < 5) scores.delete(pid);
        else {
           scores.set(pid, decayed);
           results[pid] = decayed;
        }
      } else {
        results[pid] = score;
      }
    });

    self.postMessage({ type: 'scores', data: results });
  }
};
