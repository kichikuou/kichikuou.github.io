class WorkerThread {
    private worker: Worker;

    constructor() {
        this.worker = new Worker('installer-worker.js');
        this.worker.addEventListener('message', this.onMessage.bind(this));
        this.worker.addEventListener('error', this.onError.bind(this));
    }

    send(msg) {
        this.worker.postMessage(msg);
    }

    onMessage(evt: MessageEvent) {
        if (evt.data.command == 'progress')
            console.log(evt.data.value + ' / ' + evt.data.max);
    }
    onError(evt: Event) {
        console.log('worker error', evt);
    }
}

var worker = new WorkerThread();
var file:File;

function handleFileSelect(evt) {
    console.log(evt);
    file = evt.target.files[0];
    worker.send({command:'setFile', file:file});
}

document.getElementById('fileselect').addEventListener('change', handleFileSelect, false);
(<any>navigator).webkitPersistentStorage.requestQuota(650*1024*1024, function(x) { console.log(x); });
