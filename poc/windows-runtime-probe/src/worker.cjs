const pty = require("node-pty");

const { SUCCESS_MARKER, getSmokeRuntimeConfig } = require("./runtime-config.cjs");

function postMessage(port, data) {
  port.postMessage(data);
}

function runSmoke(port) {
  const config = getSmokeRuntimeConfig();
  const timeoutMs = Number(process.env.OPENWEAVE_PTY_TIMEOUT_MS || 10000);
  let output = "";
  let settled = false;

  const term = pty.spawn(config.shell, config.args, {
    name: "xterm-color",
    cols: 80,
    rows: 30,
    cwd: config.cwd,
    env: config.env
  });

  const finish = (payload) => {
    if (settled) {
      return;
    }

    settled = true;
    clearTimeout(timeoutId);

    try {
      term.kill();
    } catch {
      // The PTY may already be closed when the exit event fires.
    }

    postMessage(port, payload);
  };

  term.onData((chunk) => {
    output += chunk;
  });

  term.onExit(({ exitCode, signal }) => {
    const ok = exitCode === 0 && output.includes(SUCCESS_MARKER);

    finish({
      type: "smoke-result",
      ok,
      exitCode,
      signal,
      output
    });
  });

  const timeoutId = setTimeout(() => {
    finish({
      type: "smoke-result",
      ok: false,
      exitCode: null,
      signal: "timeout",
      output
    });
  }, timeoutMs);
}

function bootstrap() {
  if (!process.parentPort) {
    throw new Error("utilityProcess parentPort is unavailable");
  }

  process.parentPort.on("message", (event) => {
    const [port] = event.ports || [];

    if (!port) {
      return;
    }

    if (typeof port.start === "function") {
      port.start();
    }

    port.on("message", (messageEvent) => {
      const message = messageEvent.data ?? messageEvent;

      if (message.type === "run-smoke") {
        runSmoke(port);
      }
    });

    postMessage(port, {
      type: "worker-ready"
    });
  });
}

bootstrap();
