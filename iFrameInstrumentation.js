function getIFrameInstrumentation(nonce) {
return `
<script>
(function(){
  var NONCE = ${JSON.stringify(nonce)};
  var pending = new Map();
  var nextId = 1;

  function rpc(method, args) {
    return new Promise(function(resolve, reject) {
      var id = nextId++;
      pending.set(id, { resolve: resolve, reject: reject });
      parent.postMessage({
        __editorStorage: true,
        nonce: NONCE,
        id: id,
        method: method,
        args: args || []
      }, '*');
    });
  }

  window.addEventListener('message', function(e) {
    var d = e.data;
    if (!d || !d.__editorStorageReply || d.nonce !== NONCE) return;
    var p = pending.get(d.id);
    if (!p) return;
    pending.delete(d.id);
    if (d.error) p.reject(new Error(d.error));
    else p.resolve(d.result);
  });

  function makeStorage(kind) {
    var cache = Object.create(null);

    rpc('storage.getAll', [kind]).then(function(map) {
      for (var k in map) if (Object.prototype.hasOwnProperty.call(map, k)) cache[k] = map[k];
    }, function() {});

    var handler = {
      get: function(_t, prop) {
        if (prop === 'length') return Object.keys(cache).length;
        if (prop === 'key') return function(i) { return Object.keys(cache)[i] || null; };
        if (prop === 'getItem') return function(k) {
          k = String(k); return k in cache ? cache[k] : null;
        };
        if (prop === 'setItem') return function(k, v) {
          k = String(k); v = String(v);
          cache[k] = v;
          rpc('storage.set', [kind, k, v]).catch(function(){});
        };
        if (prop === 'removeItem') return function(k) {
          k = String(k); delete cache[k];
          rpc('storage.remove', [kind, k]).catch(function(){});
        };
        if (prop === 'clear') return function() {
          for (var k in cache) delete cache[k];
          rpc('storage.clear', [kind]).catch(function(){});
        };
        if (prop in cache) return cache[prop];
        return undefined;
      },
      set: function(_t, prop, value) {
        cache[String(prop)] = String(value);
        rpc('storage.set', [kind, String(prop), String(value)]).catch(function(){});
        return true;
      },
      deleteProperty: function(_t, prop) {
        delete cache[String(prop)];
        rpc('storage.remove', [kind, String(prop)]).catch(function(){});
        return true;
      },
      ownKeys: function() { return Object.keys(cache); },
      getOwnPropertyDescriptor: function(_t, prop) {
        if (prop in cache) return { value: cache[prop], enumerable: true, configurable: true, writable: true };
        return undefined;
      }
    };

    return new Proxy({}, handler);
  }

  function FakeIDB() {
    var dbs = {};

    function FakeRequest(result) {
      var req = { result: result, error: null, readyState: 'done',
                  onsuccess: null, onerror: null };
      setTimeout(function() { if (req.onsuccess) req.onsuccess({ target: req }); }, 0);
      return req;
    }
    function fail(msg) {
      var err = new Error(msg); err.name = 'InvalidStateError';
      throw err;
    }
    function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

    var pendingSync = false;
    function syncToParent() {
      if (pendingSync) return;
      pendingSync = true;
      setTimeout(function() {
        pendingSync = false;
        var plain = {};
        for (var n in dbs) {
          plain[n] = { version: dbs[n].version, stores: {} };
          for (var s in dbs[n].stores) {
            plain[n].stores[s] = {
              keyPath: dbs[n].stores[s].keyPath,
              data: dbs[n].stores[s].data
            };
          }
        }
        rpc('idb.setAll', [plain]).catch(function(){});
      }, 0);
    }

    function makeStore(state) {
      return {
        name: state.name,
        keyPath: state.keyPath,
        autoIncrement: false,
        createIndex: function() { /* no-op */ },
        index: function() { fail('index() nicht unterstützt'); },
        get: function(key) {
          var k = String(key);
          return FakeRequest(state.data[k] ? clone(state.data[k]) : undefined);
        },
        getAll: function() {
          return FakeRequest(Object.keys(state.data).map(function(k){ return clone(state.data[k]); }));
        },
        put: function(value, key) {
          var k = key !== undefined ? String(key)
                : (state.keyPath && value && value[state.keyPath] != null)
                  ? String(value[state.keyPath]) : null;
          if (k === null) fail('put ohne key/keyPath');
          state.data[k] = clone(value);
          syncToParent();
          return FakeRequest(k);
        },
        add: function(value, key) {
          var k = key !== undefined ? String(key)
                : (state.keyPath && value && value[state.keyPath] != null)
                  ? String(value[state.keyPath]) : null;
          if (k === null) fail('add ohne key/keyPath');
          if (k in state.data) { var e = new Error('Key existiert'); e.name='ConstraintError'; throw e; }
          state.data[k] = clone(value);
          syncToParent();
          return FakeRequest(k);
        },
        'delete': function(key) {
          delete state.data[String(key)];
          syncToParent();
          return FakeRequest(undefined);
        },
        clear: function() {
          state.data = {};
          syncToParent();
          return FakeRequest(undefined);
        },
        count: function() { return FakeRequest(Object.keys(state.data).length); }
      };
    }

    var readyPromise = rpc('idb.getAll', []).then(function(plain) {
      if (plain && typeof plain === 'object') {
        for (var n in plain) {
          var dbState = { version: plain[n].version || 1, stores: {} };
          var st = plain[n].stores || {};
          for (var s in st) {
            dbState.stores[s] = { name: s, keyPath: st[s].keyPath, data: st[s].data || {} };
          }
          dbs[n] = dbState;
        }
      }
    }, function(){});

    function open(name, version) {
      name = String(name);
      var req = { onupgradeneeded: null, onsuccess: null, onerror: null, result: null };
      readyPromise.then(function() {
        var existing = dbs[name];
        var needUpgrade = !existing || (version && version > (existing.version || 1));
        var state = existing || { version: version || 1, stores: {} };
        if (needUpgrade) state.version = version || 1;
        dbs[name] = state;

        var dbObj = {
          name: name,
          version: state.version,
          objectStoreNames: {
            contains: function(n) { return n in state.stores; },
            item: function(i) { return Object.keys(state.stores)[i] || null; },
            get length() { return Object.keys(state.stores).length; }
          },
          createObjectStore: function(storeName, opts) {
            var st = { name: storeName, keyPath: opts && opts.keyPath || null, data: {} };
            state.stores[storeName] = st;
            return makeStore(st);
          },
          deleteObjectStore: function(storeName) {
            delete state.stores[storeName];
            syncToParent();
          },
          transaction: function(storeNames, mode) {
            if (typeof storeNames === 'string') storeNames = [storeNames];
            var tx = {
              mode: mode || 'readonly',
              oncomplete: null,
              onerror: null,
              onabort: null,
              objectStore: function(n) {
                var st = state.stores[n];
                if (!st) fail('objectStore ' + n + ' nicht gefunden');
                return makeStore(st);
              },
              abort: function() { setTimeout(function(){ if (tx.onabort) tx.onabort(); }, 0); }
            };
            setTimeout(function() { if (tx.oncomplete) tx.oncomplete(); }, 0);
            return tx;
          },
          close: function() {}
        };

        req.result = dbObj;
        if (needUpgrade) {
          setTimeout(function() {
            if (req.onupgradeneeded) req.onupgradeneeded({ target: req, oldVersion: 0, newVersion: state.version });
            if (req.onsuccess) req.onsuccess({ target: req });
          }, 0);
        } else {
          setTimeout(function() { if (req.onsuccess) req.onsuccess({ target: req }); }, 0);
        }
      });
      return req;
    }

    return { open: open, deleteDatabase: function(name) { delete dbs[name]; syncToParent(); return FakeRequest(undefined); } };
  }

  try {
    Object.defineProperty(window, 'localStorage', { value: makeStorage('local'), configurable: true });
    Object.defineProperty(window, 'sessionStorage', { value: makeStorage('session'), configurable: true });
  } catch (e) { /* falls nicht überschreibbar: still ignorieren */ }

  try {
    var fakeIdb = new FakeIDB();
    Object.defineProperty(window, 'indexedDB', { value: fakeIdb, configurable: true });
    Object.defineProperty(window, 'IDBKeyRange', {
      value: {
        only: function(v){ return { only: v }; },
        lowerBound: function(v){ return { lower: v }; },
        upperBound: function(v){ return { upper: v }; },
        bound: function(l,u){ return { lower: l, upper: u }; }
      }, configurable: true
    });
  } catch (e) { /* still */ }

  function stringify(v) {
    try {
      if (v === undefined) return 'undefined';
      if (v === null) return 'null';
      if (v instanceof Error) return v.name + ': ' + v.message;
      if (typeof v === 'string') return v;
      if (typeof v === 'function') return String(v);
      if (typeof v === 'symbol') return String(v);
      if (typeof v === 'object') {
        try { return JSON.stringify(v); } catch (e) { return String(v); }
      }
      return String(v);
    } catch (e) { return '[unlesbar]'; }
  }
  function send(level, args) {
    try {
      parent.postMessage({
        __editorConsole: true,
        level: level,
        time: Date.now(),
        args: args.map(stringify)
      }, '*');
    } catch (e) {}
  }
  ['log','info','warn','error','debug'].forEach(function(level) {
    var orig = console[level];
    console[level] = function() {
      var args = Array.prototype.slice.call(arguments);
      send(level === 'debug' ? 'log' : level, args);
      if (orig) { try { orig.apply(console, args); } catch (e) {} }
    };
  });
  window.addEventListener('error', function(e) {
    var loc = e.filename ? ' (' + e.filename + ':' + e.lineno + ':' + e.colno + ')' : '';
    send('error', [e.message + loc]);
  });
  window.addEventListener('unhandledrejection', function(e) {
    var r = e.reason;
    var msg = (r && r.message) ? r.message : String(r);
    send('error', ['Unhandled promise rejection: ' + msg]);
  });
})();
</script>`;
}