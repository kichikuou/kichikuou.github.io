class InstallerHost {
    private worker: Worker;
    private files: File[] = [];
    private fontBlob: Promise<Blob>;
    private fontErrorCount = 0;

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
            if (!this.fontBlob)
                this.fontBlob = this.fetchFont();
        }); // TODO: add error handler
    }

    uninstall() {
        this.send({command:'uninstall'});
        localStorage.clear();
    }

    fetchFont(): Promise<Blob> {
        return window.fetch('xsystem35/fonts/MTLc3m.ttf')
            .then(resp => {
                if (resp.status == 200)
                    return resp.blob();
                else
                    throw 'fetchFont: ' + resp.status + ' ' + resp.statusText;
            }).catch((err) => {
                console.log(err);
                if (++this.fontErrorCount < 3)
                    return this.fetchFont();
                else
                    throw err;
            });
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
            this.fontBlob.then(blob => this.send({command:'setFont', name:'MTLc3m.ttf', blob:blob}));
            break;
        case 'setFontDone':
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
    private state:HTMLElement;

    constructor() {
        window.onbeforeunload = this.handleBeforeunload.bind(this);

        isInstalled().then((installed) => {
            if (installed)
                this.setState('installed');
            else
                this.setState('files');
        }, () => this.setState('unsupported'));
    }

    setReadyState(imgReady:boolean, cueReady:boolean) {
        if (imgReady)
            $('#imgReady').classList.remove('notready');
        if (cueReady)
            $('#cueReady').classList.remove('notready');
    }

    setProgress(value:number, max:number) {
        this.setState('progress');
        (<HTMLProgressElement>$('#progressBar')).max = max;
        (<HTMLProgressElement>$('#progressBar')).value = value;
    }

    onComplete() {
        this.setState('installed');
    }

    onUninstallComplete() {
        this.setState('uninstalled');
    }

    private setState(state:string) {
        var newState = $('.' + state);
        if (this.state !== newState) {
            if (this.state)
                hide(this.state);
            show(newState);
            this.state = newState;

            switch (state) {
            case 'files':
                $('#fileselect').addEventListener('change', this.handleFileSelect.bind(this), false);
                document.body.ondragover = this.handleDragOver.bind(this);
                document.body.ondrop = this.handleDrop.bind(this);
                break;
            case 'installed':
                $('#uninstall').addEventListener('click', this.handleUninstall.bind(this));
                break;
            }
        }
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
        this.setState('uninstalling');
    }
}

var host = new InstallerHost();
var view = new InstallerView();
