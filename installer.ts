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

    send(msg:any) {
        this.worker.postMessage(msg);
    }

    onMessage(evt: MessageEvent) {
        switch (evt.data.command) {
        case 'progress':
            console.log(evt.data.value + ' / ' + evt.data.max);
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
    onError(evt: Event) {
        console.log('worker error', evt);
    }
}

var host = new InstallerHost();

function handleFileSelect(evt:Event) {
    var file = (<HTMLInputElement>evt.target).files[0];
    host.setFile(file);
}

document.getElementById('fileselect').addEventListener('change', handleFileSelect, false);
(<any>navigator).webkitPersistentStorage.requestQuota(650*1024*1024, (x:any) => console.log(x));
