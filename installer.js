var InstallerHost = (function () {
    function InstallerHost() {
        this.files = [];
        this.fontErrorCount = 0;
        this.initWorker();
    }
    InstallerHost.prototype.initWorker = function () {
        this.worker = new Worker('installer-worker.js');
        this.worker.addEventListener('message', this.onMessage.bind(this));
        this.worker.addEventListener('error', this.onError.bind(this));
    };
    InstallerHost.prototype.setFile = function (file) {
        this.send({ command: 'setFile', file: file });
        this.files.push(file);
    };
    InstallerHost.prototype.startInstall = function () {
        var _this = this;
        navigator.webkitPersistentStorage.requestQuota(650 * 1024 * 1024, function () {
            _this.send({ command: 'install' });
            view.setProgress(0, 1);
            if (!_this.fontBlob)
                _this.fontBlob = _this.fetchFont();
        });
    };
    InstallerHost.prototype.uninstall = function () {
        this.send({ command: 'uninstall' });
        localStorage.clear();
    };
    InstallerHost.prototype.fetchFont = function () {
        var _this = this;
        return window.fetch('xsystem35/fonts/MTLc3m.ttf')
            .then(function (resp) {
            if (resp.status == 200)
                return resp.blob();
            else
                throw 'fetchFont: ' + resp.status + ' ' + resp.statusText;
        }).catch(function (err) {
            console.log(err);
            if (++_this.fontErrorCount < 3)
                return _this.fetchFont();
            else
                throw err;
        });
    };
    InstallerHost.prototype.send = function (msg) {
        this.worker.postMessage(msg);
    };
    InstallerHost.prototype.onMessage = function (evt) {
        var _this = this;
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
                this.fontBlob.then(function (blob) { return _this.send({ command: 'setFont', name: 'MTLc3m.ttf', blob: blob }); });
                break;
            case 'setFontDone':
                view.onComplete();
                break;
            case 'uninstalled':
                view.onUninstallComplete();
                break;
            case 'writeFailed':
                console.log('terminating worker');
                this.worker.terminate();
                this.initWorker();
                for (var _i = 0, _a = this.files; _i < _a.length; _i++) {
                    var f = _a[_i];
                    this.send({ command: 'setFile', file: f });
                }
                break;
            case 'error':
                view.onError(evt.data.message);
                break;
        }
    };
    InstallerHost.prototype.onError = function (evt) {
        console.log('worker error', evt);
    };
    return InstallerHost;
})();
var InstallerView = (function () {
    function InstallerView() {
        var _this = this;
        window.onbeforeunload = this.handleBeforeunload.bind(this);
        isInstalled().then(function (installed) {
            if (installed)
                _this.setState('installed');
            else
                _this.setState('files');
        }, function () { return _this.setState('unsupported'); });
    }
    InstallerView.prototype.setReadyState = function (imgReady, cueReady) {
        if (imgReady)
            $('#imgReady').classList.remove('notready');
        if (cueReady)
            $('#cueReady').classList.remove('notready');
    };
    InstallerView.prototype.setProgress = function (value, max) {
        this.setState('progress');
        $('#progressBar').max = max;
        $('#progressBar').value = value;
    };
    InstallerView.prototype.onComplete = function () {
        this.setState('installed');
    };
    InstallerView.prototype.onUninstallComplete = function () {
        this.setState('uninstalled');
    };
    InstallerView.prototype.onError = function (message) {
        $('.install-failed').textContent = message;
        this.setState('install-failed');
    };
    InstallerView.prototype.setState = function (state) {
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
    };
    InstallerView.prototype.handleBeforeunload = function () {
        if (!$('.progress').classList.contains('hidden'))
            return "このページを離れるとインストールが中断されます。";
    };
    InstallerView.prototype.handleFileSelect = function (evt) {
        var input = evt.target;
        var files = input.files;
        for (var i = 0; i < files.length; i++)
            host.setFile(files[i]);
        input.value = '';
    };
    InstallerView.prototype.handleDragOver = function (evt) {
        evt.stopPropagation();
        evt.preventDefault();
        evt.dataTransfer.dropEffect = 'copy';
    };
    InstallerView.prototype.handleDrop = function (evt) {
        evt.stopPropagation();
        evt.preventDefault();
        var files = evt.dataTransfer.files;
        for (var i = 0; i < files.length; i++)
            host.setFile(files[i]);
    };
    InstallerView.prototype.handleUninstall = function (evt) {
        if (!window.confirm("アンインストールしてよろしいですか？ セーブデータも削除されます。"))
            return;
        host.uninstall();
        this.setState('uninstalling');
    };
    return InstallerView;
})();
var host = new InstallerHost();
var view = new InstallerView();
