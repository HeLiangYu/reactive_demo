// 监听对象的拦截操作
const baseHandler = {
  get(target, key) {
    const res = Reflect.get(target, key);
    // @todo 依赖收集
    track(target, key);
    return typeof res === "object" ? reactive(res) : res; // 将对象一层一层的拆解开，拆到最底层做响应式
  },
  set(target, key, value) {
    const info = {
      oldValue: Reflect.get(target, key),
      newValue: value,
    };
    // @todo 响应式去通知变化
    trigger(target, key, info);
    return Reflect.set(target, key, value);
  },
};

function reactive(traget) {
  // 只考虑简单的数据类型
  const observed = new Proxy(traget, baseHandler);
  // 返回监听的对象
  return observed;
}

function computed(fn) {
  // 特殊的effect
  const runner = effect(fn, { computed: true, lazy: true });

  return {
    effect: runner,
    get value() {
      return runner();
    },
  };
}

// 依赖函数
function effect(fn, options = {}) {
  // 初始化时执行这个函数
  let e = creteReactiveEffect(fn, options);
  if (!options.lazy) {
    // 在computed中配置的lazy，不是懒执行
    e();
  }
  return e;
}
function creteReactiveEffect(fn, options) {
  // 构造固定格式的effect
  const effect = function (...args) {
    return run(effect, fn, args); // 这里的effect是刚刚定义的effect，转到run函数
  };
  // effect的配置
  effect.deps = [];
  effect.computed = options.computed;
  effect.lazy = options.lazy;
  return effect;
}

// 执行effect
function run(effect, fn, args) {
  if (effectStack.indexOf(effect) === -1) {
    try {
      effectStack.push(effect);
      // 初始化话是执行从html传过来的effect的参数，其中访问了对象的name、lp属性，所以转到Proxy的get方法，执行trak函数，此时的effectStack已存在方法
      return fn(...args);
    } finally {
      effectStack.pop();
    }
  }
}

let effectStack = []; // 存储effect
let targetMap = new WeakMap();

// 收集依赖
function track(target, key) {
  const effect = effectStack[effectStack.length - 1];
  if (effect) {
    let depMap = targetMap.get(target);
    // 初始化时depmap是不存在的
    if (depMap === undefined) {
      depMap = new Map();
      targetMap.set(target, depMap); // 传入的对象作为key，创建Map对象作为value
    }
    let dep = depMap.get(key);
    if (dep === undefined) {
      dep = new Set();
      depMap.set(key, dep); // 传入的key值作为key，一个无重复元素的set对象作为value
    }
    if (!dep.has(effect)) {
      // 新增依赖
      // 双向存储 方便查找与优化
      dep.add(effect);
      effect.deps.push(dep);
    }
  }
}

// 数据变化后通知更新
function trigger(target, key, info) {
  console.log(target, key, info);
  // 1.找到依赖
  const depMap = targetMap.get(target);
  //   console.log(depMap);
  if (depMap === undefined) {
    return;
  }
  // 普通的effect与computed有一个优先级的区别
  // effect先执行，computed后执行（因为computed可能会依赖普通的effect）
  const effects = new Set();
  const computedRunner = new Set();
  if (key) {
    let deps = depMap.get(key);
    deps.forEach((effect) => {
      if (effect.computed) {
        computedRunner.add(effect);
      } else {
        effects.add(effect);
      }
    });
    effects.forEach((effect) => effect());
    computedRunner.forEach((effect) => effect());
  }
}
