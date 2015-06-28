var ISO9660FileSystem = (function () {
    function ISO9660FileSystem(sectorReader) {
        this.sectorReader = sectorReader;
        this.pvd = new PVD(sectorReader.read(0x10));
        if (this.pvd.type != 1)
            throw ('PVD not found');
    }
    ISO9660FileSystem.prototype.rootDir = function () {
        return this.pvd.rootDirEnt();
    };
    ISO9660FileSystem.prototype.getDirEnt = function (name, parent) {
        name = name.toLowerCase();
        for (var _i = 0, _a = this.readDir(parent); _i < _a.length; _i++) {
            var e = _a[_i];
            if (e.name.toLowerCase() == name)
                return e;
        }
        return null;
    };
    ISO9660FileSystem.prototype.readDir = function (dirent) {
        var sector = dirent.sector;
        var position = 0;
        var length = dirent.size;
        var entries = [];
        while (position < length) {
            if (position == 0)
                var buf = this.sectorReader.read(sector);
            var child = new DirEnt(buf, position);
            if (child.length == 0) {
                position = 2048;
            }
            else {
                entries.push(child);
                position += child.length;
            }
            if (position > 2048)
                throw ('dirent across sector boundary');
            if (position == 2048) {
                sector++;
                position = 0;
                length -= 2048;
            }
        }
        return entries;
    };
    ISO9660FileSystem.prototype.readFile = function (dirent, callback) {
        this.sectorReader.sequentialRead(dirent.sector, dirent.size, callback);
    };
    return ISO9660FileSystem;
})();
var PVD = (function () {
    function PVD(buf) {
        this.buf = buf;
        this.view = new DataView(buf);
    }
    Object.defineProperty(PVD.prototype, "type", {
        get: function () {
            return this.view.getUint8(0);
        },
        enumerable: true,
        configurable: true
    });
    PVD.prototype.rootDirEnt = function () {
        return new DirEnt(this.buf, 156);
    };
    return PVD;
})();
var DirEnt = (function () {
    function DirEnt(buf, offset) {
        this.buf = buf;
        this.offset = offset;
        this.view = new DataView(buf, offset);
    }
    Object.defineProperty(DirEnt.prototype, "length", {
        get: function () {
            return this.view.getUint8(0);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DirEnt.prototype, "sector", {
        get: function () {
            return this.view.getUint32(2, true);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DirEnt.prototype, "size", {
        get: function () {
            return this.view.getUint32(10, true);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DirEnt.prototype, "name", {
        get: function () {
            var len = this.view.getUint8(32);
            var decoder = new TextDecoder('shift_jis');
            return decoder.decode(new DataView(this.buf, this.offset + 33, len)).split(';')[0];
        },
        enumerable: true,
        configurable: true
    });
    return DirEnt;
})();
var SectorReader = (function () {
    function SectorReader(file) {
        this.file = file;
    }
    SectorReader.prototype.read = function (sector, maxLength) {
        if (maxLength === void 0) { maxLength = 2048; }
        var start = sector * 2352 + 16;
        var end = start + Math.min(maxLength, 2048);
        var reader = new FileReaderSync();
        return reader.readAsArrayBuffer(this.file.slice(start, end));
    };
    SectorReader.prototype.sequentialRead = function (startSector, length, callback) {
        var endSector = startSector + ((length + 2047) >> 11);
        var chunk = 256;
        var reader = new FileReaderSync();
        for (var sector = startSector; sector < endSector; sector += chunk) {
            var n = Math.min(chunk, endSector - sector);
            var blob = this.file.slice(sector * 2352, (sector + n) * 2352);
            var buf = reader.readAsArrayBuffer(blob);
            var bufs = [];
            for (var i = 0; i < n; i++) {
                bufs.push(new DataView(buf, i * 2352 + 16, Math.min(length, 2048)));
                length -= 2048;
            }
            callback(bufs);
        }
    };
    return SectorReader;
})();
;
var CDDA = (function () {
    function CDDA(cueFile) {
        var reader = new FileReaderSync();
        var lines = reader.readAsText(cueFile).split('\n');
        this.tracks = [];
        var currentTrack = null;
        for (var _i = 0; _i < lines.length; _i++) {
            var line = lines[_i];
            var fields = line.trim().split(/\s+/);
            switch (fields[0]) {
                case 'TRACK':
                    currentTrack = { type: fields[2], index: [] };
                    this.tracks[Number(fields[1])] = currentTrack;
                    break;
                case 'INDEX':
                    if (currentTrack)
                        currentTrack.index[Number(fields[1])] = fields[2];
                    break;
            }
        }
    }
    CDDA.prototype.maxTrack = function () {
        return this.tracks.length - 1;
    };
    CDDA.prototype.extractTrack = function (imgFile, track, dstDir) {
        if (!this.tracks[track] || this.tracks[track].type != 'AUDIO')
            return;
        var startTime = performance.now();
        var start = this.indexToSector(this.tracks[track].index[1]) * 2352;
        var end;
        if (this.tracks[track + 1]) {
            var index = this.tracks[track + 1].index[0] || this.tracks[track + 1].index[1];
            end = this.indexToSector(index) * 2352;
        }
        else {
            end = imgFile.size;
        }
        var dstName = 'track' + track + '.wav';
        var dstFile = dstDir.getFile(dstName, { create: true });
        if (dstFile.getMetadata().size - 44 == end - start) {
            console.log(dstName + ': skipped');
            return;
        }
        var writer = dstFile.createWriter();
        writer.truncate(0);
        writer.write(new Blob([this.createWaveHeader(end - start)]));
        var reader = new FileReaderSync();
        var chunk = 1024 * 1024;
        while (start < end) {
            var size = Math.min(chunk, end - start);
            try {
                var data = reader.readAsArrayBuffer(imgFile.slice(start, start + size));
                writer.write(new Blob([data]));
                start += size;
            }
            catch (e) {
                if (e.code == DOMException.INVALID_STATE_ERR)
                    postMessage({ command: 'writeFailed' });
                throw e;
            }
        }
        console.log(dstName, performance.now() - startTime, 'msec');
    };
    CDDA.prototype.indexToSector = function (index) {
        var msf = index.split(':').map(Number);
        return msf[0] * 60 * 75 + msf[1] * 75 + msf[2];
    };
    CDDA.prototype.createWaveHeader = function (size) {
        var buf = new ArrayBuffer(44);
        var view = new DataView(buf);
        view.setUint32(0, 0x52494646, false);
        view.setUint32(4, size + 36, true);
        view.setUint32(8, 0x57415645, false);
        view.setUint32(12, 0x666D7420, false);
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 2, true);
        view.setUint32(24, 44100, true);
        view.setUint32(28, 176400, true);
        view.setUint16(32, 4, true);
        view.setUint16(34, 16, true);
        view.setUint32(36, 0x64617461, false);
        view.setUint32(40, size, true);
        return buf;
    };
    return CDDA;
})();
var Installer = (function () {
    function Installer() {
    }
    Installer.prototype.setFile = function (file) {
        if (file.name.toLowerCase().endsWith('.img'))
            this.imgFile = file;
        else if (file.name.toLowerCase().endsWith('.cue'))
            this.cdda = new CDDA(file);
    };
    Installer.prototype.ready = function () {
        return this.imgFile && this.cdda && true;
    };
    Installer.prototype.imgReady = function () { return !!this.imgFile; };
    Installer.prototype.cueReady = function () { return !!this.cdda; };
    Installer.prototype.install = function () {
        var localfs = self.webkitRequestFileSystemSync(self.PERSISTENT, 650 * 1024 * 1024);
        for (var track = 1; track <= this.cdda.maxTrack(); track++) {
            if (track == 1) {
                var isofs = new ISO9660FileSystem(new SectorReader(this.imgFile));
                var grGenerator = new GameResourceGenerator();
                var gamedata = isofs.getDirEnt('gamedata', isofs.rootDir());
                for (var _i = 0, _a = isofs.readDir(gamedata); _i < _a.length; _i++) {
                    var e = _a[_i];
                    if (e.name.toLowerCase().endsWith('.ald')) {
                        this.copyFile(e, localfs.root, isofs);
                        grGenerator.addFile(e.name.toLowerCase());
                    }
                }
                grGenerator.generate(localfs.root);
            }
            else {
                this.cdda.extractTrack(this.imgFile, track, localfs.root);
            }
            postMessage({ command: 'progress', value: track, max: this.cdda.maxTrack() });
        }
        postMessage({ command: 'complete' });
    };
    Installer.prototype.copyFile = function (src, dstDir, isofs) {
        var startTime = performance.now();
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
        console.log(src.name, performance.now() - startTime, 'msec');
    };
    return Installer;
})();
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
        for (var i = 0; i < 10; i++) {
            var id = String.fromCharCode(65 + i);
            this.lines.push('Save' + id + ' gamedata/save/' + this.basename + 's' + id.toLowerCase() + '.asd');
        }
        var writer = dstDir.getFile('xsystem35.gr', { create: true }).createWriter();
        writer.truncate(0);
        writer.write(new Blob([this.lines.join('\n') + '\n']));
    };
    GameResourceGenerator.resourceType = { s: 'Scenario', g: 'Graphics', w: 'Wave', d: 'Data', r: 'Resource', m: 'Midi' };
    return GameResourceGenerator;
})();
function uninstall() {
    var fs = self.webkitRequestFileSystemSync(self.PERSISTENT, 0);
    var entries = fs.root.createReader().readEntries();
    for (var _i = 0; _i < entries.length; _i++) {
        var entry = entries[_i];
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
var installer = new Installer();
function onMessage(evt) {
    switch (evt.data.command) {
        case 'setFile':
            installer.setFile(evt.data.file);
            postMessage({ command: 'readyState', imgReady: installer.imgReady(), cueReady: installer.cueReady() });
            break;
        case 'install':
            if (installer.ready())
                installer.install();
            break;
        case 'uninstall':
            uninstall();
            break;
        case 'setFont':
            installFont(evt.data);
            break;
    }
}
addEventListener('message', onMessage);
