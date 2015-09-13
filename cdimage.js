var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var ISO9660FileSystem = (function () {
    function ISO9660FileSystem(sectorReader) {
        this.sectorReader = sectorReader;
        this.pvd = new PVD(sectorReader.readSector(0x10));
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
                var buf = this.sectorReader.readSector(sector);
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
        this.sectorReader.readSequentialSectors(dirent.sector, dirent.size, callback);
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
var ImageReaderBase = (function () {
    function ImageReaderBase(image) {
        this.image = image;
    }
    ImageReaderBase.prototype.readSequential = function (startOffset, bytesToRead, blockSize, sectorSize, sectorOffset, callback) {
        var sectors = Math.ceil(bytesToRead / sectorSize);
        var chunk = 256;
        var reader = new FileReaderSync();
        while (sectors > 0) {
            var n = Math.min(chunk, sectors);
            var blob = this.image.slice(startOffset, startOffset + n * blockSize);
            var buf = reader.readAsArrayBuffer(blob);
            var bufs = [];
            for (var i = 0; i < n; i++) {
                bufs.push(new DataView(buf, i * blockSize + sectorOffset, Math.min(bytesToRead, sectorSize)));
                bytesToRead -= sectorSize;
            }
            callback(bufs);
            sectors -= n;
            startOffset += n * blockSize;
        }
    };
    return ImageReaderBase;
})();
var ImgCueReader = (function (_super) {
    __extends(ImgCueReader, _super);
    function ImgCueReader(img, cue) {
        _super.call(this, img);
        this.parseCue(cue);
    }
    ImgCueReader.prototype.readSector = function (sector) {
        var start = sector * 2352 + 16;
        var end = start + 2048;
        return new FileReaderSync().readAsArrayBuffer(this.image.slice(start, end));
    };
    ImgCueReader.prototype.readSequentialSectors = function (startSector, length, callback) {
        this.readSequential(startSector * 2352, length, 2352, 2048, 16, callback);
    };
    ImgCueReader.prototype.parseCue = function (cueFile) {
        var lines = new FileReaderSync().readAsText(cueFile).split('\n');
        this.tracks = [];
        var currentTrack = null;
        for (var _i = 0; _i < lines.length; _i++) {
            var line = lines[_i];
            var fields = line.trim().split(/\s+/);
            switch (fields[0]) {
                case 'TRACK':
                    currentTrack = Number(fields[1]);
                    this.tracks[currentTrack] = { type: fields[2], index: [] };
                    break;
                case 'INDEX':
                    if (currentTrack)
                        this.tracks[currentTrack].index[Number(fields[1])] = fields[2];
                    break;
            }
        }
    };
    ImgCueReader.prototype.maxTrack = function () {
        return this.tracks.length - 1;
    };
    ImgCueReader.prototype.extractTrack = function (track, dstDir) {
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
            end = this.image.size;
        }
        var dstName = 'track' + track + '.wav';
        var dstFile = dstDir.getFile(dstName, { create: true });
        if (dstFile.getMetadata().size - 44 == end - start) {
            console.log(dstName + ': skipped');
            return;
        }
        var writer = dstFile.createWriter();
        writer.truncate(0);
        writer.write(new Blob([createWaveHeader(end - start)]));
        var reader = new FileReaderSync();
        var chunk = 1024 * 1024;
        while (start < end) {
            var size = Math.min(chunk, end - start);
            try {
                var data = reader.readAsArrayBuffer(this.image.slice(start, start + size));
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
    ImgCueReader.prototype.indexToSector = function (index) {
        var msf = index.split(':').map(Number);
        return msf[0] * 60 * 75 + msf[1] * 75 + msf[2];
    };
    return ImgCueReader;
})(ImageReaderBase);
var MdsTrackMode;
(function (MdsTrackMode) {
    MdsTrackMode[MdsTrackMode["Audio"] = 169] = "Audio";
    MdsTrackMode[MdsTrackMode["Mode1"] = 170] = "Mode1";
})(MdsTrackMode || (MdsTrackMode = {}));
;
var MdfMdsReader = (function (_super) {
    __extends(MdfMdsReader, _super);
    function MdfMdsReader(mdf, mds) {
        _super.call(this, mdf);
        this.parseMds(mds);
    }
    MdfMdsReader.prototype.parseMds = function (mdsFile) {
        var buf = new FileReaderSync().readAsArrayBuffer(mdsFile);
        var signature = new TextDecoder().decode(new DataView(buf, 0, 16));
        if (signature != 'MEDIA DESCRIPTOR')
            throw mdsFile.name + ': not a mds file';
        var header = new DataView(buf, 0, 0x70);
        var entries = header.getUint8(0x62);
        this.tracks = [];
        for (var i = 0; i < entries; i++) {
            var trackData = new DataView(buf, 0x70 + i * 0x50, 0x50);
            var extraData = new DataView(buf, 0x70 + entries * 0x50 + i * 8, 8);
            var mode = trackData.getUint8(0x00);
            var track = trackData.getUint8(0x04);
            var sectorSize = trackData.getUint16(0x10, true);
            var offset = trackData.getUint32(0x28, true);
            var sectors = extraData.getUint32(0x4, true);
            if (track < 100)
                this.tracks[track] = { mode: mode, sectorSize: sectorSize, offset: offset, sectors: sectors };
        }
        if (this.tracks[1].mode != MdsTrackMode.Mode1)
            throw 'track 1 is not mode1';
    };
    MdfMdsReader.prototype.readSector = function (sector) {
        var start = sector * this.tracks[1].sectorSize + 16;
        var end = start + 2048;
        return new FileReaderSync().readAsArrayBuffer(this.image.slice(start, end));
    };
    MdfMdsReader.prototype.readSequentialSectors = function (startSector, length, callback) {
        var track = this.tracks[1];
        this.readSequential(track.offset + startSector * track.sectorSize, length, track.sectorSize, 2048, 16, callback);
    };
    MdfMdsReader.prototype.maxTrack = function () {
        return this.tracks.length - 1;
    };
    MdfMdsReader.prototype.extractTrack = function (track, dstDir) {
        if (!this.tracks[track] || this.tracks[track].mode != MdsTrackMode.Audio)
            return;
        var startTime = performance.now();
        var size = this.tracks[track].sectors * 2352;
        var dstName = 'track' + track + '.wav';
        var dstFile = dstDir.getFile(dstName, { create: true });
        if (dstFile.getMetadata().size - 44 == size) {
            console.log(dstName + ': skipped');
            return;
        }
        var writer = dstFile.createWriter();
        writer.truncate(0);
        writer.write(new Blob([createWaveHeader(size)]));
        this.readSequential(this.tracks[track].offset, size, this.tracks[track].sectorSize, 2352, 0, function (buf) {
            writer.write(new Blob(buf));
        });
        console.log(dstName, performance.now() - startTime, 'msec');
    };
    return MdfMdsReader;
})(ImageReaderBase);
function createWaveHeader(size) {
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
}
