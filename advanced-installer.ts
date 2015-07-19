class AdvancedInstallerHost {
    private worker: Worker;
    private fontBlob: Promise<Blob>;

    constructor(private view:AdvancedInstallerView) {
        this.worker = new Worker('installer-worker.js?advanced');
        this.worker.addEventListener('message', this.onMessage.bind(this));
        this.worker.addEventListener('error', this.onError.bind(this));
    }

    install(files:File[]) {
        (<any>navigator).webkitPersistentStorage.requestQuota(650*1024*1024, ()=>{
            this.worker.postMessage({command:'install', files:files});
            this.fontBlob = window.fetch('xsystem35/fonts/MTLc3m.ttf').then(resp => resp.blob());
        });
        this.view.setProgress(0, 1);
    }

    uninstall() {
        this.worker.postMessage({command:'uninstall'});
        localStorage.clear();
    }

    private onMessage(evt: MessageEvent) {
        switch (evt.data.command) {
        case 'progress':
            this.view.setProgress(evt.data.value, evt.data.max);
            break;
        case 'complete':
            localStorage.setItem('tracks', JSON.stringify(evt.data.tracks));
            this.fontBlob.then(blob => this.worker.postMessage({command:'setFont', name:'MTLc3m.ttf', blob:blob}));
            break;
        case 'setFontDone':
            this.view.onComplete();
            break;
        case 'uninstalled':
            this.view.onUninstallComplete();
            break;
        }
    }

    private onError(evt: Event) {
        console.log('worker error', evt);
    }
}

class AdvancedInstallerView {
    private host:AdvancedInstallerHost;
    private state:HTMLElement;
    private files: File[] = [];

    constructor() {
        this.host = new AdvancedInstallerHost(this);
        isInstalled().then((installed) => {
            if (installed)
                this.setState('installed');
            else
                this.setState('files');
        }, () => this.setState('unsupported'));
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
                document.body.ondragover = this.handleDragOver.bind(this);
                document.body.ondrop = this.handleDrop.bind(this);
                break;
            case 'installed':
                $('#uninstall').addEventListener('click', this.handleUninstall.bind(this));
                break;
            }
        }
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
        var fileList = $('#file-list');
        for (var i = 0; i < files.length; i++) {
            // TODO: remove dups
            this.files.push(files[i]);
            fileList.appendChild(this.createFileListElement(files[i].name));
            if (files[i].name.toLowerCase().endsWith('sa.ald')) {
                $('#install').classList.remove('pure-button-disabled');
                $('#install').addEventListener('click', this.handleInstall.bind(this));
            }
        }
    }

    private createFileListElement(name:string) {
        var li = document.createElement('li');
        var span = document.createElement('span');
        span.textContent = ' ' + name;
        span.classList.add('fa', 'fa-file');
        li.appendChild(span);
        return li;
    }

    private handleInstall(evt:Event) {
        this.host.install(this.files);
    }

    private handleUninstall(evt:Event) {
        if (!window.confirm("アンインストールしてよろしいですか？ セーブデータも削除されます。"))
            return;
        this.host.uninstall();
        this.setState('uninstalling');
    }
}

var advanced_installer_view = new AdvancedInstallerView();
