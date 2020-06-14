let effectStack = [];
let targetMap = new WeakMap();

const baseHandler = {
  get(target, key) {
    const res = Reflect.get(target, key);
    track(target, key);
    return typeof res === "object" ? reactive(res) : res;
  },
  set(target, key, value) {
    const info = {
      oldValue: target[key],
      newValue: value,
    };

    trigger(target, key, info);

    return Reflect.set(target, key, value);
  },
};

function reactive(target) {
  const observed = new Proxy(target, baseHandler);

  return observed;
}

function computed(fn) {
  const runner = effect(fn, {
    computed: true,
    lazy: true,
  });

  return {
    //   effect: runner,
    get value() {
      return runner();
    },
  };
  //   return runner();
}

function effect(fn, options = {}) {
  const e = creteReactiveEffect(fn, options);
  if (!options.lazy) {
    e();
  }
  return e;
}

function creteReactiveEffect(fn, options) {
  const effect = function () {
    return run(effect, fn);
  };

  effect.deps = [];
  effect.computed = options.computed;
  effect.lazy = options.lazy;

  return effect;
}

function run(effect, fn) {
  if (effectStack.indexOf(effect) === -1) {
    try {
      effectStack.push(effect);
      return fn();
    } finally {
      effectStack.pop();
    }
  }
}

function track(target, key) {
  const effect = effectStack[effectStack.length - 1];
  if (effect) {
    let depMap = targetMap.get(target);
    if (depMap === undefined) {
      depMap = new Map();
      targetMap.set(target, depMap);
    }

    let dep = depMap.get(key);
    if (dep === undefined) {
      dep = new Set();
      depMap.set(key, dep);
    }

    if (!dep.has(effect)) {
      dep.add(effect);
      effect.deps.push(effect);
    }
  }
}

function trigger(target, key, info) {
  const effects = targetMap.get(target);
  if (!effects) {
    return;
  }

  if (key) {
    const depMap = effects.get(key);
    const effect = new Set();
    const computedEffect = new Set();

    depMap.forEach((item) => {
      if (item.computed) {
        computedEffect.add(item);
      } else {
        effect.add(item);
      }
    });
    computedEffect.forEach((effect) => effect());
    effect.forEach((effect) => effect());
  }
}
