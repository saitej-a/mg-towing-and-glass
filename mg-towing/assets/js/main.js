/**
 * main.js
 * UI layer: sticky header, mobile nav, scroll reveals, counters, parallax,
 * active-section nav, the assistance form and small micro-interactions.
 * No dependencies — loads as a plain module and starts after DOM parse.
 */

const PHONE_RAW = '+919959550462';
const PHONE_DISPLAY = '+91 99595 50462';

(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- */
  /* 1. Year in footer                                                 */
  /* ---------------------------------------------------------------- */
  const yearEls = document.querySelectorAll('[data-year]');
  yearEls.forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  /* ---------------------------------------------------------------- */
  /* 2. Sticky header state                                            */
  /* ---------------------------------------------------------------- */
  const header = document.querySelector('.header');
  const toTop = document.querySelector('.to-top');
  const progress = document.querySelector('.scroll-progress');

  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;

    requestAnimationFrame(() => {
      const y = window.scrollY || window.pageYOffset;

      if (header) header.classList.toggle('is-stuck', y > 24);
      if (toTop) toTop.classList.toggle('is-visible', y > 700);

      if (progress) {
        const doc = document.documentElement;
        const max = doc.scrollHeight - window.innerHeight;
        progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      }

      updateActiveNav(y);
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------------------------------------------------------- */
  /* 3. Mobile navigation                                              */
  /* ---------------------------------------------------------------- */
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.nav');

  function closeNav() {
    if (!nav || !navToggle) return;
    nav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
  }

  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('nav-open', open);
    });

    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeNav));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeNav();
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 980) closeNav();
    });
  }

  /* ---------------------------------------------------------------- */
  /* 4. Active section in nav                                          */
  /* ---------------------------------------------------------------- */
  const sections = Array.from(document.querySelectorAll('section[id]'));
  const navLinks = Array.from(document.querySelectorAll('.nav__link[href^="#"]'));

  function updateActiveNav(y) {
    if (!sections.length || !navLinks.length) return;
    const probe = y + window.innerHeight * 0.28;

    let current = sections[0].id;
    sections.forEach((section) => {
      if (section.offsetTop <= probe) current = section.id;
    });

    navLinks.forEach((link) => {
      const target = link.getAttribute('href').slice(1);
      link.classList.toggle('is-active', target === current);
    });
  }

  /* ---------------------------------------------------------------- */
  /* 5. Scroll reveals                                                 */
  /* ---------------------------------------------------------------- */
  const revealEls = document.querySelectorAll('[data-reveal]');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    revealEls.forEach((el, i) => {
      if (!el.style.getPropertyValue('--reveal-delay')) {
        el.style.setProperty('--reveal-delay', `${Math.min(i % 6, 5) * 70}ms`);
      }
      io.observe(el);
    });
  }
  /* ---------------------------------------------------------------- */
  /* 6. Animated counters (trust section)                              */
  /* ---------------------------------------------------------------- */
  const counters = document.querySelectorAll('[data-count]');

  function runCounter(el) {
    const target = parseFloat(el.getAttribute('data-count'));
    const decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    const duration = 1500;
    const start = performance.now();

    function step(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = (target * eased).toFixed(decimals);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target.toFixed(decimals);
    }

    requestAnimationFrame(step);
  }

  function setCounterStatic(el) {
    const decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    el.textContent = parseFloat(el.getAttribute('data-count')).toFixed(decimals);
  }

  if (counters.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      counters.forEach(setCounterStatic);
    } else {
      const cio = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            runCounter(entry.target);
            cio.unobserve(entry.target);
          });
        },
        { threshold: 0.5 }
      );
      counters.forEach((el) => cio.observe(el));
    }
  }

  /* ---------------------------------------------------------------- */
  /* 7. Subtle parallax on decorative layers                           */
  /* ---------------------------------------------------------------- */
  const parallaxEls = Array.from(document.querySelectorAll('[data-parallax]'));

  if (parallaxEls.length && !reduceMotion && window.matchMedia('(hover: hover)').matches) {
    let raf = null;

    const apply = () => {
      const vh = window.innerHeight;
      parallaxEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) return;
        const speed = parseFloat(el.getAttribute('data-parallax')) || 0.12;
        const offset = (rect.top + rect.height / 2 - vh / 2) * -speed;
        el.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
      });
      raf = null;
    };

    const queue = () => {
      if (raf) return;
      raf = requestAnimationFrame(apply);
    };

    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    apply();
  }

  /* ---------------------------------------------------------------- */
  /* 8. Card pointer glow + 3D tilt                                    */
  /* ---------------------------------------------------------------- */
  const tiltCards = document.querySelectorAll('.card3d');

  if (!reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    tiltCards.forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const rect = card.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / rect.width;
        const ny = (e.clientY - rect.top) / rect.height;

        card.style.setProperty('--mx', `${(nx * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(ny * 100).toFixed(1)}%`);

        const ry = (nx - 0.5) * 7;
        const rx = -(ny - 0.5) * 5;
        card.style.transform =
          `translateY(-10px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      });

      card.addEventListener('pointerleave', () => {
        card.style.transform = '';
      });
    });
  }

  /* ---------------------------------------------------------------- */
  /* 9. Assistance form                                                */
  /* ---------------------------------------------------------------- */
  const form = document.querySelector('[data-assist-form]');
  const statusEl = document.querySelector('[data-form-status]');

  if (form) {
    const phoneField = form.querySelector('#assist-phone');

    // keep the phone field to digits / + / spaces / dashes while typing
    if (phoneField) {
      phoneField.addEventListener('input', () => {
        phoneField.value = phoneField.value.replace(/[^\d+\s-]/g, '').slice(0, 18);
      });
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;

      const data = new FormData(form);
      const get = (key) => (data.get(key) || '').toString().trim();

      const name = get('name');
      const phone = get('phone');
      const vehicle = get('vehicle');
      const service = get('service');
      const location = get('location');
      const message = get('message');

      const lines = [
        'MG TOWING & GLASS SERVICES — Assistance Request',
        `Name: ${name}`,
        `Phone: ${phone}`,
        vehicle ? `Vehicle Type: ${vehicle}` : null,
        service ? `Service Needed: ${service}` : null,
        location ? `Current Location: ${location}` : null,
        message ? `Message: ${message}` : null
      ].filter(Boolean);

      const waUrl =
        `https://wa.me/${PHONE_RAW.replace('+', '')}?text=` + encodeURIComponent(lines.join('\n'));

      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent =
          `Thank you${name ? ', ' + name : ''}. Your request has been prepared — opening WhatsApp so you can send it straight to us. ` +
          `For the fastest response in an emergency, please call ${PHONE_DISPLAY}.`;
      }

      window.open(waUrl, '_blank', 'noopener');
      form.reset();
    });
  }

  /* ---------------------------------------------------------------- */
  /* 10. Safe external links + back to top                             */
  /* ---------------------------------------------------------------- */
  document.querySelectorAll('a[target="_blank"]').forEach((a) => {
    if (!a.getAttribute('rel')) a.setAttribute('rel', 'noopener noreferrer');
  });

  if (toTop) {
    toTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ---------------------------------------------------------------- */
  /* 11. Boot 3D scenes immediately                                    */
  /* ---------------------------------------------------------------- */
  const has3d = document.querySelector('[data-scene], [data-mini]');

  if (has3d) {
    const boot = () => {
      import('./app.js?v=5')
        .then((mod) => mod.initScenes())
        .catch((err) => {
          if (window.console && console.error) console.error('[MG 3D boot]', err);
          document.querySelectorAll('[data-fallback]').forEach((el) => {
            el.hidden = false;
          });
          document.querySelectorAll('[data-load-status]').forEach((el) => {
            el.hidden = false;
            el.classList.add('is-error');
            el.textContent = '3D failed to start — see browser console (F12).';
          });
        });
    };

    boot();
  }
})();