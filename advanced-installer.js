var AdvancedInstallerHost = (function () {
    function AdvancedInstallerHost(view) {
        this.view = view;
        this.worker = new Worker('installer-worker.js?advanced');
        this.worker.addEventListener('message', this.onMessage.bind(this));
        this.worker.addEventListener('error', this.onError.bind(this));
    }
    AdvancedInstallerHost.prototype.install = function (files) {
        var _this = this;
        navigator.webkitPersistentStorage.requestQuota(650 * 1024 * 1024, function () {
            _this.worker.postMessage({ command: 'install', files: files });
            _this.fontBlob = window.fetch('xsystem35/fonts/MTLc3m.ttf').then(function (resp) { return resp.blob(); });
        });
        this.view.setProgress(0, 1);
    };
    AdvancedInstallerHost.prototype.uninstall = function () {
        this.worker.postMessage({ command: 'uninstall' });
        localStorage.clear();
    };
    AdvancedInstallerHost.prototype.onMessage = function (evt) {
        var _this = this;
        switch (evt.data.command) {
            case 'progress':
                this.view.setProgress(evt.data.value, evt.data.max);
                break;
            case 'complete':
                localStorage.setItem('tracks', JSON.stringify(evt.data.tracks));
                this.fontBlob.then(function (blob) { return _this.worker.postMessage({ command: 'setFont', name: 'MTLc3m.ttf', blob: blob }); });
                break;
            case 'setFontDone':
                this.view.onComplete();
                break;
            case 'uninstalled':
                this.view.onUninstallComplete();
                break;
        }
    };
    AdvancedInstallerHost.prototype.onError = function (evt) {
        console.log('worker error', evt);
    };
    return AdvancedInstallerHost;
})();
var AdvancedInstallerView = (function () {
    function AdvancedInstallerView() {
        var _this = this;
        this.files = [];
        this.host = new AdvancedInstallerHost(this);
        isInstalled().then(function (installed) {
            if (installed)
                _this.setState('installed');
            else
                _this.setState('files');
        }, function () { return _this.setState('unsupported'); });
    }
    AdvancedInstallerView.prototype.setProgress = function (value, max) {
        this.setState('progress');
        $('#progressBar').max = max;
        $('#progressBar').value = value;
    };
    AdvancedInstallerView.prototype.onComplete = function () {
        this.setState('installed');
    };
    AdvancedInstallerView.prototype.onUninstallComplete = function () {
        this.setState('uninstalled');
    };
    AdvancedInstallerView.prototype.setState = function (state) {
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
    };
    AdvancedInstallerView.prototype.handleDragOver = function (evt) {
        evt.stopPropagation();
        evt.preventDefault();
        evt.dataTransfer.dropEffect = 'copy';
    };
    AdvancedInstallerView.prototype.handleDrop = function (evt) {
        evt.stopPropagation();
        evt.preventDefault();
        var files = evt.dataTransfer.files;
        var fileList = $('#file-list');
        for (var i = 0; i < files.length; i++) {
            this.files.push(files[i]);
            fileList.appendChild(this.createFileListElement(files[i].name));
            if (files[i].name.toLowerCase().endsWith('sa.ald')) {
                $('#install').classList.remove('pure-button-disabled');
                $('#install').addEventListener('click', this.handleInstall.bind(this));
            }
        }
    };
    AdvancedInstallerView.prototype.createFileListElement = function (name) {
        var li = document.createElement('li');
        var span = document.createElement('span');
        span.textContent = ' ' + name;
        span.classList.add('fa', 'fa-file');
        li.appendChild(span);
        return li;
    };
    AdvancedInstallerView.prototype.handleInstall = function (evt) {
        this.host.install(this.files);
    };
    AdvancedInstallerView.prototype.handleUninstall = function (evt) {
        if (!window.confirm("アンインストールしてよろしいですか？ セーブデータも削除されます。"))
            return;
        this.host.uninstall();
        this.setState('uninstalling');
    };
    return AdvancedInstallerView;
})();
var advanced_installer_view = new AdvancedInstallerView();
