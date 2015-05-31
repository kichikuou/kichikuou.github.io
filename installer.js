var InstallerHost = (function () {
    function InstallerHost() {
        this.files = [];
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
        });
    };
    InstallerHost.prototype.uninstall = function () {
        this.send({ command: 'uninstall' });
    };
    InstallerHost.prototype.send = function (msg) {
        this.worker.postMessage(msg);
    };
    InstallerHost.prototype.onMessage = function (evt) {
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
                console.log('terminating worker');
                this.worker.terminate();
                this.initWorker();
                for (var _i = 0, _a = this.files; _i < _a.length; _i++) {
                    var f = _a[_i];
                    this.send({ command: 'setFile', file: f });
                }
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
        $('#fileselect').addEventListener('change', this.handleFileSelect.bind(this), false);
        document.body.ondragover = this.handleDragOver.bind(this);
        document.body.ondrop = this.handleDrop.bind(this);
        $('#uninstall').addEventListener('click', this.handleUninstall.bind(this));
        window.onbeforeunload = this.handleBeforeunload.bind(this);
        isInstalled().then(function (installed) {
            if (installed)
                $('.installed').classList.remove('hidden');
            else
                $('.files').classList.remove('hidden');
        }, function () {
            $('.unsupported').classList.remove('hidden');
        });
    }
    InstallerView.prototype.setReadyState = function (imgReady, cueReady) {
        if (imgReady)
            $('#imgReady').classList.remove('notready');
        if (cueReady)
            $('#cueReady').classList.remove('notready');
    };
    InstallerView.prototype.setProgress = function (value, max) {
        $('.files').classList.add('hidden');
        $('.progress').classList.remove('hidden');
        $('#progressBar').max = max;
        $('#progressBar').value = value;
    };
    InstallerView.prototype.onComplete = function () {
        $('.progress').classList.add('hidden');
        $('.installed').classList.remove('hidden');
    };
    InstallerView.prototype.onUninstallComplete = function () {
        $('.uninstalling').classList.add('hidden');
        $('.uninstalled').classList.remove('hidden');
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
        $('.installed').classList.add('hidden');
        $('.uninstalling').classList.remove('hidden');
    };
    return InstallerView;
})();
var host = new InstallerHost();
var view = new InstallerView();
