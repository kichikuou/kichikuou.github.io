declare var self: WorkerGlobalScope;

class ISO9660FileSystem {
    private pvd: PVD;

    constructor(private sectorReader: SectorReader) {
        this.pvd = new PVD(sectorReader.read(0x10));
        if (this.pvd.type != 1)
            throw('PVD not found');
    }

    rootDir(): DirEnt {
        return this.pvd.rootDirEnt();
    }

    getDirEnt(name:string, parent:DirEnt): DirEnt {
        name = name.toLowerCase();
        for (var e of this.readDir(parent)) {
            if (e.name.toLowerCase() == name)
                return e;
        }
        return null;
    }

    readDir(dirent:DirEnt): DirEnt[] {
        var sector = dirent.sector;
        var position = 0;
        var length = dirent.size;
        var entries:DirEnt[] = [];
        while (position < length) {
            if (position == 0)
                var buf = this.sectorReader.read(sector);
            var child = new DirEnt(buf, position);
            if (child.length == 0) {
                // Padded end of sector
                position = 2048;
            } else {
                entries.push(child);
                position += child.length;
            }
            if (position > 2048)
                throw('dirent across sector boundary');
            if (position == 2048) {
                sector++;
                position = 0;
                length -= 2048;
            }
        }
        return entries;
    }

    readFile(dirent:DirEnt, callback: (data:ArrayBufferView[]) => void) {
        this.sectorReader.sequentialRead(dirent.sector, dirent.size, callback);
    }
}

class PVD {
    private view:DataView;
    constructor(private buf:ArrayBuffer) {
        this.view = new DataView(buf);
    }
    get type(): number {
        return this.view.getUint8(0);
    }
    rootDirEnt(): DirEnt {
        return new DirEnt(this.buf, 156);
    }
}

class DirEnt {
    private view:DataView;
    constructor(private buf:ArrayBuffer, private offset:number) {
        this.view = new DataView(buf, offset);
    }
    get length(): number {
        return this.view.getUint8(0);
    }
    get sector(): number {
        return this.view.getUint32(2, true);
    }
    get size(): number {
        return this.view.getUint32(10, true);
    }
    get name(): string {
        var len = this.view.getUint8(32);
        var decoder = new TextDecoder('shift_jis');
        return decoder.decode(new DataView(this.buf, this.offset+33, len));
    }
}

class SectorReader {
    constructor(private file:File) {}

    read(sector:number, maxLength = 2048): ArrayBuffer {
        var start = sector * 2352 + 16;
        var end = start + Math.min(maxLength, 2048);
        var reader = new FileReaderSync();  // reuse?
        return reader.readAsArrayBuffer(this.file.slice(start, end));
    }

    sequentialRead(startSector: number, length: number, callback:(data:ArrayBufferView[])=>void) {
        var endSector = startSector + ((length + 2047) >> 11);
        var chunk = 256;
        var reader = new FileReaderSync();
        for (var sector = startSector; sector < endSector; sector += chunk) {
            var n = Math.min(chunk, endSector - sector);
            var blob = this.file.slice(sector * 2352, (sector + n) * 2352);
            var buf = reader.readAsArrayBuffer(blob);
            var bufs:ArrayBufferView[] = [];
            for (var i = 0; i < n; i++) {
                bufs.push(new DataView(buf, i * 2352 + 16, Math.min(length, 2048)));
                length -= 2048;
            }
            callback(bufs);
        }
    }
}

interface Track {
    type:string;
    index:string[];
};

class CDDA {
    private tracks:Track[];

    constructor(cueFile:File) {
        var reader = new FileReaderSync();
        var lines = reader.readAsText(cueFile).split('\n');
        this.tracks = [];
        var currentTrack:Track = null;
        for (var line of lines) {
            var fields = line.trim().split(/\s+/);
            switch (fields[0]) {
            case 'TRACK':
                currentTrack = {type:fields[2], index:[]};
                this.tracks[fields[1]] = currentTrack;
                break;
            case 'INDEX':
                if (currentTrack)
                    currentTrack.index[fields[1]] = fields[2];
                break;
            }
        }
    }

    maxTrack():number {
        return this.tracks.length - 1;
    }

