const path = require("node:path");

const { app, MessageChannelMain, utilityProcess } = require("electron");

async function runProbe() {
  const workerPath = path.join(__dirname, "worker.cjs");
  const child = utilityProcess.fork(workerPath);
  const { port1, port2 } = new MessageChannelMain();

  const shutdown = (code, message, detail) => {
    if (message) {
      const writer = code === 0 ? console.log : console.error;
      writer(message);
    }

    if (detail) {
      console.log(detail);
    }

    if (!child.killed) {
      child.kill();
    }

    app.exit(code);
  };

  child.on("exit", (code) => {
    if (code !== 0) {
      shutdown(1, `utilityProcess exited early with code ${code}`);
    }
  });

  child.stdout?.on("data", (chunk) => {
    process.stdout.write(chunk);
  });

  child.stderr?.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  port1.on("message", (event) => {
    const message = event.data;

    if (!message) {
      return;
    }

    if (message.type === "worker-ready") {
      port1.postMessage({
        type: "run-smoke"
      });
      return;
    }

    if (message.type === "smoke-result") {
      if (message.ok) {
        shutdown(0, "OpenWeave Windows runtime probe passed", message.output.trim());
      } else {
        shutdown(1, "OpenWeave Windows runtime probe failed", JSON.stringify(message, null, 2));
      }
    }
  });

  port1.start();
  child.postMessage({ type: "connect" }, [port2]);
}

app.whenReady().then(runProbe).catch((error) => {
  console.error(error);
  app.exit(1);
});
