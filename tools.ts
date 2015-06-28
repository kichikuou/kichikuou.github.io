class ToolsHost {
    private worker: Worker;

    constructor() {
        this.worker = new Worker('tools-worker.js');
        this.worker.addEventListener('message', this.onMessage.bind(this));
        this.worker.addEventListener('error', this.onError.bind(this));
    }

    findSaveData() {
        this.worker.postMessage({command:'findSaveData'});
    }

    downloadSaveData() {
        this.worker.postMessage({command:'downloadSaveData'});
    }

    uploadSaveData(file:File) {
        this.worker.postMessage({command:'uploadSaveData', file:file});
    }

    private onMessage(evt: MessageEvent) {
        switch (evt.data.command) {
            case 'saveDataFound':
                toolsView.saveDataFound();
                break;
            case 'downloadSaveData':
                toolsView.saveFile(evt.data.blob);
                break;
            case 'uploadSaveData':
                toolsView.uploadSaveDataDone(evt.data.success);
                break;
        }
    }

    private onError(evt: Event) {
        console.log('worker error', evt);
    }
}

class ToolsView {
    constructor() {
        isInstalled().then((installed) => {
            if (installed) {
                show($('.saveDataManager'));
                show($('.config'));
                toolsHost.findSaveData();
            } else {
                show($('.notInstalled'));
            }
        }, () => show($('.unsupported')));

        $('#downloadSaveData').addEventListener('click', this.handleDownloadSaveData.bind(this));
        $('#uploadSaveData').addEventListener('click', this.handleUploadSaveData.bind(this));
        $('#antialias').addEventListener('change', this.handleAntialiasChange.bind(this));
    }

    saveDataFound() {
        $('#downloadSaveData').removeAttribute('disabled');
    }

    saveFile(blob:Blob) {
        var elem = document.createElement('a');
        elem.setAttribute('download', 'savedata.zip');
        elem.setAttribute('href', URL.createObjectURL(blob));
        elem.click();
    }

    uploadSaveDataDone(success:boolean) {
        $('#uploadResult').textContent = success ? '成功しました。' : 'セーブデータを復元できませんでした。';
        if (success)
            this.saveDataFound();
    }

    private handleDownloadSaveData(evt:Event) {
        toolsHost.downloadSaveData();
    }

    private handleUploadSaveData(evt:Event) {
        var input = document.createElement('input');
        input.type = 'file';
        input.addEventListener('change', (evt:Event) => {
            toolsHost.uploadSaveData(input.files[0]);
        });
        input.click();
    }

    private handleAntialiasChange(evt:Event) {
        if ((<HTMLInputElement>evt.target).checked)
            localStorage.setItem('nmf', 'xsystem35/experimental/antialias/xsystem35.nmf');
        else
            localStorage.removeItem('nmf');
    }
}

var toolsHost = new ToolsHost();
var toolsView = new ToolsView();
