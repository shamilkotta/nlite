(() => {
  const encoder = new TextEncoder();
  let controller = null;
  let closed = false;
  const pending = [];
  const stream = new ReadableStream({
    start(nextController) {
      controller = nextController;
      for (const chunk of pending) controller.enqueue(encoder.encode(chunk));
      if (closed) controller.close();
    },
  });
  window.__NLITE_READ_RSC__ = () => stream;
  window.__NLITE_PUSH_RSC__ = (chunk) => {
    if (controller) {
      controller.enqueue(encoder.encode(chunk));
      return;
    }
    pending.push(chunk);
  };
  window.__NLITE_CLOSE_RSC__ = () => {
    closed = true;
    if (controller) controller.close();
  };
})();
