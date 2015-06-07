var XSystem35 = (function () {
    function XSystem35() {
        isInstalled().then(this.init.bind(this), function () { return $('.unsupported').classList.remove('hidden'); });
    }
    XSystem35.prototype.postMessage = function (message) {
        this.naclModule.postMessage(message);
    };
    XSystem35.prototype.init = function (installed) {
        var _this = this;
        if (!installed) {
            $('.notInstalled').classList.remove('hidden');
            return;
        }
        $('#contents').classList.remove('hidden');
        document.body.classList.add('bgblack-fade');
        var listener = $('#contents');
        listener.addEventListener('load', this.moduleDidLoad.bind(this), true);
        listener.addEventListener('message', this.handleMessage.bind(this), true);
        listener.addEventListener('error', this.handleError.bind(this), true);
        listener.addEventListener('crash', this.handleCrash.bind(this), true);
        $('#zoom').addEventListener('change', this.handleZoom.bind(this));
        this.naclModule = $('#nacl_module');
        this.naclWidth = Number(this.naclModule.getAttribute('width'));
        this.naclHeight = Number(this.naclModule.getAttribute('height'));
        requestFileSystem().then(function (fs) { return _this.audio = new AudioPlayer(fs.root.toURL()); });
    };
    XSystem35.prototype.moduleDidLoad = function () {
        this.updateStatus('　');
        this.initZoom();
    };
    XSystem35.prototype.handleMessage = function (message) {
        var data = message.data;
        if (data.command == 'set_window_size') {
            this.setWindowSize(data.width, data.height);
        }
        else if (data.command == 'cd_play') {
            this.audio.play(data.track, data.loop);
        }
        else if (data.command == 'cd_stop') {
            this.audio.stop();
        }
        else if (data.command == 'cd_getposition') {
            this.reply(data, this.audio.getPosition());
        }
        else if (typeof data === 'string') {
            console.log(data);
        }
        else {
            console.log('unknown message');
            console.log(message);
        }
    };
    XSystem35.prototype.handleError = function (event) {
        this.updateStatus('ERROR: ' + this.naclModule.lastError);
    };
    XSystem35.prototype.handleCrash = function (event) {
        if (this.naclModule.exitStatus == -1)
            this.updateStatus('CRASHED');
        else
            this.updateStatus('EXITED: ' + this.naclModule.exitStatus);
    };
    XSystem35.prototype.handleZoom = function () {
        var ratio = Number($('#zoom').value) / 100;
        $('#contents').style.width = (640 * ratio) + 'px';
        this.naclModule.setAttribute('width', String(this.naclWidth * ratio));
        this.naclModule.setAttribute('height', String(this.naclHeight * ratio));
        localStorage.setItem('zoom', String(ratio));
    };
    XSystem35.prototype.initZoom = function () {
        var zoomElement = $('#zoom');
        zoomElement.classList.remove('hidden');
        var ratio = Number(localStorage.getItem('zoom') || 1.0);
        if (ratio != 1.0) {
            zoomElement.value = String(ratio * 100);
            this.handleZoom();
        }
    };
    XSystem35.prototype.setWindowSize = function (width, height) {
        this.naclWidth = width;
        this.naclHeight = height;
        this.handleZoom();
    };
    XSystem35.prototype.reply = function (data, value) {
        var result = { 'result': value,
            'naclmsg_id': data['naclmsg_id'] };
        this.postMessage({ 'naclmsg': result });
    };
    XSystem35.prototype.updateStatus = function (status) {
        $('#contents .status').textContent = status;
    };
    return XSystem35;
})();
var AudioPlayer = (function () {
    function AudioPlayer(bgmDir) {
        this.bgmDir = bgmDir;
        this.volume = Number(localStorage.getItem('volume') || 1);
        this.muted = false;
    }
    AudioPlayer.prototype.play = function (track, loop) {
        if (this.elem)
            this.stop();
        var audio = document.createElement('audio');
        audio.setAttribute('src', this.bgmDir + 'track' + track + '.wav');
        audio.setAttribute('controls', 'true');
        audio.volume = this.volume;
        audio.muted = this.muted;
        audio.loop = (loop != 0);
        document.getElementById('contents').appendChild(audio);
        audio.load();
        audio.play();
        this.elem = audio;
        this.currentTrack = track;
    };
    AudioPlayer.prototype.stop = function () {
        if (this.elem) {
            this.elem.pause();
            this.volume = this.elem.volume;
            this.muted = this.elem.muted;
            this.elem.parentNode.removeChild(this.elem);
            this.elem = null;
            this.currentTrack = 0;
            localStorage.setItem('volume', this.volume + '');
        }
    };
    AudioPlayer.prototype.getPosition = function () {
        if (!this.elem || this.elem.ended)
            return 0;
        var time = Math.round(this.elem.currentTime * 75);
        return this.currentTrack | time << 8;
    };
    return AudioPlayer;
})();
var xsystem35 = new XSystem35;
