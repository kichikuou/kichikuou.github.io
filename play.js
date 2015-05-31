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
        var listener = $('#contents');
        listener.addEventListener('load', this.moduleDidLoad.bind(this), true);
        listener.addEventListener('message', this.handleMessage.bind(this), true);
        listener.addEventListener('error', this.handleError.bind(this), true);
        listener.addEventListener('crash', this.handleCrash.bind(this), true);
        this.naclModule = $('#nacl_module');
        window.webkitRequestFileSystem(window.PERSISTENT, 0, function (fs) { return _this.audio = new AudioPlayer(fs.root.toURL()); });
    };
    XSystem35.prototype.moduleDidLoad = function () {
        this.updateStatus('　');
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
    XSystem35.prototype.setWindowSize = function (width, height) {
        this.naclModule.setAttribute('width', width + '');
        this.naclModule.setAttribute('height', height + '');
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
        this.volume = 1;
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
