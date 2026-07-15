const createRequestDeduper = () => {
  const inFlight = new Map();

  return (key, request) => {
    if (inFlight.has(key)) {
      return inFlight.get(key);
    }

    const promise = Promise.resolve().then(request).finally(() => {
      inFlight.delete(key);
    });

    inFlight.set(key, promise);
    return promise;
  };
};

export default createRequestDeduper;
