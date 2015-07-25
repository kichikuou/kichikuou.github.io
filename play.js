var XSystem35 = (function () {
    function XSystem35() {
        isInstalled().then(this.init.bind(this), function () { return show($('.unsupported')); });
        this.naclModule = $('#nacl_module');
        this.zoom = new ZoomManager();
        var naclArgs = [];
        if (localStorage.getItem('antialias'))
            naclArgs.push('-antialias');
        var ppapiSimpleVerbosity = '2';
        var debuglv = '1';
        if (window.location.search.length > 1) {
            for (var _i = 0, _a = window.location.search.substr(1).split('&'); _i < _a.length; _i++) {
                var pair = _a[_i];
                var keyValue = pair.split('=');
                switch (keyValue[0]) {
                    case 'debuglv':
                        debuglv = keyValue[1];
                        break;
                    case 'ps_verbosity':
                        ppapiSimpleVerbosity = keyValue[1];
                        break;
                }
            }
        }
        naclArgs.push('-debuglv', debuglv);
        for (var i = 0; i < naclArgs.length; i++)
            this.naclModule.setAttribute('ARG' + (i + 1), naclArgs[i]);
        this.naclModule.setAttribute('PS_VERBOSITY', ppapiSimpleVerbosity);
    }
    XSystem35.prototype.postMessage = function (message) {
        this.naclModule.postMessage(message);
    };
    XSystem35.prototype.init = function (installed) {
        var _this = this;
        if (!installed) {
            show($('.notInstalled'));
            return;
        }
        show($('#contents'));
        document.body.classList.add('bgblack-fade');
        var listener = $('#contents');
        listener.addEventListener('load', this.moduleDidLoad.bind(this), true);
        listener.addEventListener('message', this.handleMessage.bind(this), true);
        listener.addEventListener('error', this.handleError.bind(this), true);
        listener.addEventListener('crash', this.handleCrash.bind(this), true);
        setupTouchHandlers(this.naclModule);
        requestFileSystem().then(function (fs) { return _this.audio = new AudioPlayer(fs.root.toURL()); });
    };
    XSystem35.prototype.moduleDidLoad = function () {
        this.updateStatus('　');
        this.zoom.init();
    };
    XSystem35.prototype.handleMessage = function (message) {
        var data = message.data;
        switch (data.command) {
            case 'exit':
                console.log('exit code: ' + data.code);
                hide($('#contents'));
                setTimeout(function () { return show($('#contents')); }, 3000);
                break;
            case 'localtime':
                this.reply(data, this.localtime(data.time));
                break;
            case 'set_window_size':
                this.zoom.setWindowSize(data.width, data.height);
                break;
            case 'set_caption':
                this.setCaption(data.caption);
                break;
            case 'cd_play':
                this.audio.play(data.track, data.loop);
                break;
            case 'cd_stop':
                this.audio.stop();
                break;
            case 'cd_getposition':
                this.reply(data, this.audio.getPosition());
                break;
            default:
                if (typeof data === 'string') {
                    console.log(data);
                }
                else {
                    console.log('unknown message');
                    console.log(message);
                }
                break;
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
    XSystem35.prototype.reply = function (data, value) {
        var result = { 'result': value,
            'naclmsg_id': data['naclmsg_id'] };
        this.postMessage({ 'naclmsg': result });
    };
    XSystem35.prototype.updateStatus = function (status) {
        $('.pnacl-status').textContent = status;
    };
    XSystem35.prototype.localtime = function (time_t) {
        var t = new Date(time_t * 1000);
        return [t.getSeconds(), t.getMinutes(), t.getHours(),
            t.getDate(), t.getMonth(), t.getFullYear() - 1900, t.getDay()];
    };
    XSystem35.prototype.setCaption = function (buf) {
        var decoder = new TextDecoder('euc-jp');
        var s = decoder.decode(new DataView(buf));
        $('title').textContent = s.slice(s.indexOf(':') + 1) + ' - 鬼畜王 on Chrome';
    };
    return XSystem35;
})();
var ZoomManager = (function () {
    function ZoomManager() {
        this.nonFullScreenRatio = 1;
        var naclModule = $('#nacl_module');
        this.width = Number(naclModule.getAttribute('width'));
        this.height = Number(naclModule.getAttribute('height'));
        this.zoomSelect = $('#zoom');
        this.zoomSelect.addEventListener('change', this.handleZoom.bind(this));
        document.addEventListener('webkitfullscreenchange', this.onFullScreenChange.bind(this));
        if (navigator.userAgent.indexOf('Mac OS X') != -1) {
            var opt = $('#option-fullscreen');
            opt.parentElement.removeChild(opt);
        }
    }
    ZoomManager.prototype.init = function () {
        show(this.zoomSelect);
        var ratio = localStorage.getItem('zoom');
        if (ratio != 'full' && Number(ratio) < 1 || Number(ratio) > 3)
            ratio = null;
        if (ratio && ratio != '1') {
            this.zoomSelect.value = String(ratio);
            this.handleZoom();
        }
    };
    ZoomManager.prototype.setWindowSize = function (width, height) {
        this.width = width;
        this.height = height;
        this.handleZoom();
    };
    ZoomManager.prototype.onFullScreenChange = function () {
        if (!document.webkitFullscreenElement)
            this.zoomSelect.value = String(this.nonFullScreenRatio);
        this.handleZoom();
    };
    ZoomManager.prototype.handleZoom = function () {
        var naclModule = $('#nacl_module');
        var value = this.zoomSelect.value;
        localStorage.setItem('zoom', value);
        if (value == 'full') {
            if (!document.webkitFullscreenElement) {
                naclModule.webkitRequestFullScreen();
            }
            else {
                var ratio = Math.min(window.innerWidth / this.width, window.innerHeight / this.height);
                naclModule.setAttribute('width', String(this.width * ratio));
                naclModule.setAttribute('height', String(this.height * ratio));
            }
        }
        else {
            var ratio = Number(value);
            $('#contents').style.width = (this.width * ratio) + 'px';
            naclModule.setAttribute('width', String(this.width * ratio));
            naclModule.setAttribute('height', String(this.height * ratio));
            this.nonFullScreenRatio = ratio;
        }
    };
    return ZoomManager;
})();
var TouchState;
(function (TouchState) {
    TouchState[TouchState["Up"] = 0] = "Up";
    TouchState[TouchState["Down"] = 1] = "Down";
    TouchState[TouchState["Left"] = 2] = "Left";
    TouchState[TouchState["Right"] = 3] = "Right";
    TouchState[TouchState["Tap"] = 4] = "Tap";
})(TouchState || (TouchState = {}));
;
function setupTouchHandlers(element) {
    var touchState = TouchState.Up;
    var touchTimer;
    element.addEventListener('touchstart', onTouchStart);
    element.addEventListener('touchmove', onTouchMove);
    element.addEventListener('touchend', onTouchEnd);
    function onTouchStart(event) {
        if (event.touches.length != 1)
            return;
        event.preventDefault();
        var touch = event.touches[0];
        generateMouseEvent('mousemove', 0, touch);
        switch (touchState) {
            case TouchState.Tap:
                clearTimeout(touchTimer);
            case TouchState.Up:
                touchState = TouchState.Down;
                touchTimer = setTimeout(function () {
                    generateMouseEvent('mousedown', 2, touch);
                    touchState = TouchState.Right;
                }, 600);
                break;
        }
    }
    function onTouchMove(event) {
        if (event.touches.length != 1)
            return;
        event.preventDefault();
        var touch = event.touches[0];
        if (touchState === TouchState.Down) {
            clearTimeout(touchTimer);
            generateMouseEvent('mousedown', 0, touch);
            touchState = TouchState.Left;
        }
        generateMouseEvent('mousemove', 0, touch);
    }
    function onTouchEnd(event) {
        if (event.changedTouches.length != 1)
            return;
        event.preventDefault();
        var touch = event.changedTouches[0];
        switch (touchState) {
            case TouchState.Down:
                clearTimeout(touchTimer);
                generateMouseEvent('mousedown', 0, touch);
                touchState = TouchState.Tap;
                touchTimer = setTimeout(function () {
                    generateMouseEvent('mouseup', 0, touch);
                    touchState = TouchState.Up;
                }, 20);
                break;
            case TouchState.Left:
                generateMouseEvent('mouseup', 0, touch);
                touchState = TouchState.Up;
                break;
            case TouchState.Right:
                generateMouseEvent('mouseup', 2, touch);
                touchState = TouchState.Up;
                break;
        }
    }
    function generateMouseEvent(type, button, t) {
        var mouseEvent = document.createEvent('MouseEvents');
        mouseEvent.initMouseEvent(type, true, true, window, 0, t.screenX, t.screenY, t.clientX, t.clientY, false, false, false, false, button, null);
        element.dispatchEvent(mouseEvent);
    }
}
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
