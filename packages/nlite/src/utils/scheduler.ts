const unpatchedSetImmediate = globalThis.setImmediate;
let shouldAttemptTimerPatching = true;

function warnAboutTimers() {
  console.warn(
    "[nlite] Cannot guarantee prerender task ordering in this runtime because its timers cannot be coordinated.",
  );
}

function createAtomicTimerGroup(delayMs = 0) {
  let isFirstCallback = true;
  let firstTimerIdleStart: number | null = null;
  let didFirstTimerRun = false;
  let didImmediateRun = false;

  function runFirstCallback(callback: () => void) {
    didFirstTimerRun = true;
    if (shouldAttemptTimerPatching && unpatchedSetImmediate) {
      unpatchedSetImmediate(() => {
        didImmediateRun = true;
      });
    }
    return callback();
  }

  function runSubsequentCallback(callback: () => void) {
    if (shouldAttemptTimerPatching && didImmediateRun) {
      shouldAttemptTimerPatching = false;
      warnAboutTimers();
    }
    return callback();
  }

  return function scheduleTimeout(callback: () => void) {
    if (didFirstTimerRun) {
      throw new Error("Cannot schedule more timers into a group that already executed");
    }

    const timer = setTimeout(
      isFirstCallback ? runFirstCallback : runSubsequentCallback,
      delayMs,
      callback,
    );
    isFirstCallback = false;

    if (!shouldAttemptTimerPatching) return timer;

    try {
      if (
        "_idleStart" in timer &&
        typeof (timer as { _idleStart?: number })._idleStart === "number"
      ) {
        if (firstTimerIdleStart === null) {
          firstTimerIdleStart = (timer as { _idleStart: number })._idleStart;
        } else {
          (timer as { _idleStart: number })._idleStart = firstTimerIdleStart;
        }
      } else {
        shouldAttemptTimerPatching = false;
        warnAboutTimers();
      }
    } catch (error) {
      shouldAttemptTimerPatching = false;
      console.error(
        new Error("Unexpected error while coordinating prerender timers", { cause: error }),
      );
      warnAboutTimers();
    }

    return timer;
  };
}

function noop() {}

export function runInSequentialTasks<R>(
  first: () => R,
  ...rest: Array<() => void>
): Promise<Awaited<R>> {
  return new Promise((resolve, reject) => {
    const scheduleTimeout = createAtomicTimerGroup();
    const ids: ReturnType<typeof scheduleTimeout>[] = [];
    let result!: R;

    ids.push(
      scheduleTimeout(() => {
        try {
          result = first();
          if (isThenable(result)) {
            result.then(noop, noop);
          }
        } catch (err) {
          for (let i = 1; i < ids.length; i++) {
            clearTimeout(ids[i]);
          }
          reject(err);
        }
      }),
    );

    for (let i = 0; i < rest.length; i++) {
      const fn = rest[i]!;
      let index = ids.length;
      ids.push(
        scheduleTimeout(() => {
          try {
            fn();
          } catch (err) {
            while (++index < ids.length) {
              clearTimeout(ids[index]);
            }
            reject(err);
          }
        }),
      );
    }

    ids.push(
      scheduleTimeout(() => {
        resolve(result as Awaited<R>);
      }),
    );
  });
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}
