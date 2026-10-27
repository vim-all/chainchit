type EventCallback = (data: any) => void;

class SSEBroker {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  subscribe(channel: string, callback: EventCallback) {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)!.add(callback);

    // Return unsubscribe function
    return () => {
      const channelListeners = this.listeners.get(channel);
      if (channelListeners) {
        channelListeners.delete(callback);
        if (channelListeners.size === 0) {
          this.listeners.delete(channel);
        }
      }
    };
  }

  broadcast(channel: string, eventName: string, data: any) {
    const channelListeners = this.listeners.get(channel);
    if (!channelListeners) return;

    for (const callback of channelListeners) {
      try {
        callback({ event: eventName, data });
      } catch (err) {
        console.error('Error dispatching SSE event:', err);
      }
    }
  }
}

// Global singleton across hot-reloads
const globalForSSE = globalThis as unknown as { sseBroker?: SSEBroker };
export const sseBroker = globalForSSE.sseBroker ?? new SSEBroker();
if (process.env.NODE_ENV !== 'production') globalForSSE.sseBroker = sseBroker;
