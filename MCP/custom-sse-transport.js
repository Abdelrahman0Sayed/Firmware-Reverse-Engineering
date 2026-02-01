/**
 * Custom SSE Transport for FastMCP compatibility
 * Properly handles session_id from FastMCP server
 */

const { EventSource } = require('eventsource');
const fetch = require('node-fetch');

class FastMCPSSETransport {
  constructor(url) {
    this.baseUrl = url.toString().replace(/\/+$/, ''); // Remove trailing slashes
    this.sessionId = null;
    this.messagesUrl = null;
    this.eventSource = null;
    this._messageHandlers = new Map();
    this._nextMessageId = 1;
  }

  async start() {
    return new Promise((resolve, reject) => {
      try {
        // Connect to SSE endpoint
        this.eventSource = new EventSource(this.baseUrl);
        
        this.eventSource.addEventListener('endpoint', (event) => {
          try {
            // Extract session_id from the endpoint data
            // Format: /messages/?session_id=<id>
            const endpointUrl = event.data;
            if (endpointUrl.includes('session_id=')) {
              this.sessionId = endpointUrl.split('session_id=')[1];
              this.messagesUrl = `${this.baseUrl.replace('/sse', '')}/messages/`;
              console.log('✅ SSE session established:', this.sessionId);
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });

        this.eventSource.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.id && this._messageHandlers.has(data.id)) {
              const handler = this._messageHandlers.get(data.id);
              this._messageHandlers.delete(data.id);
              handler(data);
            }
          } catch (error) {
            console.error('Error parsing SSE message:', error);
          }
        });

        this.eventSource.onerror = (error) => {
          console.error('SSE error:', error);
        };

        // Timeout if no endpoint event received
        setTimeout(() => {
          if (!this.sessionId) {
            reject(new Error('Timeout waiting for session_id'));
          }
        }, 5000);
      } catch (error) {
        reject(error);
      }
    });
  }

  async send(message) {
    if (!this.sessionId || !this.messagesUrl) {
      throw new Error('Transport not connected');
    }

    const url = `${this.messagesUrl}?session_id=${this.sessionId}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      // For 202 Accepted, response will come via SSE
      if (response.status === 202) {
        return new Promise((resolve) => {
          this._messageHandlers.set(message.id, resolve);
          
          // Timeout after 30 seconds
          setTimeout(() => {
            if (this._messageHandlers.has(message.id)) {
              this._messageHandlers.delete(message.id);
              resolve({ error: 'Timeout waiting for response' });
            }
          }, 30000);
        });
      }

      // For 200 OK, return response directly
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  async close() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.sessionId = null;
    this.messagesUrl = null;
    this._messageHandlers.clear();
  }

  // MCP SDK compatibility methods
  async connect() {
    return this.start();
  }

  onmessage = null;
  onerror = null;
  onclose = null;
}

module.exports = { FastMCPSSETransport };
