importScripts('cdimage.js');

class Installer {
    private imgFile:File;
    private cueFile:File;
    private imageReader:CDImageReader;

    constructor() {
        addEventListener('message', this.onMessage.bind(this));
    }

    private onMessage(evt: MessageEvent) {
        switch (evt.data.command) {
        case 'setFile':
            this.setFile(evt.data.file);
            var imgName = this.imgFile && this.imgFile.name;
            var cueName = this.cueFile && this.cueFile.name;
            postMessage({command:'readyState', img:imgName, cue:cueName});
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
    }

    private setFile(file:File) {
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
    }

    private ready(): boolean {
        return !!this.imageReader;
    }

    private install() {
        var localfs = self.webkitRequestFileSystemSync(self.PERSISTENT, 650*1024*1024);
        for (var track = 1; track <= this.imageReader.maxTrack(); track++) {
            if (track == 1) {
                var isofs = new ISO9660FileSystem(this.imageReader);
                var grGenerator = new GameResourceGenerator();

                var gamedata = isofs.getDirEnt('gamedata', isofs.rootDir());
                if (!gamedata) {
                    postMessage({command:'error', message:'インストールできません。GAMEDATAフォルダが見つかりません。'});
                    return;
                }
                for (var e of isofs.readDir(gamedata)) {
                    if (e.name.toLowerCase().endsWith('.ald')) {
                        this.copyFile(e, localfs.root, isofs);
                        grGenerator.addFile(e.name.toLowerCase());
                    }
                }
                if (grGenerator.isEmpty()) {
                    postMessage({command:'error', message:'インストールできません。System3.xのゲームではありません。'});
                    return;
                }
                grGenerator.generate(localfs.root);
            } else {
                this.imageReader.extractTrack(track, localfs.root);
            }
            postMessage({command:'progress', value:track, max:this.imageReader.maxTrack()});
        }
        postMessage({command:'complete'});
    }

    private copyFile(src:DirEnt, dstDir:DirectoryEntrySync, isofs:ISO9660FileSystem) {
        var dstFile = dstDir.getFile(src.name.toLowerCase(), {create:true});
        var writer = dstFile.createWriter();
        if (dstFile.getMetadata().size == src.size) {
            console.log(src.name + ': skip');
            return;
        }
        writer.truncate(0);
        isofs.readFile(src, function(bufs:ArrayBufferView[]) {
            writer.write(new Blob(bufs));
        });
        console.log(src.name);
    }
}

class AdvancedInstaller {
    constructor() {
        addEventListener('message', this.onMessage.bind(this));
    }

    private onMessage(evt: MessageEvent) {
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
    }

    private install(files:File[]) {
        var localfs = self.webkitRequestFileSystemSync(self.PERSISTENT, 650*1024*1024);
        var grGenerator = new GameResourceGenerator();
        var tracks:string[] = [];

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
                    dstdir = localfs.root.getDirectory('save', {create:true});
            }
            this.copyFile(f, dstdir);
            postMessage({command:'progress', value:i, max:files.length});
        }
        grGenerator.generate(localfs.root);
        postMessage({command:'complete', tracks:tracks});
    }

    private copyFile(file:File, dstDir:DirectoryEntrySync) {
        dstDir.getFile(file.name.toLowerCase(), {create:true})
            .createWriter().write(file);
    }
}

class GameResourceGenerator {
    static resourceType = {s:'Scenario', g:'Graphics', w:'Wave', d:'Data', r:'Resource', m:'Midi'};
    private basename:string;
    private lines:string[] = [];

    addFile(name:string) {
        var type = name.charAt(name.length - 6);
        var id = name.charAt(name.length - 5);
        this.basename = name.slice(0, -6);
        this.lines.push(GameResourceGenerator.resourceType[type] + id.toUpperCase() + ' gamedata/' + name);
    }

    generate(dstDir:DirectoryEntrySync) {
        for (var i = 0; i < 26; i++) {
            var id = String.fromCharCode(65 + i);
            this.lines.push('Save' + id + ' gamedata/save/' + this.basename + 's' + id.toLowerCase() + '.asd');
        }
        var writer = dstDir.getFile('xsystem35.gr', {create:true}).createWriter();
        writer.truncate(0);
        writer.write(new Blob([this.lines.join('\n') + '\n']));
    }

    isEmpty(): boolean {
        return this.lines.length == 0;
    }
}

function uninstall() {
    var fs = self.webkitRequestFileSystemSync(self.PERSISTENT, 0);
    var entries = fs.root.createReader().readEntries();
    for (var entry of entries) {
        if (entry.isDirectory)
            (<DirectoryEntrySync>entry).removeRecursively();
        else
            entry.remove();
    }
    postMessage({command:'uninstalled'});
}

function installFont(data:any) {
    var fs = self.webkitRequestFileSystemSync(self.PERSISTENT, 0);
    fs.root.getDirectory('fonts', {create:true})
      .getFile(data.name, {create:true})
      .createWriter().write(data.blob);
    fs.root.getDirectory('save', {create:true});
    postMessage({command:'setFontDone'});
}

var installer = location.search.startsWith('?advanced') ? new AdvancedInstaller() : new Installer();
