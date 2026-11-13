(function () {
  function configure(event) {
    if (event) event.preventDefault();
    location.href = '/?configure-cookies=1';
  }
  document.querySelectorAll('a[href="#configure-cookies"]').forEach(function (anchor) {
    anchor.addEventListener('click', configure);
  });
  if (location.hash === '#configure-cookies') configure();

  function leave() {
    if (window.parent !== window) return;
    location.href = '/';
  }
  var closer = document.getElementById('leave-page');
  if (closer) closer.addEventListener('click', leave);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') leave();
  });
})();
