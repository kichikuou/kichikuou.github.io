class InstallerHost {
    private worker: Worker;
    private files: File[] = [];

    constructor() {
        this.initWorker();
    }

    initWorker() {
        this.worker = new Worker('installer-worker.js');
        this.worker.addEventListener('message', this.onMessage.bind(this));
        this.worker.addEventListener('error', this.onError.bind(this));
    }

    setFile(file:File) {
        this.send({command:'setFile', file:file});
        this.files.push(file);
    }

    startInstall() {
        (<any>navigator).webkitPersistentStorage.requestQuota(650*1024*1024, ()=>{
            this.send({command:'install'});
            view.setProgress(0, 1);
        }); // TODO: add error handler
    }

    uninstall() {
        this.send({command:'uninstall'});
    }

    private send(msg:any) {
        this.worker.postMessage(msg);
    }

    private onMessage(evt: MessageEvent) {
        switch (evt.data.command) {
        case 'readyState':
            view.setReadyState(evt.data.imgReady, evt.data.cueReady);
            if (evt.data.imgReady && evt.data.cueReady)
                this.startInstall();
            break;
        case 'progress':
            view.setProgress(evt.data.value, evt.data.max);
            break;
        case 'complete':
            view.onComplete();
            break;
        case 'uninstalled':
            view.onUninstallComplete();
            break;
        case 'writeFailed':
            // Chrome may fail to write to local filesystem because of the
            // 500MB total blob size limitation
            // (https://code.google.com/p/chromium/issues/detail?id=375297).
            // We have to terminate the worker to free up references to blobs
            // and resume install in new worker.
            console.log('terminating worker');
            this.worker.terminate();
            this.initWorker();
            for (var f of this.files)
                this.send({command:'setFile', file:f});
            break;
        }
    }

    private onError(evt: Event) {
        console.log('worker error', evt);
    }
}

class InstallerView {
    constructor() {
        $('#fileselect').addEventListener('change', this.handleFileSelect.bind(this), false);
        document.body.ondragover = this.handleDragOver.bind(this);
        document.body.ondrop = this.handleDrop.bind(this);
        $('#uninstall').addEventListener('click', this.handleUninstall.bind(this));
        window.onbeforeunload = this.handleBeforeunload.bind(this);

        isInstalled().then(function(installed) {
            if (installed)
                $('.installed').classList.remove('hidden');
            else
                $('.files').classList.remove('hidden');
        }, function() {
            $('.unsupported').classList.remove('hidden');
        });
    }

    setReadyState(imgReady:boolean, cueReady:boolean) {
        if (imgReady)
            $('#imgReady').classList.remove('notready');
        if (cueReady)
            $('#cueReady').classList.remove('notready');
    }

    setProgress(value:number, max:number) {
        $('.files').classList.add('hidden');
        $('.progress').classList.remove('hidden');
        (<HTMLProgressElement>$('#progressBar')).max = max;
        (<HTMLProgressElement>$('#progressBar')).value = value;
    }

    onComplete() {
        $('.progress').classList.add('hidden');
        $('.installed').classList.remove('hidden');
    }

    onUninstallComplete() {
        $('.uninstalling').classList.add('hidden');
        $('.uninstalled').classList.remove('hidden');
    }

    private handleBeforeunload():any {
        if (!$('.progress').classList.contains('hidden'))
            return "このページを離れるとインストールが中断されます。";
    }

    private handleFileSelect(evt:Event) {
        var input = <HTMLInputElement>evt.target;
        var files = input.files;
        for (var i = 0; i < files.length; i++)
            host.setFile(files[i]);
        input.value = '';
    }

    private handleDragOver(evt:DragEvent) {
        evt.stopPropagation();
        evt.preventDefault();
        evt.dataTransfer.dropEffect = 'copy';
    }

    private handleDrop(evt:DragEvent) {
        evt.stopPropagation();
        evt.preventDefault();
        var files = evt.dataTransfer.files;
        for (var i = 0; i < files.length; i++)
            host.setFile(files[i]);
    }

    private handleUninstall(evt:Event) {
        if (!window.confirm("アンインストールしてよろしいですか？ セーブデータも削除されます。"))
            return;
        host.uninstall();
        $('.installed').classList.add('hidden');
        $('.uninstalling').classList.remove('hidden');
    }
}

var host = new InstallerHost();
var view = new InstallerView();
