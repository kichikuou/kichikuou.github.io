importScripts('lib/jszip.min.js');
function saveDataEntries() {
    var fs = self.webkitRequestFileSystemSync(self.PERSISTENT, 0);
    return fs.root.getDirectory('save', {}).createReader().readEntries();
}
function findSaveData() {
    if (saveDataEntries().length > 0)
        postMessage({ command: 'saveDataFound' });
}
function downloadSaveData() {
    var zip = new JSZip();
    var folder = zip.folder('save');
    for (var _i = 0, _a = saveDataEntries(); _i < _a.length; _i++) {
        var entry = _a[_i];
        if (!entry.isFile || !entry.name.toLowerCase().endsWith('.asd'))
            continue;
        var content = new FileReaderSync().readAsArrayBuffer(entry.file());
        folder.file(entry.name, content);
    }
    var blob = zip.generate({ type: 'blob', compression: 'DEFLATE' });
    postMessage({ command: 'downloadSaveData', blob: blob });
}
function basename(path) {
    return path.slice(path.lastIndexOf('/') + 1);
}
function extractSaveData(file) {
    var zip = new JSZip();
    zip.load(new FileReaderSync().readAsArrayBuffer(file), {});
    var files = zip.file(/\.asd$/i);
    if (files.length == 0)
        return false;
    var fsroot = self.webkitRequestFileSystemSync(self.PERSISTENT, 0).root;
    var tempdir = fsroot.getDirectory('save.tmp', { create: true });
    for (var _i = 0; _i < files.length; _i++) {
        var f = files[_i];
        tempdir.getFile(basename(f.name), { create: true })
            .createWriter().write(new Blob([f.asArrayBuffer()]));
    }
    try {
        fsroot.getDirectory('save', {}).removeRecursively();
    }
    catch (e) { }
    tempdir.moveTo(fsroot, 'save');
    return true;
}
function uploadSaveData(file) {
    var success = false;
    try {
        success = extractSaveData(file);
    }
    catch (e) {
        console.log(e);
    }
    postMessage({ command: 'uploadSaveData', success: success });
}
addEventListener('message', function (evt) {
    switch (evt.data.command) {
        case 'findSaveData':
            findSaveData();
            break;
        case 'downloadSaveData':
            downloadSaveData();
            break;
        case 'uploadSaveData':
            uploadSaveData(evt.data.file);
            break;
    }
});
