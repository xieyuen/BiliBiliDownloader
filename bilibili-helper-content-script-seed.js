var HOST_ID = "bilibili-helper-host";
var SCRIPT_ID = "bilibili-helper-ext-content-script";

(function (win) {
  if (win.location.href.indexOf("bilibili.com/s/video/") !== -1) {
    return win.location.replace(win.location.href.replace("/s/", "/"));
  }

  var head = document.head || document.documentElement;
  var style = document.createElement("style");
  style.textContent = `[class*="fullscreen"] #${HOST_ID},[class*="webscreen-fix"] #${HOST_ID} {z-index: 9!important;}`;
  head.appendChild(style);

  var script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.type = "module";

  var manifest = chrome.runtime.getManifest();
  var name = manifest.name, version = manifest.version, version_name = manifest.version_name;

  script.dataset.internals = JSON.stringify({
    baseUrl: chrome.runtime.getURL("/").replace(/\/$/, ""),
    manifest: { name: name, version: version, version_name: version_name }
  });

  script.src = chrome.runtime.getURL("bilibili-helper-content-script.js") + `?v=${version}`;
  head.appendChild(script);
})(window);
