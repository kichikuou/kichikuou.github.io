importScripts('cdimage.js');
var Installer = (function () {
    function Installer() {
        addEventListener('message', this.onMessage.bind(this));
    }
    Installer.prototype.onMessage = function (evt) {
        switch (evt.data.command) {
            case 'setFile':
                this.setFile(evt.data.file);
                var imgName = this.imgFile && this.imgFile.name;
                var cueName = this.cueFile && this.cueFile.name;
                postMessage({ command: 'readyState', img: imgName, cue: cueName });
                break;
            case 'install':
                if (this.ready())
                    this.install();
                break;
            case 'uninstall':
                uninstall();
                break;
            case 'setFont':
                installFont(evt.data);
                break;
        }
    };
    Installer.prototype.setFile = function (file) {
        var name = file.name.toLowerCase();
        if (name.endsWith('.img') || name.endsWith('.mdf'))
            this.imgFile = file;
        else if (name.endsWith('.cue') || name.endsWith('.mds'))
            this.cueFile = file;
        if (this.imgFile && this.cueFile) {
            if (this.cueFile.name.endsWith('.cue'))
                this.imageReader = new ImgCueReader(this.imgFile, this.cueFile);
            else
                this.imageReader = new MdfMdsReader(this.imgFile, this.cueFile);
        }
    };
    Installer.prototype.ready = function () {
        return !!this.imageReader;
    };
    Installer.prototype.install = function () {
        var localfs = self.webkitRequestFileSystemSync(self.PERSISTENT, 650 * 1024 * 1024);
        for (var track = 1; track <= this.imageReader.maxTrack(); track++) {
            if (track == 1) {
                var isofs = new ISO9660FileSystem(this.imageReader);
                var grGenerator = new GameResourceGenerator();
                var gamedata = isofs.getDirEnt('gamedata', isofs.rootDir());
                if (!gamedata) {
                    postMessage({ command: 'error', message: 'インストールできません。GAMEDATAフォルダが見つかりません。' });
                    return;
                }
                for (var _i = 0, _a = isofs.readDir(gamedata); _i < _a.length; _i++) {
                    var e = _a[_i];
                    if (e.name.toLowerCase().endsWith('.ald')) {
                        this.copyFile(e, localfs.root, isofs);
                        grGenerator.addFile(e.name.toLowerCase());
                    }
                }
                if (grGenerator.isEmpty()) {
                    postMessage({ command: 'error', message: 'インストールできません。System3.xのゲームではありません。' });
                    return;
                }
                grGenerator.generate(localfs.root);
            }
            else {
                this.imageReader.extractTrack(track, localfs.root);
            }
            postMessage({ command: 'progress', value: track, max: this.imageReader.maxTrack() });
        }
        postMessage({ command: 'complete' });
    };
    Installer.prototype.copyFile = function (src, dstDir, isofs) {
        var dstFile = dstDir.getFile(src.name.toLowerCase(), { create: true });
        var writer = dstFile.createWriter();
        if (dstFile.getMetadata().size == src.size) {
            console.log(src.name + ': skip');
            return;
        }
        writer.truncate(0);
        isofs.readFile(src, function (bufs) {
            writer.write(new Blob(bufs));
        });
        console.log(src.name);
    };
    return Installer;
}());
var AdvancedInstaller = (function () {
    function AdvancedInstaller() {
        addEventListener('message', this.onMessage.bind(this));
    }
    AdvancedInstaller.prototype.onMessage = function (evt) {
        switch (evt.data.command) {
            case 'install':
                this.install(evt.data.files);
                break;
            case 'uninstall':
                uninstall();
                break;
            case 'setFont':
                installFont(evt.data);
                break;
        }
    };
    AdvancedInstaller.prototype.install = function (files) {
        var localfs = self.webkitRequestFileSystemSync(self.PERSISTENT, 650 * 1024 * 1024);
        var grGenerator = new GameResourceGenerator();
        var tracks = [];
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            var fname = f.name.toLowerCase();
            var dstdir = localfs.root;
            if (fname.endsWith('.ald'))
                grGenerator.addFile(fname);
            else {
                var match = /(\d+)\.(wav|mp3|ogg)$/.exec(fname);
                if (match)
                    tracks[Number(match[1])] = fname;
                else
                    dstdir = localfs.root.getDirectory('save', { create: true });
            }
            this.copyFile(f, dstdir);
            postMessage({ command: 'progress', value: i, max: files.length });
        }
        grGenerator.generate(localfs.root);
        postMessage({ command: 'complete', tracks: tracks });
    };
    AdvancedInstaller.prototype.copyFile = function (file, dstDir) {
        dstDir.getFile(file.name.toLowerCase(), { create: true })
            .createWriter().write(file);
    };
    return AdvancedInstaller;
}());
var GameResourceGenerator = (function () {
    function GameResourceGenerator() {
        this.lines = [];
    }
    GameResourceGenerator.prototype.addFile = function (name) {
        var type = name.charAt(name.length - 6);
        var id = name.charAt(name.length - 5);
        this.basename = name.slice(0, -6);
        this.lines.push(GameResourceGenerator.resourceType[type] + id.toUpperCase() + ' gamedata/' + name);
    };
    GameResourceGenerator.prototype.generate = function (dstDir) {
        for (var i = 0; i < 26; i++) {
            var id = String.fromCharCode(65 + i);
            this.lines.push('Save' + id + ' gamedata/save/' + this.basename + 's' + id.toLowerCase() + '.asd');
        }
        var writer = dstDir.getFile('xsystem35.gr', { create: true }).createWriter();
        writer.truncate(0);
        writer.write(new Blob([this.lines.join('\n') + '\n']));
    };
    GameResourceGenerator.prototype.isEmpty = function () {
        return this.lines.length == 0;
    };
    GameResourceGenerator.resourceType = { s: 'Scenario', g: 'Graphics', w: 'Wave', d: 'Data', r: 'Resource', m: 'Midi' };
    return GameResourceGenerator;
}());
function uninstall() {
    var fs = self.webkitRequestFileSystemSync(self.PERSISTENT, 0);
    var entries = fs.root.createReader().readEntries();
    for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
        var entry = entries_1[_i];
        if (entry.isDirectory)
            entry.removeRecursively();
        else
            entry.remove();
    }
    postMessage({ command: 'uninstalled' });
}
function installFont(data) {
    var fs = self.webkitRequestFileSystemSync(self.PERSISTENT, 0);
    fs.root.getDirectory('fonts', { create: true })
        .getFile(data.name, { create: true })
        .createWriter().write(data.blob);
    fs.root.getDirectory('save', { create: true });
    postMessage({ command: 'setFontDone' });
}
var installer = location.search.startsWith('?advanced') ? new AdvancedInstaller() : new Installer();
