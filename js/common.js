var $ = document.querySelector.bind(document);
function show(elem) {
    elem.classList.remove('hidden');
}
function hide(elem) {
    elem.classList.add('hidden');
}
function isVisible(elem) {
    return !elem.classList.contains('hidden');
}
function requestFileSystem() {
    return new Promise(function (resolve, reject) {
        if (!window.webkitRequestFileSystem)
            reject();
        window.webkitRequestFileSystem(window.PERSISTENT, 0, resolve, function () { return reject(); });
    });
}
function isInstalled() {
    if (!navigator.mimeTypes['application/x-pnacl'] || !window.fetch)
        return Promise.reject('not supported');
    return new Promise(function (resolve) {
        return requestFileSystem().then(function (fs) {
            fs.root.getDirectory('save', {}, function () { return resolve(true); }, function () { return resolve(false); });
        });
    });
}