    extractTrack(imgFile:File, track:number, dstDir:DirectoryEntrySync) {
        if (!this.tracks[track] || this.tracks[track].type != 'AUDIO')
            return;

        var start = this.indexToSector(this.tracks[track].index[1]) * 2352;
        var end:number;
        if (this.tracks[track+1]) {
            var index = this.tracks[track+1].index[0] || this.tracks[track+1].index[1];
            end = this.indexToSector(index) * 2352;
        } else {
            end = imgFile.size;
        }

        var reader = new FileReaderSync();
        var header = this.createWaveHeader(end - start);

        var dstName = 'track' + track + '.wav';
        console.log(dstName);
        var dstFile = dstDir.getFile(dstName, {create:true});
        var writer = dstFile.createWriter();
        writer.truncate(0);
        writer.write(new Blob([header]));

        var chunk = 1024*1024;
        while (start < end) {
            var size = Math.min(chunk, end - start);
            var data = reader.readAsArrayBuffer(imgFile.slice(start, start + size));
            writer.write(new Blob([data]));
            start += size;
        }
    }

    indexToSector(index:string):number {
        var msf = index.split(':').map(Number);
        return msf[0]*60*75 + msf[1]*75 + msf[2];
    }

    createWaveHeader(size:number):ArrayBuffer {
        var buf = new ArrayBuffer(44);
        var view = new DataView(buf);
        view.setUint32(0, 0x52494646, false); // 'RIFF'
        view.setUint32(4, size + 36, true); // filesize - 8
        view.setUint32(8, 0x57415645, false); // 'WAVE'
        view.setUint32(12, 0x666D7420, false); // 'fmt '
        view.setUint32(16, 16, true); // size of fmt chunk
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, 2, true); // stereo
        view.setUint32(24, 44100, true); // sampling rate
        view.setUint32(28, 176400, true); // bytes/sec
        view.setUint16(32, 4, true); // block size
        view.setUint16(34, 16, true); // bit/sample
        view.setUint32(36, 0x64617461, false); // 'data'
        view.setUint32(40, size, true); // data size
        return buf;
    }
}

class Installer {
    private imgFile:File;
    private cdda:CDDA;
    private step = 1;

    setFile(file:File) {
        if (file.name.toLowerCase().endsWith('.img'))
            this.imgFile = file;
        else if (file.name.toLowerCase().endsWith('.cue'))
            this.cdda = new CDDA(file);
        else
            throw 'Unknown file type';
    }

    ready(): boolean {
        return this.imgFile && this.cdda && true;
    }

    install():number[] {
        var localfs = self.webkitRequestFileSystemSync(self.PERSISTENT, 650*1024*1024);
        if (this.step == 1) {
            var isofs = new ISO9660FileSystem(new SectorReader(this.imgFile));

            var gamedata = isofs.getDirEnt('gamedata', isofs.rootDir());
            for (var e of isofs.readDir(gamedata)) {
                if (e.name.toLowerCase().endsWith('.ald'))
                    this.copyFile(e, localfs.root, isofs);
            }
        } else {
            this.cdda.extractTrack(this.imgFile, this.step, localfs.root);
        }
        this.step++;
        return [this.step - 1, this.cdda.maxTrack()];
    }

    copyFile(src:DirEnt, dstDir:DirectoryEntrySync, isofs:ISO9660FileSystem) {
        console.log(src.name); console.log(performance.now());
        var writer = dstDir.getFile(src.name.toLowerCase(), {create:true}).createWriter();
        writer.truncate(0);
        isofs.readFile(src, function(bufs:ArrayBufferView[]) {
            writer.write(new Blob(bufs));
        });
        console.log(performance.now());
    }
}

var installer = new Installer();

function install1step() {
    var progress = installer.install();
    postMessage({command:'progress', value:progress[0], max:progress[1]});
    if (progress[0] < progress[1])
        setTimeout(install1step, 100);
}

function onMessage(evt: MessageEvent) {
    if (evt.data.command == 'setFile') {
        installer.setFile(evt.data.file);
        if (installer.ready())
            install1step();
    }
}

addEventListener('message', onMessage);
