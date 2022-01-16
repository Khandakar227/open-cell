
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function get_store_value(store) {
        let value;
        subscribe(store, _ => value = _)();
        return value;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function setContext(key, context) {
        get_current_component().$$.context.set(key, context);
    }
    function getContext(key) {
        return get_current_component().$$.context.get(key);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function destroy_block(block, lookup) {
        block.d(1);
        lookup.delete(block.key);
    }
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error('Cannot have duplicate keys in a keyed each');
            }
            keys.add(key);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.44.3' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    // {id: Date.now(),sheetName: "", path: "", data=[[]]}
    const sheets = writable("[]");

    const selectedTab = writable(null); //For Tabs
    const selectedPanel = writable(null); //For Tabs

    //For menu bar
    const Files = writable([
      { name: "New", accelerator: "Ctrl + N", click: () => createSheet$1() },
      { name: "Open", accelerator: "Ctrl + O", click: () => open() },
      { name: "Save", accelerator: "Ctrl + S", click: () => { } },
      { name: "Save As", accelerator: "Ctrl + Shift + S", click: () => { } },
    ]);

    const createSheet$1 = (sheetData) => {
      const newSheetName = `NewSheet_${Date.now()}`;
      const sheetsDetail = {
        id: sheetData.id || Date.now(),
        sheetName: sheetData.sheetName || newSheetName,
        data: sheetData.data || [[]],
        path: sheetData.path || "",
        savedChange: sheetData ? true : false
      };

      if (get_store_value(sheets) === "[]")
        sheets.set(JSON.stringify([sheetsDetail]));
      else {
        sheets.update(v => {
          let initVal = JSON.parse(v);
          initVal.push(sheetsDetail);
          return JSON.stringify(initVal)
        });
      }
      location.href = `#/sheet`;
    };

    const open = () => {
      const input = document.getElementById("open-file-input"); //files: e.target.files
      input.setAttribute("value", "");
      input.click();
    };

    const checkExtension = (filename = "", extensions = []) => {
      const parts = filename.split('.');
      return extensions.includes(parts[parts.length - 1])
    };

    const createSheet = (sheet = { id: "", data: [[]], sheetName: "", path: "" }) => {
      const newSheetName = sheet.sheetName || `NewSheet_${Date.now()}`;
      console.log(sheet.data);
      const sheetsDetail = {
        id: sheet.id || Date.now(),
        sheetName: newSheetName,
        data: sheet.data,
        path: sheet.path || "",
        savedChange: sheet.data ? true : false
      };

      if (get_store_value(sheets) === "[]")
        sheets.set(JSON.stringify([sheetsDetail]));
      else {
        sheets.update(v => {
          let initVal = JSON.parse(v);
          initVal.push(sheetsDetail);
          return JSON.stringify(initVal)
        });
      }
      location.href = `#/sheet`;
    };

    const removeTab = (id) => {
      sheets.update(v => {
        let initVal = JSON.parse(v);
        return JSON.stringify(initVal.filter((value) => value.id !== id));
      });
      console.log(get_store_value(sheets));
    };

    const updateMetaData = (props, id) => {
      sheets.update(v => {
        let initVal = JSON.parse(v);
        for (let x = 0; x < initVal.length; x++) {
          if (initVal[x].id === id) {
            initVal[x] = { ...initVal[x], ...props };
          }
        }
        return JSON.stringify(initVal)
      });
    };
    const getSheetById = (id) => {
      const parsedSheet = JSON.parse(get_store_value(sheets));
      return parsedSheet.find((v, i) => v.id === id)
    };

    const appendData = (id, data) => {
      sheets.update(v => {
        let initVal = JSON.parse(v);
        for (let x = 0; x < initVal.length; x++) {
          if (initVal[x].id === id) {
            initVal[x].data.push(...data);
          }
        }
        return JSON.stringify(initVal)
      });
    };

    /* src/components/Sheet.svelte generated by Svelte v3.44.3 */

    const { console: console_1$3 } = globals;
    const file$9 = "src/components/Sheet.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[14] = list[i];
    	child_ctx[16] = i;
    	return child_ctx;
    }

    function get_each_context_1$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[17] = list[i];
    	child_ctx[19] = i;
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[20] = list[i];
    	child_ctx[22] = i;
    	return child_ctx;
    }

    // (81:10) {:else}
    function create_else_block_1(ctx) {
    	let th;
    	let div;
    	let t0_value = /*letter*/ ctx[20] + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			th = element("th");
    			div = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			attr_dev(div, "class", "resize-x td-label svelte-7yxy1c");
    			add_location(div, file$9, 89, 12, 2231);
    			attr_dev(th, "class", "" + (null_to_empty(`p-1 bg-info text-center position-sticky top-0 ${/*letter*/ ctx[20].trim() ? "cell-size" : "cell-num"}`) + " svelte-7yxy1c"));
    			attr_dev(th, "tabindex", 1);
    			attr_dev(th, "data-column-letter", /*letter*/ ctx[20]);
    			attr_dev(th, "data-column", /*i*/ ctx[22]);
    			add_location(th, file$9, 81, 12, 1956);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, th, anchor);
    			append_dev(th, div);
    			append_dev(div, t0);
    			append_dev(th, t1);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(th);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(81:10) {:else}",
    		ctx
    	});

    	return block;
    }

    // (73:10) {#if i === 0}
    function create_if_block_1$1(ctx) {
    	let th;
    	let div;
    	let small;
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			th = element("th");
    			div = element("div");
    			small = element("small");
    			t0 = text(/*highlightedValue*/ ctx[3]);
    			t1 = space();
    			add_location(small, file$9, 77, 14, 1853);
    			attr_dev(div, "class", "resize-both svelte-7yxy1c");
    			add_location(div, file$9, 76, 12, 1813);
    			attr_dev(th, "class", "" + (null_to_empty(`p-1 bg-info text-center cell-num position-of-cell position-sticky top-0`) + " svelte-7yxy1c"));
    			add_location(th, file$9, 73, 12, 1687);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, th, anchor);
    			append_dev(th, div);
    			append_dev(div, small);
    			append_dev(small, t0);
    			append_dev(th, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*highlightedValue*/ 8) set_data_dev(t0, /*highlightedValue*/ ctx[3]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(th);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(73:10) {#if i === 0}",
    		ctx
    	});

    	return block;
    }

    // (72:8) {#each thead as letter, i}
    function create_each_block_2(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*i*/ ctx[22] === 0) return create_if_block_1$1;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if_block.p(ctx, dirty);
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(72:8) {#each thead as letter, i}",
    		ctx
    	});

    	return block;
    }

    // (111:12) {:else}
    function create_else_block(ctx) {
    	let td;
    	let div;
    	let t_value = /*getCellValue*/ ctx[8](/*row_num*/ ctx[16], /*col_num*/ ctx[19] - 1) + "";
    	let t;
    	let td_data_row_value;
    	let mounted;
    	let dispose;

    	function change_handler(...args) {
    		return /*change_handler*/ ctx[12](/*row_num*/ ctx[16], /*col_num*/ ctx[19], ...args);
    	}

    	function focus_handler() {
    		return /*focus_handler*/ ctx[13](/*row_num*/ ctx[16], /*col_num*/ ctx[19]);
    	}

    	const block = {
    		c: function create() {
    			td = element("td");
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "class", "border-0 input-cell");
    			attr_dev(div, "contenteditable", true);
    			attr_dev(div, "tabindex", 1);
    			attr_dev(div, "role", "textbox");
    			add_location(div, file$9, 116, 18, 3102);
    			attr_dev(td, "class", "p-0 cell-size hover-cell");
    			attr_dev(td, "data-row", td_data_row_value = /*row_num*/ ctx[16] + 1);
    			attr_dev(td, "data-column", /*col_num*/ ctx[19]);
    			add_location(td, file$9, 111, 14, 2938);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, td, anchor);
    			append_dev(td, div);
    			append_dev(div, t);

    			if (!mounted) {
    				dispose = [
    					listen_dev(div, "change", change_handler, false, false, false),
    					listen_dev(div, "focus", focus_handler, false, false, false),
    					listen_dev(
    						div,
    						"blur",
    						function () {
    							if (is_function(/*removeCellPosition*/ ctx[4])) /*removeCellPosition*/ ctx[4].apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*data*/ 1 && t_value !== (t_value = /*getCellValue*/ ctx[8](/*row_num*/ ctx[16], /*col_num*/ ctx[19] - 1) + "")) set_data_dev(t, t_value);

    			if (dirty & /*data*/ 1 && td_data_row_value !== (td_data_row_value = /*row_num*/ ctx[16] + 1)) {
    				attr_dev(td, "data-row", td_data_row_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(td);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(111:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (102:12) {#if col_num === 0}
    function create_if_block$1(ctx) {
    	let td;
    	let div;
    	let small;
    	let t_value = /*row_num*/ ctx[16] + 1 + "";
    	let t;
    	let td_data_row_value;

    	const block = {
    		c: function create() {
    			td = element("td");
    			div = element("div");
    			small = element("small");
    			t = text(t_value);
    			add_location(small, file$9, 107, 18, 2832);
    			attr_dev(div, "class", "resize-y overflow-hidden");
    			add_location(div, file$9, 106, 16, 2775);
    			attr_dev(td, "class", "pt-0 px-1 cell-num text-center bg-light");
    			attr_dev(td, "data-row", td_data_row_value = /*row_num*/ ctx[16] + 1);
    			attr_dev(td, "data-column", /*col_num*/ ctx[19]);
    			add_location(td, file$9, 102, 14, 2613);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, td, anchor);
    			append_dev(td, div);
    			append_dev(div, small);
    			append_dev(small, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data*/ 1 && t_value !== (t_value = /*row_num*/ ctx[16] + 1 + "")) set_data_dev(t, t_value);

    			if (dirty & /*data*/ 1 && td_data_row_value !== (td_data_row_value = /*row_num*/ ctx[16] + 1)) {
    				attr_dev(td, "data-row", td_data_row_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(td);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(102:12) {#if col_num === 0}",
    		ctx
    	});

    	return block;
    }

    // (101:10) {#each new Array(27) as col, col_num (col_num)}
    function create_each_block_1$1(key_1, ctx) {
    	let first;
    	let if_block_anchor;

    	function select_block_type_1(ctx, dirty) {
    		if (/*col_num*/ ctx[19] === 0) return create_if_block$1;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			if_block.c();
    			if_block_anchor = empty();
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if_block.p(ctx, dirty);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1$1.name,
    		type: "each",
    		source: "(101:10) {#each new Array(27) as col, col_num (col_num)}",
    		ctx
    	});

    	return block;
    }

    // (99:6) {#each data.length >= 100 ? data : new Array(100) as row, row_num (row_num)}
    function create_each_block$3(key_1, ctx) {
    	let tr;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t;
    	let tr_data_row_value;
    	let each_value_1 = new Array(27);
    	validate_each_argument(each_value_1);
    	const get_key = ctx => /*col_num*/ ctx[19];
    	validate_each_keys(ctx, each_value_1, get_each_context_1$1, get_key);

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		let child_ctx = get_each_context_1$1(ctx, each_value_1, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block_1$1(key, child_ctx));
    	}

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			tr = element("tr");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			attr_dev(tr, "data-row", tr_data_row_value = /*row_num*/ ctx[16]);
    			add_location(tr, file$9, 99, 8, 2485);
    			this.first = tr;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tr, null);
    			}

    			append_dev(tr, t);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*data, Array, editValue, showCellPosition, removeCellPosition, getCellValue*/ 433) {
    				each_value_1 = new Array(27);
    				validate_each_argument(each_value_1);
    				validate_each_keys(ctx, each_value_1, get_each_context_1$1, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value_1, each_1_lookup, tr, destroy_block, create_each_block_1$1, t, get_each_context_1$1);
    			}

    			if (dirty & /*data*/ 1 && tr_data_row_value !== (tr_data_row_value = /*row_num*/ ctx[16])) {
    				attr_dev(tr, "data-row", tr_data_row_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(99:6) {#each data.length >= 100 ? data : new Array(100) as row, row_num (row_num)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let section;
    	let div;
    	let form;
    	let input;
    	let t0;
    	let button;
    	let t2;
    	let table;
    	let thead_1;
    	let tr;
    	let t3;
    	let tbody;
    	let each_blocks = [];
    	let each1_lookup = new Map();
    	let mounted;
    	let dispose;
    	let each_value_2 = thead;
    	validate_each_argument(each_value_2);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_1[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let each_value = /*data*/ ctx[0].length >= 100
    	? /*data*/ ctx[0]
    	: new Array(100);

    	validate_each_argument(each_value);
    	const get_key = ctx => /*row_num*/ ctx[16];
    	validate_each_keys(ctx, each_value, get_each_context$3, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$3(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each1_lookup.set(key, each_blocks[i] = create_each_block$3(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			section = element("section");
    			div = element("div");
    			form = element("form");
    			input = element("input");
    			t0 = space();
    			button = element("button");
    			button.textContent = "Change";
    			t2 = space();
    			table = element("table");
    			thead_1 = element("thead");
    			tr = element("tr");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t3 = space();
    			tbody = element("tbody");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(input, "type", "text");
    			attr_dev(input, "class", "sheet-name svelte-7yxy1c");
    			add_location(input, file$9, 63, 6, 1392);
    			attr_dev(button, "type", "submit");
    			attr_dev(button, "class", "btn btn-sm btn-info");
    			add_location(button, file$9, 64, 6, 1462);
    			attr_dev(form, "class", "py-1 my-1");
    			add_location(form, file$9, 62, 4, 1338);
    			attr_dev(div, "class", "pt-2");
    			add_location(div, file$9, 61, 2, 1315);
    			attr_dev(tr, "class", "svelte-7yxy1c");
    			add_location(tr, file$9, 70, 6, 1611);
    			attr_dev(thead_1, "class", "bg-white svelte-7yxy1c");
    			add_location(thead_1, file$9, 69, 4, 1580);
    			add_location(tbody, file$9, 97, 4, 2386);
    			attr_dev(table, "data-key", /*id*/ ctx[2]);
    			attr_dev(table, "class", "svelte-7yxy1c");
    			add_location(table, file$9, 68, 2, 1554);
    			attr_dev(section, "id", /*id*/ ctx[2]);
    			add_location(section, file$9, 60, 0, 1298);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, div);
    			append_dev(div, form);
    			append_dev(form, input);
    			set_input_value(input, /*sheetName*/ ctx[1]);
    			append_dev(form, t0);
    			append_dev(form, button);
    			append_dev(section, t2);
    			append_dev(section, table);
    			append_dev(table, thead_1);
    			append_dev(thead_1, tr);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(tr, null);
    			}

    			append_dev(table, t3);
    			append_dev(table, tbody);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tbody, null);
    			}

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[11]),
    					listen_dev(form, "submit", /*changeName*/ ctx[6], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*sheetName*/ 2 && input.value !== /*sheetName*/ ctx[1]) {
    				set_input_value(input, /*sheetName*/ ctx[1]);
    			}

    			if (dirty & /*highlightedValue, thead*/ 8) {
    				each_value_2 = thead;
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_2(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(tr, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_2.length;
    			}

    			if (dirty & /*data, Array, editValue, showCellPosition, removeCellPosition, getCellValue*/ 433) {
    				each_value = /*data*/ ctx[0].length >= 100
    				? /*data*/ ctx[0]
    				: new Array(100);

    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context$3, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each1_lookup, tbody, destroy_block, create_each_block$3, null, get_each_context$3);
    			}

    			if (dirty & /*id*/ 4) {
    				attr_dev(table, "data-key", /*id*/ ctx[2]);
    			}

    			if (dirty & /*id*/ 4) {
    				attr_dev(section, "id", /*id*/ ctx[2]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			destroy_each(each_blocks_1, detaching);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const thead = " ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    function instance$9($$self, $$props, $$invalidate) {
    	let showCellPosition;
    	let removeCellPosition;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Sheet', slots, []);
    	let { data = [[]] } = $$props;
    	let { sheetName = "" } = $$props;
    	let { path = "" } = $$props;
    	let { id } = $$props;
    	let { savedChange = false } = $$props;
    	let highlightedValue = "";

    	function changeName(e) {
    		e.preventDefault();

    		if (!path) {
    			updateMetaData({ sheetName }, id);
    			return;
    		}

    		window.electron.rename({ id, filePath: path, newName: sheetName }, response => {
    			updateMetaData({ sheetName, ...response }, id);
    		});
    	}

    	function editValue(e, row_num = 0, col_num = 0) {
    		if (!data[+row_num]) {
    			$$invalidate(0, data[+row_num] = [], data);
    		}

    		$$invalidate(0, data[+row_num][+col_num] = e.target.value.trim(), data);
    		console.log(data);

    		if (savedChange) {
    			updateMetaData({ savedChange: false, data }, id);
    		} else {
    			updateMetaData({ data }, id);
    		}
    	}

    	function getCellValue(row_num, col_num) {
    		if (!data[+row_num]) {
    			return "";
    		}

    		if (data[+row_num][col_num]) return data[+row_num][col_num]; else return "";
    	}

    	const writable_props = ['data', 'sheetName', 'path', 'id', 'savedChange'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$3.warn(`<Sheet> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		sheetName = this.value;
    		$$invalidate(1, sheetName);
    	}

    	const change_handler = (row_num, col_num, e) => editValue(e, row_num, col_num - 1);
    	const focus_handler = (row_num, col_num) => showCellPosition(row_num + 1, col_num);

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    		if ('sheetName' in $$props) $$invalidate(1, sheetName = $$props.sheetName);
    		if ('path' in $$props) $$invalidate(9, path = $$props.path);
    		if ('id' in $$props) $$invalidate(2, id = $$props.id);
    		if ('savedChange' in $$props) $$invalidate(10, savedChange = $$props.savedChange);
    	};

    	$$self.$capture_state = () => ({
    		updateMetaData,
    		data,
    		sheetName,
    		path,
    		id,
    		savedChange,
    		thead,
    		highlightedValue,
    		changeName,
    		editValue,
    		getCellValue,
    		removeCellPosition,
    		showCellPosition
    	});

    	$$self.$inject_state = $$props => {
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    		if ('sheetName' in $$props) $$invalidate(1, sheetName = $$props.sheetName);
    		if ('path' in $$props) $$invalidate(9, path = $$props.path);
    		if ('id' in $$props) $$invalidate(2, id = $$props.id);
    		if ('savedChange' in $$props) $$invalidate(10, savedChange = $$props.savedChange);
    		if ('highlightedValue' in $$props) $$invalidate(3, highlightedValue = $$props.highlightedValue);
    		if ('removeCellPosition' in $$props) $$invalidate(4, removeCellPosition = $$props.removeCellPosition);
    		if ('showCellPosition' in $$props) $$invalidate(5, showCellPosition = $$props.showCellPosition);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*data*/ 1) {
    			console.log(data);
    		}
    	};

    	$$invalidate(5, showCellPosition = (row_num, col_num) => {
    		$$invalidate(3, highlightedValue = `${row_num} : ${thead[col_num]}`);
    	});

    	$$invalidate(4, removeCellPosition = () => {
    		$$invalidate(3, highlightedValue = "");
    	});

    	return [
    		data,
    		sheetName,
    		id,
    		highlightedValue,
    		removeCellPosition,
    		showCellPosition,
    		changeName,
    		editValue,
    		getCellValue,
    		path,
    		savedChange,
    		input_input_handler,
    		change_handler,
    		focus_handler
    	];
    }

    class Sheet extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {
    			data: 0,
    			sheetName: 1,
    			path: 9,
    			id: 2,
    			savedChange: 10
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Sheet",
    			options,
    			id: create_fragment$9.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*id*/ ctx[2] === undefined && !('id' in props)) {
    			console_1$3.warn("<Sheet> was created without expected prop 'id'");
    		}
    	}

    	get data() {
    		throw new Error("<Sheet>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<Sheet>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get sheetName() {
    		throw new Error("<Sheet>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set sheetName(value) {
    		throw new Error("<Sheet>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get path() {
    		throw new Error("<Sheet>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set path(value) {
    		throw new Error("<Sheet>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<Sheet>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Sheet>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get savedChange() {
    		throw new Error("<Sheet>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set savedChange(value) {
    		throw new Error("<Sheet>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/MainPage.svelte generated by Svelte v3.44.3 */

    const { console: console_1$2 } = globals;
    const file$8 = "src/components/MainPage.svelte";

    function create_fragment$8(ctx) {
    	let main;
    	let button0;
    	let t1;
    	let div2;
    	let div0;
    	let svg;
    	let g0;
    	let rect;
    	let g1;
    	let path;
    	let t2;
    	let h4;
    	let t4;
    	let input;
    	let t5;
    	let button1;
    	let t7;
    	let div1;
    	let span0;
    	let t8;
    	let t9;
    	let button2;
    	let div1_class_value;
    	let t11;
    	let section;
    	let span1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			button0 = element("button");
    			button0.textContent = "Create a new spreadsheet";
    			t1 = space();
    			div2 = element("div");
    			div0 = element("div");
    			svg = svg_element("svg");
    			g0 = svg_element("g");
    			rect = svg_element("rect");
    			g1 = svg_element("g");
    			path = svg_element("path");
    			t2 = space();
    			h4 = element("h4");
    			h4.textContent = "Drag and drop any csv file here";
    			t4 = space();
    			input = element("input");
    			t5 = space();
    			button1 = element("button");
    			button1.textContent = "Or choose a file";
    			t7 = space();
    			div1 = element("div");
    			span0 = element("span");
    			t8 = text(/*message*/ ctx[0]);
    			t9 = space();
    			button2 = element("button");
    			button2.textContent = "X";
    			t11 = space();
    			section = element("section");
    			span1 = element("span");
    			span1.textContent = "Recently opened";
    			attr_dev(button0, "class", "btn btn-info");
    			add_location(button0, file$8, 24, 2, 542);
    			attr_dev(rect, "fill", "none");
    			attr_dev(rect, "height", "24");
    			attr_dev(rect, "width", "24");
    			add_location(rect, file$8, 35, 12, 850);
    			add_location(g0, file$8, 35, 9, 847);
    			attr_dev(path, "d", "M18,15v3H6v-3H4v3c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2v-3H18z M17,11l-1.41-1.41L13,12.17V4h-2v8.17L8.41,9.59L7,11l5,5 L17,11z");
    			add_location(path, file$8, 36, 11, 911);
    			add_location(g1, file$8, 35, 59, 897);
    			attr_dev(svg, "class", "mx-auto");
    			attr_dev(svg, "height", "5rem");
    			attr_dev(svg, "viewBox", "0 0 24 24");
    			attr_dev(svg, "width", "5rem");
    			attr_dev(svg, "fill", "lightgrey");
    			add_location(svg, file$8, 29, 6, 713);
    			attr_dev(h4, "class", "mb-3 d-block");
    			add_location(h4, file$8, 41, 6, 1102);
    			attr_dev(input, "class", "file-drop-input svelte-13bpose");
    			attr_dev(input, "type", "file");
    			add_location(input, file$8, 42, 6, 1170);
    			attr_dev(button1, "class", "btn mb-3 btn-info");
    			add_location(button1, file$8, 48, 6, 1306);
    			attr_dev(div0, "class", "file-drop-area mb-3 svelte-13bpose");
    			add_location(div0, file$8, 28, 4, 673);
    			add_location(span0, file$8, 58, 6, 1604);
    			attr_dev(button2, "class", "btn");
    			add_location(button2, file$8, 59, 6, 1635);
    			attr_dev(div1, "class", div1_class_value = "" + (null_to_empty(`${/*message*/ ctx[0] ? "d-grid" : "d-none"} text-align-start grid-temp justify-content-between align-items-center alert p-2 ${/*type*/ ctx[1] === "error" ? "alert-danger" : ""}`) + " svelte-13bpose"));
    			add_location(div1, file$8, 51, 4, 1384);
    			attr_dev(div2, "class", "my-2 text-center");
    			add_location(div2, file$8, 27, 2, 638);
    			attr_dev(main, "class", "p-2 mx-auto mw-1200");
    			add_location(main, file$8, 23, 0, 505);
    			add_location(span1, file$8, 64, 2, 1746);
    			attr_dev(section, "class", "my-2 p-2");
    			add_location(section, file$8, 63, 0, 1717);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, button0);
    			append_dev(main, t1);
    			append_dev(main, div2);
    			append_dev(div2, div0);
    			append_dev(div0, svg);
    			append_dev(svg, g0);
    			append_dev(g0, rect);
    			append_dev(svg, g1);
    			append_dev(g1, path);
    			append_dev(div0, t2);
    			append_dev(div0, h4);
    			append_dev(div0, t4);
    			append_dev(div0, input);
    			append_dev(div0, t5);
    			append_dev(div0, button1);
    			append_dev(div2, t7);
    			append_dev(div2, div1);
    			append_dev(div1, span0);
    			append_dev(span0, t8);
    			append_dev(div1, t9);
    			append_dev(div1, button2);
    			insert_dev(target, t11, anchor);
    			insert_dev(target, section, anchor);
    			append_dev(section, span1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", createSheet, false, false, false),
    					listen_dev(input, "change", /*dropSheet*/ ctx[3], false, false, false),
    					listen_dev(input, "click", /*onInputClick*/ ctx[2], false, false, false),
    					listen_dev(button2, "click", /*removeMsg*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*message*/ 1) set_data_dev(t8, /*message*/ ctx[0]);

    			if (dirty & /*message, type*/ 3 && div1_class_value !== (div1_class_value = "" + (null_to_empty(`${/*message*/ ctx[0] ? "d-grid" : "d-none"} text-align-start grid-temp justify-content-between align-items-center alert p-2 ${/*type*/ ctx[1] === "error" ? "alert-danger" : ""}`) + " svelte-13bpose"))) {
    				attr_dev(div1, "class", div1_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (detaching) detach_dev(t11);
    			if (detaching) detach_dev(section);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('MainPage', slots, []);
    	let message, type;

    	const onInputClick = e => {
    		e.target.value = null;
    	};

    	const dropSheet = e => {
    		if (e.target.files[0]?.name) {
    			if (!checkExtension(e.target.files[0]?.name, ["csv"])) {
    				$$invalidate(0, message = `${e.target.files[0]?.name} is not a csv file`);
    				console.log(message);
    				$$invalidate(1, type = "error");
    				return;
    			}
    		}
    	};

    	const removeMsg = () => {
    		$$invalidate(0, message = null);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$2.warn(`<MainPage> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		checkExtension,
    		createSheet,
    		message,
    		type,
    		onInputClick,
    		dropSheet,
    		removeMsg
    	});

    	$$self.$inject_state = $$props => {
    		if ('message' in $$props) $$invalidate(0, message = $$props.message);
    		if ('type' in $$props) $$invalidate(1, type = $$props.type);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [message, type, onInputClick, dropSheet, removeMsg];
    }

    class MainPage extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MainPage",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    const isBrowser = typeof window !== 'undefined';

    const href = writable(isBrowser ? window.location.href : 'https://example.com');

    const URL = isBrowser ? window.URL : require('url').URL;

    if (isBrowser) {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      const updateHref = () => href.set(window.location.href);

      history.pushState = function () {
        originalPushState.apply(this, arguments);
        updateHref();
      };

      history.replaceState = function () {
        originalReplaceState.apply(this, arguments);
        updateHref();
      };

      window.addEventListener('popstate', updateHref);
      window.addEventListener('hashchange', updateHref);
    }

    var url = {
      subscribe: derived(href, ($href) => new URL($href)).subscribe,
      ssrSet: (urlHref) => href.set(urlHref),
    };

    /* src/components/MultiTab/Tabs.svelte generated by Svelte v3.44.3 */
    const file$7 = "src/components/MultiTab/Tabs.svelte";

    function create_fragment$7(ctx) {
    	let div;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[1].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			attr_dev(div, "class", "tabs");
    			add_location(div, file$7, 49, 0, 1134);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[0],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[0])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[0], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const TABS = {};

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Tabs', slots, ['default']);
    	const tabs = [];
    	const panels = [];

    	setContext(TABS, {
    		registerTab: tab => {
    			tabs.push(tab);
    			selectedTab.update(current => current || tab);

    			onDestroy(() => {
    				const i = tabs.indexOf(tab);
    				tabs.splice(i, 1);

    				selectedTab.update(current => current === tab
    				? tabs[i] || tabs[tabs.length - 1]
    				: current);
    			});
    		},
    		registerPanel: panel => {
    			panels.push(panel);
    			selectedPanel.update(current => current || panel);

    			onDestroy(() => {
    				const i = panels.indexOf(panel);
    				panels.splice(i, 1);

    				selectedPanel.update(current => current === panel
    				? panels[i] || panels[panels.length - 1]
    				: current);
    			});
    		},
    		selectTab: tab => {
    			const i = tabs.indexOf(tab);
    			selectedTab.set(tab);
    			selectedPanel.set(panels[i]);
    		},
    		selectedTab,
    		selectedPanel
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Tabs> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(0, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		TABS,
    		setContext,
    		onDestroy,
    		selectedPanel,
    		selectedTab,
    		tabs,
    		panels
    	});

    	return [$$scope, slots];
    }

    class Tabs extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Tabs",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    /* src/components/MultiTab/TabList.svelte generated by Svelte v3.44.3 */

    const file$6 = "src/components/MultiTab/TabList.svelte";

    function create_fragment$6(ctx) {
    	let div;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[1].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			attr_dev(div, "class", "tab-list d-flex svelte-b4pok9");
    			add_location(div, file$6, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[0],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[0])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[0], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('TabList', slots, ['default']);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<TabList> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(0, $$scope = $$props.$$scope);
    	};

    	return [$$scope, slots];
    }

    class TabList extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TabList",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src/components/MultiTab/TabPanel.svelte generated by Svelte v3.44.3 */
    const file$5 = "src/components/MultiTab/TabPanel.svelte";

    function create_fragment$5(ctx) {
    	let div1;
    	let div0;
    	let div0_class_value;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[4].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			if (default_slot) default_slot.c();

    			attr_dev(div0, "class", div0_class_value = "" + (null_to_empty(`position-absolute top-0 ${/*$selectedPanel*/ ctx[0] === /*panel*/ ctx[1]
			? "visible-sheet"
			: "invisible-sheet"}`) + " svelte-16m9lrg"));

    			add_location(div0, file$5, 11, 2, 240);
    			attr_dev(div1, "class", "position-relative");
    			add_location(div1, file$5, 10, 0, 206);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);

    			if (default_slot) {
    				default_slot.m(div0, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 8)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[3],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[3])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[3], dirty, null),
    						null
    					);
    				}
    			}

    			if (!current || dirty & /*$selectedPanel*/ 1 && div0_class_value !== (div0_class_value = "" + (null_to_empty(`position-absolute top-0 ${/*$selectedPanel*/ ctx[0] === /*panel*/ ctx[1]
			? "visible-sheet"
			: "invisible-sheet"}`) + " svelte-16m9lrg"))) {
    				attr_dev(div0, "class", div0_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let $selectedPanel;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('TabPanel', slots, ['default']);
    	const panel = {};
    	const { registerPanel, selectedPanel } = getContext(TABS);
    	validate_store(selectedPanel, 'selectedPanel');
    	component_subscribe($$self, selectedPanel, value => $$invalidate(0, $selectedPanel = value));
    	registerPanel(panel);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<TabPanel> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(3, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		TABS,
    		panel,
    		registerPanel,
    		selectedPanel,
    		$selectedPanel
    	});

    	return [$selectedPanel, panel, selectedPanel, $$scope, slots];
    }

    class TabPanel extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TabPanel",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src/components/MultiTab/Tab.svelte generated by Svelte v3.44.3 */
    const file$4 = "src/components/MultiTab/Tab.svelte";

    function create_fragment$4(ctx) {
    	let div;
    	let button0;
    	let t0;
    	let button1;
    	let div_class_value;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[7].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[6], null);

    	const block = {
    		c: function create() {
    			div = element("div");
    			button0 = element("button");
    			if (default_slot) default_slot.c();
    			t0 = space();
    			button1 = element("button");
    			button1.textContent = "X";
    			attr_dev(button0, "class", "label svelte-1kbv84y");
    			add_location(button0, file$4, 18, 2, 382);
    			attr_dev(button1, "class", "text-secondary svelte-1kbv84y");
    			add_location(button1, file$4, 21, 2, 464);

    			attr_dev(div, "class", div_class_value = "" + (null_to_empty(`${/*$selectedTab*/ ctx[1] === /*tab*/ ctx[2]
			? "selected"
			: ""} tab-label d-flex justify-content-between py-1`) + " svelte-1kbv84y"));

    			add_location(div, file$4, 13, 0, 265);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, button0);

    			if (default_slot) {
    				default_slot.m(button0, null);
    			}

    			append_dev(div, t0);
    			append_dev(div, button1);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler*/ ctx[8], false, false, false),
    					listen_dev(
    						button1,
    						"click",
    						function () {
    							if (is_function(/*onclose*/ ctx[0])) /*onclose*/ ctx[0].apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 64)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[6],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[6])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[6], dirty, null),
    						null
    					);
    				}
    			}

    			if (!current || dirty & /*$selectedTab*/ 2 && div_class_value !== (div_class_value = "" + (null_to_empty(`${/*$selectedTab*/ ctx[1] === /*tab*/ ctx[2]
			? "selected"
			: ""} tab-label d-flex justify-content-between py-1`) + " svelte-1kbv84y"))) {
    				attr_dev(div, "class", div_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let $selectedTab;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Tab', slots, ['default']);
    	let { id = "" } = $$props;

    	let { onclose = () => {
    		
    	} } = $$props;

    	const tab = { id };
    	const { registerTab, selectTab, selectedTab } = getContext(TABS);
    	validate_store(selectedTab, 'selectedTab');
    	component_subscribe($$self, selectedTab, value => $$invalidate(1, $selectedTab = value));
    	registerTab(tab);
    	const writable_props = ['id', 'onclose'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Tab> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => selectTab(tab);

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(5, id = $$props.id);
    		if ('onclose' in $$props) $$invalidate(0, onclose = $$props.onclose);
    		if ('$$scope' in $$props) $$invalidate(6, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		TABS,
    		id,
    		onclose,
    		tab,
    		registerTab,
    		selectTab,
    		selectedTab,
    		$selectedTab
    	});

    	$$self.$inject_state = $$props => {
    		if ('id' in $$props) $$invalidate(5, id = $$props.id);
    		if ('onclose' in $$props) $$invalidate(0, onclose = $$props.onclose);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		onclose,
    		$selectedTab,
    		tab,
    		selectTab,
    		selectedTab,
    		id,
    		$$scope,
    		slots,
    		click_handler
    	];
    }

    class Tab extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { id: 5, onclose: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Tab",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get id() {
    		throw new Error("<Tab>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Tab>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get onclose() {
    		throw new Error("<Tab>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set onclose(value) {
    		throw new Error("<Tab>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/DragOptions.svelte generated by Svelte v3.44.3 */

    const { console: console_1$1 } = globals;
    const file$3 = "src/components/DragOptions.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i];
    	return child_ctx;
    }

    // (65:4) {#each options as option}
    function create_each_block$2(ctx) {
    	let div;
    	let input;
    	let t0;
    	let label;
    	let t1_value = /*option*/ ctx[8].name + "";
    	let t1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			input = element("input");
    			t0 = space();
    			label = element("label");
    			t1 = text(t1_value);
    			attr_dev(input, "type", "radio");
    			attr_dev(input, "name", "flexRadioDefault");
    			attr_dev(input, "id", /*option*/ ctx[8].name);
    			add_location(input, file$3, 66, 8, 1664);
    			attr_dev(label, "class", "form-check-label");
    			attr_dev(label, "for", /*option*/ ctx[8].name);
    			add_location(label, file$3, 72, 8, 1804);
    			attr_dev(div, "class", "form-check");
    			add_location(div, file$3, 65, 6, 1631);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, input);
    			append_dev(div, t0);
    			append_dev(div, label);
    			append_dev(label, t1);

    			if (!mounted) {
    				dispose = listen_dev(input, "change", /*onCheck*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(65:4) {#each options as option}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let container;
    	let div2;
    	let div0;
    	let b;
    	let t1;
    	let hr;
    	let t2;
    	let t3;
    	let div1;
    	let button0;
    	let t5;
    	let button1;
    	let mounted;
    	let dispose;
    	let each_value = /*options*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			container = element("container");
    			div2 = element("div");
    			div0 = element("div");
    			b = element("b");
    			b.textContent = "Import";
    			t1 = space();
    			hr = element("hr");
    			t2 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t3 = space();
    			div1 = element("div");
    			button0 = element("button");
    			button0.textContent = "Cancel";
    			t5 = space();
    			button1 = element("button");
    			button1.textContent = "Import";
    			add_location(b, file$3, 62, 44, 1552);
    			attr_dev(div0, "class", "text-uppercase text-center");
    			add_location(div0, file$3, 62, 4, 1512);
    			attr_dev(hr, "class", "m-1");
    			add_location(hr, file$3, 63, 4, 1576);
    			attr_dev(button0, "class", "btn btn-sm btn-secondary");
    			add_location(button0, file$3, 78, 6, 2000);
    			attr_dev(button1, "class", "btn btn-sm btn-info");
    			add_location(button1, file$3, 80, 6, 2089);
    			attr_dev(div1, "class", "d-flex align-items-center justify-content-between py-2");
    			add_location(div1, file$3, 77, 4, 1925);
    			attr_dev(div2, "class", "shadow rounded-2 p-2 bg-white drag-options svelte-1y8safe");
    			add_location(div2, file$3, 61, 2, 1451);
    			attr_dev(container, "class", "position-fixed top-0 d-grid align-items-center justify-content-center bg-light bg-opacity-50 svelte-1y8safe");
    			add_location(container, file$3, 58, 0, 1333);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, container, anchor);
    			append_dev(container, div2);
    			append_dev(div2, div0);
    			append_dev(div0, b);
    			append_dev(div2, t1);
    			append_dev(div2, hr);
    			append_dev(div2, t2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			append_dev(div2, t3);
    			append_dev(div2, div1);
    			append_dev(div1, button0);
    			append_dev(div1, t5);
    			append_dev(div1, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						button0,
    						"click",
    						function () {
    							if (is_function(/*onClose*/ ctx[0])) /*onClose*/ ctx[0].apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(button1, "click", /*onImport*/ ctx[3], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;

    			if (dirty & /*options, onCheck*/ 6) {
    				each_value = /*options*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div2, t3);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(container);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let $selectedTab;
    	validate_store(selectedTab, 'selectedTab');
    	component_subscribe($$self, selectedTab, $$value => $$invalidate(6, $selectedTab = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('DragOptions', slots, []);
    	let { files = [] } = $$props;

    	let { onClose = () => {
    		
    	} } = $$props;

    	let selectedOption = "";

    	let options = [
    		{ name: "Append data" },
    		{ name: "Open in a new tab" },
    		{ name: "Replace data" }
    	];

    	function onCheck(e) {
    		if (files) $$invalidate(5, selectedOption = e.target.id);
    	}

    	function onImport() {
    		switch (selectedOption) {
    			case "Append data":
    				iterate(file => {
    					console.log(file.data);
    					appendData($selectedTab.id, file.data);
    				});
    				break;
    			case "Open in a new tab":
    				iterate(file => {
    					createSheet({
    						data: file.data,
    						path: file.path,
    						sheetName: file.sheetName
    					});
    				});
    				break;
    			case "Replace data":
    				/*Replace data of selected tabs store*/
    				let totalData = [];
    				iterate(file => {
    					totalData.push(file.data);
    					updateMetaData({ data: totalData }, $selectedTab.id);
    				});
    				break;
    		}

    		onClose();
    	}

    	function iterate(
    		callback = () => {
    			
    		}
    	) {
    		for (let i = 0; i < files.length; i++) {
    			callback(files[i]);
    		}
    	}

    	const writable_props = ['files', 'onClose'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<DragOptions> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('files' in $$props) $$invalidate(4, files = $$props.files);
    		if ('onClose' in $$props) $$invalidate(0, onClose = $$props.onClose);
    	};

    	$$self.$capture_state = () => ({
    		selectedTab,
    		createSheet,
    		updateMetaData,
    		appendData,
    		files,
    		onClose,
    		selectedOption,
    		options,
    		onCheck,
    		onImport,
    		iterate,
    		$selectedTab
    	});

    	$$self.$inject_state = $$props => {
    		if ('files' in $$props) $$invalidate(4, files = $$props.files);
    		if ('onClose' in $$props) $$invalidate(0, onClose = $$props.onClose);
    		if ('selectedOption' in $$props) $$invalidate(5, selectedOption = $$props.selectedOption);
    		if ('options' in $$props) $$invalidate(1, options = $$props.options);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*selectedOption*/ 32) {
    			console.log(selectedOption);
    		}
    	};

    	return [onClose, options, onCheck, onImport, files, selectedOption];
    }

    class DragOptions extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { files: 4, onClose: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "DragOptions",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get files() {
    		throw new Error("<DragOptions>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set files(value) {
    		throw new Error("<DragOptions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get onClose() {
    		throw new Error("<DragOptions>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set onClose(value) {
    		throw new Error("<DragOptions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Menu/Menubar.svelte generated by Svelte v3.44.3 */

    const file$2 = "src/components/Menu/Menubar.svelte";

    function create_fragment$2(ctx) {
    	let div;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[1].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			attr_dev(div, "class", "menubar d-flex gap-1 px-1 svelte-xa554o");
    			add_location(div, file$2, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[0],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[0])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[0], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Menubar', slots, ['default']);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Menubar> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(0, $$scope = $$props.$$scope);
    	};

    	return [$$scope, slots];
    }

    class Menubar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Menubar",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/components/Menu/MenuItem.svelte generated by Svelte v3.44.3 */

    const file$1 = "src/components/Menu/MenuItem.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	return child_ctx;
    }

    // (19:4) {#each SubMenuItems as submenu}
    function create_each_block$1(ctx) {
    	let button;
    	let t0_value = /*submenu*/ ctx[5].name + "";
    	let t0;
    	let t1;
    	let span;
    	let t2_value = /*keyShrtcut*/ ctx[1](/*submenu*/ ctx[5].accelerator) + "";
    	let t2;
    	let t3;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t0 = text(t0_value);
    			t1 = space();
    			span = element("span");
    			t2 = text(t2_value);
    			t3 = space();
    			attr_dev(span, "class", "text-black-50");
    			add_location(span, file$1, 21, 8, 866);
    			attr_dev(button, "class", "bg-transparent btn-sm btn svelte-f1j1tw");
    			add_location(button, file$1, 19, 6, 765);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t0);
    			append_dev(button, t1);
    			append_dev(button, span);
    			append_dev(span, t2);
    			append_dev(span, t3);

    			if (!mounted) {
    				dispose = listen_dev(
    					button,
    					"click",
    					function () {
    						if (is_function(/*submenu*/ ctx[5].click)) /*submenu*/ ctx[5].click.apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*SubMenuItems*/ 1 && t0_value !== (t0_value = /*submenu*/ ctx[5].name + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*SubMenuItems*/ 1 && t2_value !== (t2_value = /*keyShrtcut*/ ctx[1](/*submenu*/ ctx[5].accelerator) + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(19:4) {#each SubMenuItems as submenu}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div1;
    	let button;
    	let t;
    	let div0;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[3].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);
    	let each_value = /*SubMenuItems*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			button = element("button");
    			if (default_slot) default_slot.c();
    			t = space();
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(button, "class", "bg-transparent menu-btn svelte-f1j1tw");
    			add_location(button, file$1, 16, 2, 592);
    			attr_dev(div0, "class", "p-1 bg-light shadow position-absolute submenu-Items svelte-f1j1tw");
    			add_location(div0, file$1, 17, 2, 657);
    			attr_dev(div1, "class", "menuItem position-relative svelte-f1j1tw");
    			add_location(div1, file$1, 15, 0, 549);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, button);

    			if (default_slot) {
    				default_slot.m(button, null);
    			}

    			append_dev(div1, t);
    			append_dev(div1, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 4)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[2],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[2])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[2], dirty, null),
    						null
    					);
    				}
    			}

    			if (dirty & /*SubMenuItems, keyShrtcut*/ 3) {
    				each_value = /*SubMenuItems*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div0, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (default_slot) default_slot.d(detaching);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('MenuItem', slots, ['default']);
    	const platform = navigator?.userAgentData?.platform || navigator?.platform || "unknown";

    	let { SubMenuItems = [
    		{
    			name: "New",
    			accelerator: "Ctrl + N",
    			click: () => {
    				
    			}
    		},
    		{
    			name: "Open",
    			accelerator: "Ctrl + O",
    			click: () => {
    				
    			}
    		},
    		{
    			name: "Save",
    			accelerator: "Ctrl + S",
    			click: () => {
    				
    			}
    		},
    		{
    			name: "Save As",
    			accelerator: "Ctrl + Shift + S",
    			click: () => {
    				
    			}
    		}
    	] } = $$props;

    	function keyShrtcut(accelerator) {
    		if (platform === "darwin") return accelerator.replace("Ctrl", "Cmd"); else return accelerator;
    	}

    	const writable_props = ['SubMenuItems'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<MenuItem> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('SubMenuItems' in $$props) $$invalidate(0, SubMenuItems = $$props.SubMenuItems);
    		if ('$$scope' in $$props) $$invalidate(2, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ platform, SubMenuItems, keyShrtcut });

    	$$self.$inject_state = $$props => {
    		if ('SubMenuItems' in $$props) $$invalidate(0, SubMenuItems = $$props.SubMenuItems);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [SubMenuItems, keyShrtcut, $$scope, slots];
    }

    class MenuItem extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { SubMenuItems: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MenuItem",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get SubMenuItems() {
    		throw new Error("<MenuItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set SubMenuItems(value) {
    		throw new Error("<MenuItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.44.3 */

    const { console: console_1, document: document_1 } = globals;
    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[13] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[13] = list[i];
    	return child_ctx;
    }

    // (99:2) <MenuItem SubMenuItems={$Files}>
    function create_default_slot_5(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("File");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_5.name,
    		type: "slot",
    		source: "(99:2) <MenuItem SubMenuItems={$Files}>",
    		ctx
    	});

    	return block;
    }

    // (98:0) <MenuBar>
    function create_default_slot_4(ctx) {
    	let menuitem;
    	let current;

    	menuitem = new MenuItem({
    			props: {
    				SubMenuItems: /*$Files*/ ctx[2],
    				$$slots: { default: [create_default_slot_5] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(menuitem.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(menuitem, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const menuitem_changes = {};
    			if (dirty & /*$Files*/ 4) menuitem_changes.SubMenuItems = /*$Files*/ ctx[2];

    			if (dirty & /*$$scope*/ 262144) {
    				menuitem_changes.$$scope = { dirty, ctx };
    			}

    			menuitem.$set(menuitem_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(menuitem.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(menuitem.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(menuitem, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_4.name,
    		type: "slot",
    		source: "(98:0) <MenuBar>",
    		ctx
    	});

    	return block;
    }

    // (111:42) 
    function create_if_block_2(ctx) {
    	let tabs;
    	let current;

    	tabs = new Tabs({
    			props: {
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(tabs.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(tabs, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const tabs_changes = {};

    			if (dirty & /*$$scope, SHEETS*/ 262145) {
    				tabs_changes.$$scope = { dirty, ctx };
    			}

    			tabs.$set(tabs_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tabs.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tabs.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(tabs, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(111:42) ",
    		ctx
    	});

    	return block;
    }

    // (109:2) {#if $url.hash === "" || $url.hash === "#/"}
    function create_if_block_1(ctx) {
    	let mainpage;
    	let current;
    	mainpage = new MainPage({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(mainpage.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(mainpage, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(mainpage.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(mainpage.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(mainpage, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(109:2) {#if $url.hash === \\\"\\\" || $url.hash === \\\"#/\\\"}",
    		ctx
    	});

    	return block;
    }

    // (115:10) <Tab onclose={() => removeTab(sheet.id)} id={sheet.id}>
    function create_default_slot_3(ctx) {
    	let small;
    	let t0_value = /*sheet*/ ctx[13].sheetName + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			small = element("small");
    			t0 = text(t0_value);
    			t1 = space();
    			add_location(small, file, 115, 12, 3185);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, small, anchor);
    			append_dev(small, t0);
    			insert_dev(target, t1, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*SHEETS*/ 1 && t0_value !== (t0_value = /*sheet*/ ctx[13].sheetName + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(small);
    			if (detaching) detach_dev(t1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_3.name,
    		type: "slot",
    		source: "(115:10) <Tab onclose={() => removeTab(sheet.id)} id={sheet.id}>",
    		ctx
    	});

    	return block;
    }

    // (114:8) {#each SHEETS as sheet (sheet.id)}
    function create_each_block_1(key_1, ctx) {
    	let first;
    	let tab;
    	let current;

    	function func() {
    		return /*func*/ ctx[10](/*sheet*/ ctx[13]);
    	}

    	tab = new Tab({
    			props: {
    				onclose: func,
    				id: /*sheet*/ ctx[13].id,
    				$$slots: { default: [create_default_slot_3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(tab.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(tab, target, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			const tab_changes = {};
    			if (dirty & /*SHEETS*/ 1) tab_changes.onclose = func;
    			if (dirty & /*SHEETS*/ 1) tab_changes.id = /*sheet*/ ctx[13].id;

    			if (dirty & /*$$scope, SHEETS*/ 262145) {
    				tab_changes.$$scope = { dirty, ctx };
    			}

    			tab.$set(tab_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tab.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tab.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(tab, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(114:8) {#each SHEETS as sheet (sheet.id)}",
    		ctx
    	});

    	return block;
    }

    // (113:6) <TabList>
    function create_default_slot_2(ctx) {
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_1_anchor;
    	let current;
    	let each_value_1 = /*SHEETS*/ ctx[0];
    	validate_each_argument(each_value_1);
    	const get_key = ctx => /*sheet*/ ctx[13].id;
    	validate_each_keys(ctx, each_value_1, get_each_context_1, get_key);

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		let child_ctx = get_each_context_1(ctx, each_value_1, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block_1(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*removeTab, SHEETS*/ 1) {
    				each_value_1 = /*SHEETS*/ ctx[0];
    				validate_each_argument(each_value_1);
    				group_outros();
    				validate_each_keys(ctx, each_value_1, get_each_context_1, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value_1, each_1_lookup, each_1_anchor.parentNode, outro_and_destroy_block, create_each_block_1, each_1_anchor, get_each_context_1);
    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(113:6) <TabList>",
    		ctx
    	});

    	return block;
    }

    // (122:8) <TabPanel>
    function create_default_slot_1(ctx) {
    	let sheet;
    	let t;
    	let current;

    	sheet = new Sheet({
    			props: {
    				data: /*sheet*/ ctx[13].data,
    				sheetName: /*sheet*/ ctx[13].sheetName,
    				id: /*sheet*/ ctx[13].id,
    				path: /*sheet*/ ctx[13].path,
    				savedChange: /*sheet*/ ctx[13].savedChange
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(sheet.$$.fragment);
    			t = space();
    		},
    		m: function mount(target, anchor) {
    			mount_component(sheet, target, anchor);
    			insert_dev(target, t, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const sheet_changes = {};
    			if (dirty & /*SHEETS*/ 1) sheet_changes.data = /*sheet*/ ctx[13].data;
    			if (dirty & /*SHEETS*/ 1) sheet_changes.sheetName = /*sheet*/ ctx[13].sheetName;
    			if (dirty & /*SHEETS*/ 1) sheet_changes.id = /*sheet*/ ctx[13].id;
    			if (dirty & /*SHEETS*/ 1) sheet_changes.path = /*sheet*/ ctx[13].path;
    			if (dirty & /*SHEETS*/ 1) sheet_changes.savedChange = /*sheet*/ ctx[13].savedChange;
    			sheet.$set(sheet_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(sheet.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(sheet.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(sheet, detaching);
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(122:8) <TabPanel>",
    		ctx
    	});

    	return block;
    }

    // (121:6) {#each SHEETS as sheet (sheet.id)}
    function create_each_block(key_1, ctx) {
    	let first;
    	let tabpanel;
    	let current;

    	tabpanel = new TabPanel({
    			props: {
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(tabpanel.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(tabpanel, target, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			const tabpanel_changes = {};

    			if (dirty & /*$$scope, SHEETS*/ 262145) {
    				tabpanel_changes.$$scope = { dirty, ctx };
    			}

    			tabpanel.$set(tabpanel_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tabpanel.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tabpanel.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(tabpanel, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(121:6) {#each SHEETS as sheet (sheet.id)}",
    		ctx
    	});

    	return block;
    }

    // (112:4) <Tabs>
    function create_default_slot(ctx) {
    	let tablist;
    	let t;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_1_anchor;
    	let current;

    	tablist = new TabList({
    			props: {
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	let each_value = /*SHEETS*/ ctx[0];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*sheet*/ ctx[13].id;
    	validate_each_keys(ctx, each_value, get_each_context, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			create_component(tablist.$$.fragment);
    			t = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			mount_component(tablist, target, anchor);
    			insert_dev(target, t, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const tablist_changes = {};

    			if (dirty & /*$$scope, SHEETS*/ 262145) {
    				tablist_changes.$$scope = { dirty, ctx };
    			}

    			tablist.$set(tablist_changes);

    			if (dirty & /*SHEETS*/ 1) {
    				each_value = /*SHEETS*/ ctx[0];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, each_1_anchor.parentNode, outro_and_destroy_block, create_each_block, each_1_anchor, get_each_context);
    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tablist.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tablist.$$.fragment, local);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(tablist, detaching);
    			if (detaching) detach_dev(t);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(112:4) <Tabs>",
    		ctx
    	});

    	return block;
    }

    // (135:0) {#if showDragOps}
    function create_if_block(ctx) {
    	let dragoptions;
    	let current;

    	dragoptions = new DragOptions({
    			props: {
    				files: /*draggedFilesData*/ ctx[4],
    				onClose: /*func_1*/ ctx[11]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(dragoptions.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(dragoptions, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const dragoptions_changes = {};
    			if (dirty & /*showDragOps*/ 2) dragoptions_changes.onClose = /*func_1*/ ctx[11];
    			dragoptions.$set(dragoptions_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dragoptions.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dragoptions.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(dragoptions, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(135:0) {#if showDragOps}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let t0;
    	let menubar;
    	let t1;
    	let main;
    	let input;
    	let t2;
    	let show_if;
    	let current_block_type_index;
    	let if_block0;
    	let t3;
    	let if_block1_anchor;
    	let current;
    	let mounted;
    	let dispose;

    	menubar = new Menubar({
    			props: {
    				$$slots: { default: [create_default_slot_4] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const if_block_creators = [create_if_block_1, create_if_block_2];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*$url*/ ctx[3].hash === "" || /*$url*/ ctx[3].hash === "#/") return 0;
    		if (show_if == null || dirty & /*$url*/ 8) show_if = !!/*$url*/ ctx[3].hash.includes("#/sheet");
    		if (show_if) return 1;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx, -1))) {
    		if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	let if_block1 = /*showDragOps*/ ctx[1] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			t0 = space();
    			create_component(menubar.$$.fragment);
    			t1 = space();
    			main = element("main");
    			input = element("input");
    			t2 = space();
    			if (if_block0) if_block0.c();
    			t3 = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    			attr_dev(input, "id", "open-file-input");
    			attr_dev(input, "type", "file");
    			attr_dev(input, "accept", ".csv");
    			attr_dev(input, "class", "svelte-u7w8ed");
    			add_location(input, file, 102, 2, 2832);
    			attr_dev(main, "class", "pt-1");
    			add_location(main, file, 101, 0, 2810);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			mount_component(menubar, target, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, main, anchor);
    			append_dev(main, input);
    			append_dev(main, t2);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(main, null);
    			}

    			insert_dev(target, t3, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, if_block1_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(document_1.body, "drop", /*onDrop*/ ctx[6], false, false, false),
    					listen_dev(document_1.body, "dragover", stopDefault, false, false, false),
    					listen_dev(input, "change", /*onOpenFile*/ ctx[5], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const menubar_changes = {};

    			if (dirty & /*$$scope, $Files*/ 262148) {
    				menubar_changes.$$scope = { dirty, ctx };
    			}

    			menubar.$set(menubar_changes);
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx, dirty);

    			if (current_block_type_index === previous_block_index) {
    				if (~current_block_type_index) {
    					if_blocks[current_block_type_index].p(ctx, dirty);
    				}
    			} else {
    				if (if_block0) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block0 = if_blocks[current_block_type_index];

    					if (!if_block0) {
    						if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block0.c();
    					} else {
    						if_block0.p(ctx, dirty);
    					}

    					transition_in(if_block0, 1);
    					if_block0.m(main, null);
    				} else {
    					if_block0 = null;
    				}
    			}

    			if (/*showDragOps*/ ctx[1]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty & /*showDragOps*/ 2) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(menubar.$$.fragment, local);
    			transition_in(if_block0);
    			transition_in(if_block1);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(menubar.$$.fragment, local);
    			transition_out(if_block0);
    			transition_out(if_block1);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			destroy_component(menubar, detaching);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(main);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d();
    			}

    			if (detaching) detach_dev(t3);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function stopDefault(e) {
    	e.preventDefault();
    	e.stopPropagation();
    	e.dataTransfer.dropEffect = "copy";
    }

    function instance($$self, $$props, $$invalidate) {
    	let SHEETS;
    	let saveFile;
    	let $selectedTab;
    	let $sheets;
    	let $Files;
    	let $url;
    	validate_store(selectedTab, 'selectedTab');
    	component_subscribe($$self, selectedTab, $$value => $$invalidate(8, $selectedTab = $$value));
    	validate_store(sheets, 'sheets');
    	component_subscribe($$self, sheets, $$value => $$invalidate(9, $sheets = $$value));
    	validate_store(Files, 'Files');
    	component_subscribe($$self, Files, $$value => $$invalidate(2, $Files = $$value));
    	validate_store(url, 'url');
    	component_subscribe($$self, url, $$value => $$invalidate(3, $url = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let showDragOps = false;
    	let draggedFilesData = []; /*{ id: "", data: "", path: "", sheetName: "" }*/

    	window.addEventListener("keypress", e => {
    		if (e.ctrlKey && !e.shiftKey && e.key === "s") saveFile(); else if (e.ctrlKey && e.shiftKey && e.key === "S") saveFile(true); else /* Not tested */
    		if (e.ctrlKey && !e.shiftKey && e.key === "n") createSheet(); else if (e.ctrlKey && !e.shiftKey && e.key === "o") openFile();
    	});

    	const openFile = () => {
    		const input = document.getElementById("open-file-input"); //files: e.target.files
    		input.setAttribute("value", "");
    		input.click();
    	};

    	function onOpenFile(e) {
    		console.log(e.target.files);

    		if (e.target.files.length) {
    			window.electron.open([...e.target.files], response => {
    				if (response) createSheet(response);
    			});
    		}
    	}

    	function onDrop(e) {
    		e.preventDefault();
    		e.stopPropagation();
    		console.log(e.dataTransfer.files);

    		if (!$selectedTab) {
    			window.electron.open([...e.dataTransfer.files], response => {
    				createSheet(response);
    				console.log(response);
    			});
    		} else {
    			$$invalidate(1, showDragOps = true);

    			window.electron.open([...e.dataTransfer.files], response => {
    				draggedFilesData.push(response);
    			});
    		}
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const func = sheet => removeTab(sheet.id);
    	const func_1 = () => $$invalidate(1, showDragOps = false);

    	$$self.$capture_state = () => ({
    		Sheet,
    		MainPage,
    		url,
    		sheets,
    		Tabs,
    		Tab,
    		TabPanel,
    		TabList,
    		DragOptions,
    		MenuBar: Menubar,
    		MenuItem,
    		removeTab,
    		createSheet,
    		updateMetaData,
    		getSheetById,
    		Files,
    		selectedTab,
    		showDragOps,
    		draggedFilesData,
    		openFile,
    		onOpenFile,
    		stopDefault,
    		onDrop,
    		saveFile,
    		SHEETS,
    		$selectedTab,
    		$sheets,
    		$Files,
    		$url
    	});

    	$$self.$inject_state = $$props => {
    		if ('showDragOps' in $$props) $$invalidate(1, showDragOps = $$props.showDragOps);
    		if ('draggedFilesData' in $$props) $$invalidate(4, draggedFilesData = $$props.draggedFilesData);
    		if ('saveFile' in $$props) $$invalidate(7, saveFile = $$props.saveFile);
    		if ('SHEETS' in $$props) $$invalidate(0, SHEETS = $$props.SHEETS);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$sheets*/ 512) {
    			$$invalidate(0, SHEETS = JSON.parse($sheets));
    		}

    		if ($$self.$$.dirty & /*SHEETS*/ 1) {
    			!SHEETS.length ? location.href = "#/" : null;
    		}

    		if ($$self.$$.dirty & /*$selectedTab*/ 256) {
    			$$invalidate(7, saveFile = (saveAs = false) => {
    				document.activeElement.blur();

    				window.electron.save(
    					getSheetById($selectedTab.id),
    					res => {
    						console.log(res);
    						updateMetaData({ ...res, savedChange: true }, res.id);
    					},
    					saveAs
    				);
    			});
    		}

    		if ($$self.$$.dirty & /*saveFile*/ 128) ;
    	};

    	return [
    		SHEETS,
    		showDragOps,
    		$Files,
    		$url,
    		draggedFilesData,
    		onOpenFile,
    		onDrop,
    		saveFile,
    		$selectedTab,
    		$sheets,
    		func,
    		func_1
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
