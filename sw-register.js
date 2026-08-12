// sw-register.js — service worker registration + update handling.
//
// Shared by all five pages, which previously each carried their own copy of the
// registration snippet.
//
// Why the update handling matters: the service worker serves navigations
// cache-first, so once a version is installed the app keeps rendering that
// cached HTML. Registering alone is not enough — without an explicit update
// check and a reload when the new worker takes over, a freshly deployed version
// can sit unseen behind the old cache. The worker calls skipWaiting() and
// clients.claim(), so a new version claims this page as soon as it activates;
// that is the moment to reload.

(() => {
  if (!('serviceWorker' in navigator)) return;

  // Going from "no controller" to "controlled" is a first install, not an
  // update — reloading there would be a pointless refresh on someone's first
  // ever visit. Any controller change *after* that is a new version taking
  // over, which is what we want to reload for.
  //
  // This has to be a live flag rather than a snapshot taken at load: on that
  // first visit the page starts uncontrolled and is claimed moments later, so a
  // snapshot would stay false and suppress every subsequent update for the rest
  // of the session.
  let hasController = !!navigator.serviceWorker.controller;
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hasController) { hasController = true; return; }
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' })
      .then((reg) => {
        // Ask explicitly rather than waiting for the browser's own schedule,
        // which on an installed PWA can be a long time between checks.
        reg.update().catch(() => {});
      })
      .catch(() => { /* offline, or unsupported — the app still works */ });
  });

  // Check again whenever the app is brought back to the foreground, which for
  // an installed PWA is the usual way it is "reopened".
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    navigator.serviceWorker.getRegistration()
      .then((reg) => reg && reg.update())
      .catch(() => {});
  });
})();
