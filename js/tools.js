var ToolsHost = (function () {
    function ToolsHost() {
        this.worker = new Worker('js/tools-worker.js');
        this.worker.addEventListener('message', this.onMessage.bind(this));
        this.worker.addEventListener('error', this.onError.bind(this));
    }
    ToolsHost.prototype.findSaveData = function () {
        this.worker.postMessage({ command: 'findSaveData' });
    };
    ToolsHost.prototype.downloadSaveData = function () {
        this.worker.postMessage({ command: 'downloadSaveData' });
    };
    ToolsHost.prototype.uploadSaveData = function (files) {
        this.worker.postMessage({ command: 'uploadSaveData', files: files });
    };
    ToolsHost.prototype.onMessage = function (evt) {
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
    };
    ToolsHost.prototype.onError = function (evt) {
        console.log('worker error', evt);
    };
    return ToolsHost;
})();
var ToolsView = (function () {
    function ToolsView() {
        isInstalled().then(function (installed) {
            if (installed) {
                show($('.saveDataManager'));
                show($('.config'));
                toolsHost.findSaveData();
            }
            else {
                show($('.notInstalled'));
            }
        }, function () { return show($('.unsupported')); });
        $('#downloadSaveData').addEventListener('click', this.handleDownloadSaveData.bind(this));
        $('#uploadSaveData').addEventListener('click', this.handleUploadSaveData.bind(this));
        document.body.addEventListener('dragover', dropEffect('none'));
        $('.saveDataManager').addEventListener('dragover', dropEffect('copy'));
        $('.saveDataManager').addEventListener('drop', this.handleDropSaveData.bind(this));
        $('#antialias').addEventListener('change', this.handleAntialiasChange.bind(this));
        if (localStorage.getItem('antialias'))
            $('#antialias').checked = true;
    }
    ToolsView.prototype.saveDataFound = function () {
        $('#downloadSaveData').removeAttribute('disabled');
    };
    ToolsView.prototype.saveFile = function (blob) {
        var elem = document.createElement('a');
        elem.setAttribute('download', 'savedata.zip');
        elem.setAttribute('href', URL.createObjectURL(blob));
        elem.click();
        ga('send', 'event', 'tools', 'download-savedata');
    };
    ToolsView.prototype.uploadSaveDataDone = function (success) {
        ga('send', 'event', 'tools', 'restore-savedata', success ? 'ok' : 'fail');
        $('#uploadResult').textContent = success ? '成功しました。' : 'セーブデータを復元できませんでした。';
        if (success)
            this.saveDataFound();
    };
    ToolsView.prototype.handleDownloadSaveData = function (evt) {
        toolsHost.downloadSaveData();
    };
    ToolsView.prototype.handleUploadSaveData = function (evt) {
        var input = document.createElement('input');
        input.type = 'file';
        input.addEventListener('change', function (evt) {
            toolsHost.uploadSaveData(input.files);
        });
        input.click();
    };
    ToolsView.prototype.handleDropSaveData = function (evt) {
        evt.stopPropagation();
        evt.preventDefault();
        toolsHost.uploadSaveData(evt.dataTransfer.files);
    };
    ToolsView.prototype.handleAntialiasChange = function (evt) {
        if (evt.target.checked)
            localStorage.setItem('antialias', 'true');
        else
            localStorage.removeItem('antialias');
    };
    return ToolsView;
})();
function dropEffect(effect) {
    return function (evt) {
        evt.stopPropagation();
        evt.preventDefault();
        evt.dataTransfer.dropEffect = effect;
    };
}
var toolsHost = new ToolsHost();
var toolsView = new ToolsView();
