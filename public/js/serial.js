/**
 * Web Serial Module
 * A reusable module for handling Web Serial communication with Arduino/ESP32 devices
 */

export class WebSerial extends EventTarget {
  static isSupported = "serial" in navigator;

  #port = null;
  #reader = null;
  #writer = null;
  #readableStreamClosed = null;
  #writableStreamClosed = null;
  #keepReading = false;
  #isConnected = false;
  #knownPorts = [];

  #options = {
    usbVendorId: null,
    usbProductId: null,
    baudRate: 115200,
    autoConnect: true,
    autoReconnect: true,
  };

  /**
   * Create a new WebSerial instance
   * @param {Object} options - Configuration options
   * @param {number} options.usbVendorId - USB Vendor ID to filter devices
   * @param {number} options.usbProductId - USB Product ID to filter devices
   * @param {number} [options.baudRate=115200] - Baud rate for serial connection
   * @param {boolean} [options.autoConnect=true] - Automatically connect to known devices on init
   * @param {boolean} [options.autoReconnect=true] - Automatically reconnect when device is plugged back in
   */
  constructor(options = {}) {
    super();
    this.#options = { ...this.#options, ...options };
  }

  /**
   * Check if Web Serial API is supported
   * @returns {boolean}
   */
  get isSupported() {
    return WebSerial.isSupported;
  }

  /**
   * Check if currently connected
   * @returns {boolean}
   */
  get isConnected() {
    return this.#isConnected;
  }

  /**
   * Initialize the serial module - call this on page load
   * Sets up event listeners and optionally auto-connects
   */
  async init() {
    if (!this.isSupported) {
      this.#emit("error", { message: "Web Serial is not supported in this browser" });
      return;
    }

    // Listen for new devices being connected
    navigator.serial.addEventListener("connect", (e) => {
      const port = e.target;
      console.log("[WebSerial] Device connected", port.getInfo());
      
      if (this.#isMatchingPort(port)) {
        if (!this.#knownPorts.includes(port)) {
          this.#knownPorts.push(port);
        }
        // Auto-reconnect if enabled and not currently connected
        if (this.#options.autoReconnect && !this.#isConnected) {
          this.connect(port);
        }
      }
    });

    // Listen for devices being disconnected
    navigator.serial.addEventListener("disconnect", (e) => {
      const port = e.target;
      console.log("[WebSerial] Device disconnected", port.getInfo());
      this.#knownPorts = this.#knownPorts.filter((p) => p !== port);
    });

    // Get already known/permitted ports
    const ports = await navigator.serial.getPorts();
    this.#knownPorts = ports.filter((port) => this.#isMatchingPort(port));

    console.log("[WebSerial] Known matching ports:", this.#knownPorts.length);

    // Auto-connect if enabled and we have a known port
    if (this.#options.autoConnect && this.#knownPorts.length > 0) {
      await this.connect(this.#knownPorts[0]);
    }
  }

  /**
   * Request a port from the user (triggers browser's device picker)
   * Use this when the user clicks a "Connect" button
   * @returns {Promise<boolean>} - Whether connection was successful
   */
  async requestPort() {
    if (!this.isSupported) {
      this.#emit("error", { message: "Web Serial is not supported" });
      return false;
    }

    try {
      const filters = [];
      if (this.#options.usbVendorId && this.#options.usbProductId) {
        filters.push({
          usbVendorId: this.#options.usbVendorId,
          usbProductId: this.#options.usbProductId,
        });
      }

      const port = await navigator.serial.requestPort(
        filters.length > 0 ? { filters } : undefined
      );
      
      return await this.connect(port);
    } catch (error) {
      if (error.name === "NotFoundError") {
        // User cancelled the picker
        console.log("[WebSerial] User cancelled port selection");
      } else {
        console.error("[WebSerial] Error requesting port:", error);
        this.#emit("error", { message: error.message, error });
      }
      return false;
    }
  }

  /**
   * Connect to a specific port
   * @param {SerialPort} port - The port to connect to
   * @returns {Promise<boolean>} - Whether connection was successful
   */
  async connect(port) {
    if (this.#isConnected) {
      console.log("[WebSerial] Already connected");
      return true;
    }

    try {
      this.#port = port;
      this.#keepReading = true;

      await port.open({ baudRate: this.#options.baudRate });

      // Set up disconnect handler
      port.addEventListener("disconnect", () => {
        console.log("[WebSerial] Port disconnected");
        this.#handleDisconnect();
      });

      // Set up writer
      const textEncoder = new TextEncoderStream();
      this.#writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
      this.#writer = textEncoder.writable.getWriter();

      // Set up reader with line-break transformer
      const textDecoder = new TextDecoderStream();
      this.#readableStreamClosed = port.readable.pipeTo(textDecoder.writable);

      const lineBreakTransformer = new TransformStream({
        transform(chunk, controller) {
          const text = chunk;
          const lines = text.split("\n");
          lines[0] = (this.remainder || "") + lines[0];
          this.remainder = lines.pop();
          lines.forEach((line) => controller.enqueue(line));
        },
        flush(controller) {
          if (this.remainder) {
            controller.enqueue(this.remainder);
          }
        },
      });

      const inputStream = textDecoder.readable.pipeThrough(lineBreakTransformer);
      this.#reader = inputStream.getReader();

      this.#isConnected = true;
      this.#emit("connect", { port });

      // Start reading loop
      this.#readLoop();

      return true;
    } catch (error) {
      console.error("[WebSerial] Connection error:", error);
      this.#emit("error", { message: error.message, error });
      this.#cleanup();
      return false;
    }
  }

  /**
   * Disconnect from the current port
   */
  async disconnect() {
    if (!this.#port) {
      return;
    }

    this.#keepReading = false;

    // Cancel reader
    if (this.#reader) {
      try {
        await this.#reader.cancel();
      } catch (e) {
        // Ignore cancel errors
      }
      this.#reader = null;
    }

    // Close writer
    if (this.#writer) {
      try {
        await this.#writer.close();
      } catch (e) {
        // Ignore close errors
      }
      this.#writer = null;
    }

    // Wait for streams to close
    if (this.#readableStreamClosed) {
      try {
        await this.#readableStreamClosed;
      } catch (e) {
        // Ignore stream closed errors
      }
      this.#readableStreamClosed = null;
    }

    if (this.#writableStreamClosed) {
      try {
        await this.#writableStreamClosed;
      } catch (e) {
        // Ignore stream closed errors
      }
      this.#writableStreamClosed = null;
    }

    // Close port
    try {
      await this.#port.close();
    } catch (e) {
      // Ignore close errors
    }

    this.#port = null;
    this.#isConnected = false;
    this.#emit("disconnect", {});
  }

  /**
   * Send a string to the connected device
   * @param {string} data - The string to send
   * @returns {Promise<boolean>} - Whether the send was successful
   */
  async send(data) {
    if (!this.#isConnected || !this.#writer) {
      console.warn("[WebSerial] Cannot send: not connected");
      return false;
    }

    try {
      await this.#writer.write(data);
      return true;
    } catch (error) {
      console.error("[WebSerial] Send error:", error);
      this.#emit("error", { message: error.message, error });
      return false;
    }
  }

  /**
   * Send a string followed by a newline
   * @param {string} data - The string to send
   * @returns {Promise<boolean>} - Whether the send was successful
   */
  async sendLine(data) {
    return this.send(data + "\n");
  }

  /**
   * Send an object as JSON followed by a newline
   * @param {Object} data - The object to send as JSON
   * @returns {Promise<boolean>} - Whether the send was successful
   */
  async sendJSON(data) {
    return this.sendLine(JSON.stringify(data));
  }

  // Private methods

  #isMatchingPort(port) {
    const info = port.getInfo();
    
    // If no filter specified, match all ports
    if (!this.#options.usbVendorId && !this.#options.usbProductId) {
      return true;
    }

    return (
      info.usbVendorId === this.#options.usbVendorId &&
      info.usbProductId === this.#options.usbProductId
    );
  }

  async #readLoop() {
    try {
      while (this.#keepReading) {
        const { value, done } = await this.#reader.read();
        if (done) {
          break;
        }
        if (value) {
          this.#emit("data", { data: value });
        }
      }
    } catch (error) {
      if (this.#keepReading) {
        console.error("[WebSerial] Read error:", error);
        this.#emit("error", { message: error.message, error });
      }
    } finally {
      try {
        this.#reader?.releaseLock();
      } catch (e) {
        // Ignore
      }
      this.#reader = null;
    }
  }

  #handleDisconnect() {
    this.#keepReading = false;
    this.#isConnected = false;
    this.#port = null;
    this.#reader = null;
    this.#writer = null;
    this.#emit("disconnect", {});
  }

  #cleanup() {
    this.#port = null;
    this.#reader = null;
    this.#writer = null;
    this.#readableStreamClosed = null;
    this.#writableStreamClosed = null;
    this.#isConnected = false;
    this.#keepReading = false;
  }

  #emit(eventName, detail) {
    this.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

export default WebSerial;
