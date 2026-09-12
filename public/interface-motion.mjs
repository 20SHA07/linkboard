/*
 * Native adaptations of AnimatedBackground, AnimatedGroup, and TransitionPanel
 * from ibelick/motion-primitives (MIT, Copyright (c) 2024 ibelick).
 * React layout projection is replaced by measured Web Animations. Existing DOM,
 * form state, handlers, and focus remain owned by Linkboard. See THIRD_PARTY_NOTICES.md.
 *
 * MIT License
 * Copyright (c) 2024 ibelick
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
export function selectionBox(track, target) {
  const parent = track.getBoundingClientRect(), child = target.getBoundingClientRect();
  return {
    x: child.left - parent.left - (track.clientLeft || 0) + (track.scrollLeft || 0),
    y: child.top - parent.top - (track.clientTop || 0) + (track.scrollTop || 0),
    width: child.width,
    height: child.height,
  };
}

export function createInterfaceMotion(environment = globalThis) {
  const preference = environment.matchMedia?.('(prefers-reduced-motion: reduce)');
  const active = new Set(), current = new WeakMap(), tracks = new WeakMap();
  const details = new WeakSet(), revealed = new WeakSet(), cleanup = [];
  let destroyed = false;
  const reduced = () => !!preference?.matches;
  const frame = callback => environment.requestAnimationFrame
    ? environment.requestAnimationFrame(callback) : environment.setTimeout(callback, 0);
  const cancelFrame = id => environment.cancelAnimationFrame
    ? environment.cancelAnimationFrame(id) : environment.clearTimeout(id);

  function stop(element) {
    const animation = current.get(element);
    if (animation) { animation.cancel(); active.delete(animation); current.delete(element); }
  }
  function animate(element, keyframes, options = {}) {
    if (!element) return;
    stop(element);
    if (destroyed || reduced() || !element.animate || element.hidden || element.isConnected === false) return;
    try {
      const animation = element.animate(keyframes, {
        duration: 240, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'none', ...options,
      });
      current.set(element, animation); active.add(animation);
      // A cancelled animation rejects finished. Consume it without hiding content.
      Promise.resolve(animation.finished).catch(() => {}).then(() => {
        active.delete(animation);
        if (current.get(element) === animation) current.delete(element);
      });
      return animation;
    } catch { /* Older browsers keep the fully visible, functional interface. */ }
  }
  function reveal(element, { distance = 8, duration = 240, delay = 0 } = {}) {
    return animate(element, [
      { opacity: 0, translate: `0 ${distance}px` },
      { opacity: 1, translate: '0 0' },
    ], { duration, delay, fill: 'backwards' });
  }
  function preferenceChanged() {
    if (reduced()) { for (const animation of active) animation.cancel(); active.clear(); }
  }
  preference?.addEventListener?.('change', preferenceChanged);
  if (!preference?.addEventListener) preference?.addListener?.(preferenceChanged);

  function background(track, selector) {
    if (!track || tracks.has(track)) return tracks.get(track);
    const indicator = track.ownerDocument.createElement('span');
    indicator.className = 'lb-motion-indicator'; indicator.hidden = true;
    indicator.setAttribute('aria-hidden', 'true');
    track.classList.add('lb-motion-track'); track.prepend(indicator);
    let last = null, scheduled = null, disposed = false;
    function update() {
      scheduled = null;
      if (disposed || destroyed) return;
      const selected = [...track.querySelectorAll(selector)].find(button => !button.disabled && (
        button.getAttribute('aria-current') === 'page' ||
        button.getAttribute('aria-pressed') === 'true' || button.classList.contains('active')
      ));
      if (!selected) { indicator.hidden = true; if (track.classList.contains('lb-motion-ready')) track.classList.remove('lb-motion-ready'); last = null; return; }
      const box = selectionBox(track, selected);
      if (!box.width || !box.height) {
        indicator.hidden = true;
        if (track.classList.contains('lb-motion-ready')) track.classList.remove('lb-motion-ready');
        last = null; return;
      }
      if (last && Object.keys(box).every(key => box[key] === last[key])) return;
      const style = environment.getComputedStyle?.(indicator);
      const before = last ? {
        transform: style?.transform || indicator.style.transform,
        width: style?.width || indicator.style.width,
        height: style?.height || indicator.style.height,
      } : null;
      const after = { transform: `translate(${box.x}px, ${box.y}px)`, width: `${box.width}px`, height: `${box.height}px` };
      stop(indicator); Object.assign(indicator.style, after); indicator.hidden = false;
      if (!track.classList.contains('lb-motion-ready')) track.classList.add('lb-motion-ready');
      if (before) animate(indicator, [before, after], { duration: 280 });
      last = box;
    }
    function schedule() { if (!disposed && scheduled === null) scheduled = frame(update); }
    const mutations = environment.MutationObserver ? new environment.MutationObserver(schedule) : null;
    mutations?.observe(track, { attributes: true, subtree: true, attributeFilter: ['class', 'aria-current', 'aria-pressed', 'disabled'] });
    const sizes = environment.ResizeObserver ? new environment.ResizeObserver(schedule) : null;
    sizes?.observe(track); track.querySelectorAll(selector).forEach(button => sizes?.observe(button));
    track.addEventListener('click', schedule);
    environment.addEventListener?.('resize', schedule);
    const controller = { refresh: schedule, destroy() {
      disposed = true; if (scheduled !== null) cancelFrame(scheduled);
      stop(indicator); mutations?.disconnect(); sizes?.disconnect();
      track.removeEventListener('click', schedule); environment.removeEventListener?.('resize', schedule);
      indicator.remove(); track.classList.remove('lb-motion-track', 'lb-motion-ready'); tracks.delete(track);
    } };
    tracks.set(track, controller); cleanup.push(controller.destroy); schedule();
    return controller;
  }

  function group(elements) {
    const fresh = [...elements].filter(element => !revealed.has(element));
    fresh.forEach(element => revealed.add(element));
    if (!fresh.length || reduced() || destroyed) return;
    if (!environment.IntersectionObserver) { fresh.forEach((element, index) => reveal(element, { delay: Math.min(index, 3) * 45 })); return; }
    const observer = new environment.IntersectionObserver(entries => {
      let order = 0;
      for (const entry of entries) if (entry.isIntersecting) {
        reveal(entry.target, { distance: 12, duration: 360, delay: order++ * 45 }); observer.unobserve(entry.target);
      }
    }, { threshold: .12 });
    fresh.forEach(element => observer.observe(element)); cleanup.push(() => observer.disconnect());
  }
  function detailOpen(root) {
    root?.querySelectorAll('details').forEach(detail => {
      if (details.has(detail)) return; details.add(detail);
      // Keep native summary keyboard interaction and expanded/collapsed semantics.
      detail.addEventListener('toggle', event => {
        if (event.target !== detail || !detail.open) return;
        [...detail.children].filter(child => child.tagName !== 'SUMMARY').forEach(child => reveal(child, { distance: 4, duration: 180 }));
      });
    });
  }
  function destroy() {
    if (destroyed) return; destroyed = true;
    for (const animation of active) animation.cancel(); active.clear(); cleanup.forEach(dispose => dispose());
    preference?.removeEventListener?.('change', preferenceChanged);
    if (!preference?.removeEventListener) preference?.removeListener?.(preferenceChanged);
  }
  return { background, reveal, group, detailOpen, destroy, reduced };
}
