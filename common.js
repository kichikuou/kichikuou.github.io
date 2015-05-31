var $ = document.querySelector.bind(document);
function isInstalled() {
    return new Promise(function (resolve, reject) {
        if (!window.webkitRequestFileSystem)
            reject();
        window.webkitRequestFileSystem(window.PERSISTENT, 0, function (fs) { return fs.root.getDirectory('save', {}, function () { return resolve(true); }, function () { return resolve(false); }); }, function () { return resolve(false); });
    });
}
