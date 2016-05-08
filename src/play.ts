interface PNaClElement extends HTMLElement {
    lastError: string;
    exitStatus: number;
    postMessage: (message:any)=>void;
}

class XSystem35 {
    private naclModule:PNaClElement;
    private volumeControl: VolumeControl;
    private audio:AudioPlayer;
    private zoom:ZoomManager;
    private webMidiLinkUrl:string;
    private midiPlayer:MidiPlayer;

    constructor() {
        isInstalled().then(this.init.bind(this), () => show($('.unsupported')));

        this.naclModule = <PNaClElement>$('#nacl_module');
        this.volumeControl = new VolumeControl();
        this.zoom = new ZoomManager();
        this.webMidiLinkUrl = localStorage.getItem('midi');

        var naclArgs:string[] = [];
        if (this.webMidiLinkUrl)
            naclArgs.push('-Mn')
        if (localStorage.getItem('antialias'))
            naclArgs.push('-antialias');

        var ppapiSimpleVerbosity = '2'; // PSV_WARN
        var debuglv = '1';
        if (window.location.search.length > 1) {
            for (var pair of window.location.search.substr(1).split('&')) {
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
            this.naclModule.setAttribute('ARG' + (i+1), naclArgs[i]);
        this.naclModule.setAttribute('PS_VERBOSITY', ppapiSimpleVerbosity);
    }

    postMessage(message:any) {
        this.naclModule.postMessage(message);
    }

    private init(installed:boolean) {
        if (!installed) {
            show($('.notInstalled'));
            return;
        }
        show($('#contents'));
        document.body.classList.add('bgblack-fade');
        var listener = $('#contents');
        listener.addEventListener('progress', this.onLoadProgress.bind(this), true);
        listener.addEventListener('load', this.moduleDidLoad.bind(this), true);
        listener.addEventListener('message', this.handleMessage.bind(this), true);
        listener.addEventListener('error', this.handleError.bind(this), true);
        listener.addEventListener('crash', this.handleCrash.bind(this), true);
        setupTouchHandlers(this.naclModule);

        requestFileSystem().then(
            (fs) => this.audio = new AudioPlayer(fs.root.toURL(), this.volumeControl));
    }

    private onLoadProgress(e:{lengthComputable:boolean, loaded:number, total:number}) {
        if (!e.lengthComputable)
            return;
        var progressBar = (<HTMLProgressElement>$('#progressBar'));
        if (!isVisible(progressBar)) {
            show(progressBar);
            ga('send', 'event', 'play', 'slow-load');
        }
        progressBar.max = e.total;
        progressBar.value = e.loaded;
    }

    private moduleDidLoad() {
        this.updateStatus('　');
        hide($('#progressBar'));
        this.zoom.init();
        this.volumeControl.init();
        if (this.webMidiLinkUrl)
            this.midiPlayer = new MidiPlayer(this.webMidiLinkUrl, this.volumeControl);
    }

    private handleMessage(message:any) {
        var data = message.data;
        switch (data.command) {
        case 'exit':
            console.log('exit code: ' + data.code);
            // Kill PNaCl module and reboot after 3 seconds
            hide($('#contents'));
            setTimeout(() => show($('#contents')), 3000);
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
        case 'midi_start':
            this.midiPlayer.play(data.data);
            break;
        case 'midi_stop':
            this.midiPlayer.stop();
            break;
        case 'input_string':
            this.inputString(data);
            break;
        case 'input_number':
            this.inputNumber(data);
            break;
        default:
            if (typeof data === 'string') {
                console.log(data);  // debug message
            } else {
                console.log('unknown message');
                console.log(message);
            }
            break;
        }
    }

    private handleError(event:Event) {
        this.updateStatus('ERROR: ' + this.naclModule.lastError);
    }

    private handleCrash(event:Event) {
        ga('send', 'event', 'play', 'crashed', this.naclModule.exitStatus + '');
        if (this.naclModule.exitStatus == -1)
            this.updateStatus('CRASHED');
        else
            this.updateStatus('EXITED: ' + this.naclModule.exitStatus);
    }

    private reply(data:any, value:any) {
        var result = { 'result': value,
                       'naclmsg_id': data['naclmsg_id'] };
        this.postMessage({'naclmsg':result});
    }

    private updateStatus(status:string) {
        $('.pnacl-status').textContent = status;
    }

    private localtime(time_t:number): number[] {
        var t = new Date(time_t * 1000);
        return [t.getSeconds(), t.getMinutes(), t.getHours(),
                t.getDate(), t.getMonth(), t.getFullYear() - 1900, t.getDay()];
    }

    private setCaption(buf:ArrayBuffer) {
        var decoder = new TextDecoder('euc-jp');
        var s = decoder.decode(new DataView(buf));
        var title = s.slice(s.indexOf(':')+1);
        ga('send', 'event', 'play', 'gamestart', title);
        $('title').textContent = title + ' - 鬼畜王 on Chrome';
    }

    private inputString(data:{title:ArrayBuffer, oldstring:ArrayBuffer, maxlen:number}) {
        var decoder = new TextDecoder('euc-jp');
        var title = decoder.decode(new DataView(data.title)) + ' (全角' + data.maxlen + '文字まで)';
        var oldstring = decoder.decode(new DataView(data.oldstring));
        var newstring = window.prompt(title, oldstring);
        if (newstring) {
            var encoder = new EucjpEncoder();
            var buf = encoder.encode(newstring.substr(0, data.maxlen));
            this.reply(data, buf || data.oldstring);
        } else {
            this.reply(data, data.oldstring);
        }
    }

    private inputNumber(data:{title:ArrayBuffer, max:number, min:number, default:number}) {
        var decoder = new TextDecoder('euc-jp');
        var title = decoder.decode(new DataView(data.title)) + ' [' + data.min + '-' + data.max + ']';
        var result = window.prompt(title, data.default + '');
        if (result)
            this.reply(data, parseInt(result));
        else
            this.reply(data, data.default)
    }
}

class ZoomManager {
    private zoomSelect:HTMLInputElement;
    private width:number;
    private height:number;
    private nonFullScreenRatio = 1;

    constructor() {
        var naclModule = $('#nacl_module');
        this.width = Number(naclModule.getAttribute('width'));
        this.height = Number(naclModule.getAttribute('height'));
        this.zoomSelect = <HTMLInputElement>$('#zoom');
        this.zoomSelect.addEventListener('change', this.handleZoom.bind(this));
        document.addEventListener('webkitfullscreenchange', this.onFullScreenChange.bind(this));

        if (navigator.userAgent.indexOf('Mac OS X') != -1) {
            // Fullscreen by select.onchange does not work on Chrome Mac
            var opt = $('#option-fullscreen');
            opt.parentElement.removeChild(opt);
        }
    }

    init() {
        show(this.zoomSelect);
        var ratio = localStorage.getItem('zoom');
        if (ratio != 'full' && Number(ratio) < 1 || Number(ratio) > 3)
            ratio = null;
        if (ratio && ratio != '1') {
            this.zoomSelect.value = String(ratio);
            this.handleZoom();
        }
    }

    setWindowSize(width:number, height:number) {
        this.width = width;
        this.height = height;
        this.handleZoom();
    }

    private onFullScreenChange() {
        if (!document.webkitFullscreenElement)
            this.zoomSelect.value = String(this.nonFullScreenRatio);
        this.handleZoom();
    }

    private handleZoom() {
        var naclModule = $('#nacl_module');
        var value = this.zoomSelect.value;
        localStorage.setItem('zoom', value);
        if (value == 'full') {
            if (!document.webkitFullscreenElement) {
                naclModule.webkitRequestFullScreen();
            } else {
                var ratio = Math.min(window.innerWidth / this.width, window.innerHeight / this.height);
                naclModule.setAttribute('width', String(this.width * ratio));
                naclModule.setAttribute('height', String(this.height * ratio));
            }
        } else {
            var ratio = Number(value);
            $('#contents').style.width = (this.width * ratio) + 'px';
            naclModule.setAttribute('width', String(this.width * ratio));
            naclModule.setAttribute('height', String(this.height * ratio));
            this.nonFullScreenRatio = ratio;
        }
    }
}

enum TouchState {Up, Down, Left, Right, Tap};

function setupTouchHandlers(element:HTMLElement) {
    var touchState = TouchState.Up;
    var touchTimer:number;

    element.addEventListener('touchstart', onTouchStart);
    element.addEventListener('touchmove', onTouchMove);
    element.addEventListener('touchend', onTouchEnd);

    function onTouchStart(event:TouchEvent) {
        if (event.touches.length != 1)
            return;
        event.preventDefault();
        var touch = event.touches[0];
        generateMouseEvent('mousemove', 0, touch);
        switch (touchState) {
        case TouchState.Tap:
            clearTimeout(touchTimer);
            // fallthrough
        case TouchState.Up:
            touchState = TouchState.Down;
            touchTimer = setTimeout(() => {
                generateMouseEvent('mousedown', 2, touch);
                touchState = TouchState.Right;
            }, 600);
            break;
        }
    }

    function onTouchMove(event:TouchEvent) {
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

    function onTouchEnd(event:TouchEvent) {
        if (event.changedTouches.length != 1)
            return;
        event.preventDefault();
        var touch = event.changedTouches[0];
        switch (touchState) {
        case TouchState.Down:
            clearTimeout(touchTimer);
            generateMouseEvent('mousedown', 0, touch);
            touchState = TouchState.Tap;
            touchTimer = setTimeout(() => {
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

    function generateMouseEvent(type:string, button:number, t:Touch) {
        var mouseEvent = document.createEvent('MouseEvents');
        mouseEvent.initMouseEvent(type, true, true, window, 0,
                                  t.screenX, t.screenY, t.clientX, t.clientY,
                                  false, false, false, false, button, null);
        element.dispatchEvent(mouseEvent);
    }
}

class VolumeControl {
    private vol: number;  // 0.0 - 1.0
    private muted: boolean;
    private elem: HTMLElement;
    private icon: HTMLElement;
    private slider: HTMLInputElement;

    constructor() {
        this.vol = Number(localStorage.getItem('volume') || 1);
        this.muted = false;

        this.elem = document.getElementById('volume-control');
        this.icon = document.getElementById('volume-control-icon');
        this.slider = <HTMLInputElement>document.getElementById('volume-control-slider');
        this.slider.value = Math.round(this.vol * 100) + '';

        this.icon.addEventListener('click', this.onIconClicked.bind(this));
        this.slider.addEventListener('input', this.onSliderValueChanged.bind(this));
        this.slider.addEventListener('change', this.onSliderValueSettled.bind(this));
    }

    init() {
        show(this.elem);
    }

    volume(): number {
        return this.muted ? 0 : parseInt(this.slider.value) / 100;
    }

    addEventListener(handler: (evt: CustomEvent) => any) {
        this.elem.addEventListener('volumechange', handler);
    }

    private onIconClicked(e: Event) {
        this.muted = !this.muted;
        if (this.muted) {
            this.icon.classList.remove('fa-volume-up');
            this.icon.classList.add('fa-volume-off');
            this.slider.value = '0';
        } else {
            this.icon.classList.remove('fa-volume-off');
            this.icon.classList.add('fa-volume-up');
            this.slider.value = String(Math.round(this.vol * 100));
        }
        this.dispatchEvent();
    }

    private onSliderValueChanged(e: Event) {
        this.vol = parseInt(this.slider.value) / 100;
        if (this.vol > 0 && this.muted) {
            this.muted = false;
            this.icon.classList.remove('fa-volume-off');
            this.icon.classList.add('fa-volume-up');
        }
        this.dispatchEvent();
    }

    private onSliderValueSettled(e: Event) {
        localStorage.setItem('volume', this.vol + '');
    }

    private dispatchEvent() {
        var event = new CustomEvent('volumechange', {detail: this.volume()});
        this.elem.dispatchEvent(event);
    }
}

class AudioPlayer {
    private elem:HTMLAudioElement;
    private currentTrack:number;
    private tracks:string[];

    constructor(private bgmDir:string, private volumeControl: VolumeControl) {
        this.tracks = JSON.parse(localStorage.getItem('tracks') || '[]');
        volumeControl.addEventListener(this.onVolumeChanged.bind(this));
    }

    play(track:number, loop:number) {
        if (this.elem)
          this.stop();

        var audio = document.createElement('audio');
        audio.setAttribute('src', this.trackURL(track));
        audio.volume = this.volumeControl.volume();
        audio.loop = (loop != 0);
        document.getElementById('contents').appendChild(audio);
        audio.load();
        audio.play();
        this.elem = audio;
        this.currentTrack = track;
    }

    stop() {
        if (this.elem) {
            this.elem.pause();
            this.elem.parentNode.removeChild(this.elem);
            this.elem = null;
            this.currentTrack = 0;
        }
    }

    getPosition(): number {
        if (!this.elem || this.elem.ended)
            return 0;

        var time = Math.round(this.elem.currentTime * 75);
        return this.currentTrack | time << 8;
    }

    private trackURL(n:number): string {
        return this.bgmDir + (this.tracks[n] || 'track' + n + '.wav');
    }

    private onVolumeChanged(evt: CustomEvent) {
        if (this.elem)
            this.elem.volume = evt.detail;
    }
}

class MidiPlayer {
    private worker: Worker;
    private iframe: HTMLIFrameElement;

    constructor(url: string, private volumeControl: VolumeControl) {
        this.worker = new Worker('js/midi-worker.js');
        this.iframe = document.createElement('iframe');
        this.worker.addEventListener('message', this.onMessageFromWorker.bind(this));
        window.addEventListener('message', this.onMessageFromIframe.bind(this));
        this.iframe.src = url;
        document.body.appendChild(this.iframe);

        volumeControl.addEventListener(this.onVolumeChanged.bind(this));
        this.worker.postMessage({command: 'volume', value: volumeControl.volume()});
    }

    play(buf:ArrayBuffer) {
        this.worker.postMessage({command:'play', smf:buf});
    }

    stop() {
        this.worker.postMessage({command:'stop'});
    }

    private onMessageFromWorker(evt: MessageEvent) {
        this.iframe.contentWindow.postMessage(evt.data, '*');
    }

    private onMessageFromIframe(evt: MessageEvent) {
        this.worker.postMessage(evt.data);
    }

    private onVolumeChanged(evt: CustomEvent) {
        this.worker.postMessage({command: 'volume', value: evt.detail});
    }
}

class EucjpEncoder {
    static table:any;

    constructor() {
        if (!EucjpEncoder.table)
            this.generateTable();
    }

    encode(s:string):ArrayBuffer {
        var bytes:number[] = [];
        for (var i = 0; i < s.length; i++) {
            var euc = EucjpEncoder.table[s.charAt(i)];
            if (euc) {
                bytes.push(euc >> 8);
                bytes.push(euc & 0xff);
            } else {
                return null;
            }
        }
        return new Uint8Array(bytes).buffer;
    }

    private generateTable() {
        EucjpEncoder.table = {};
        var decoder = new TextDecoder('euc-jp');
        var buf = new Uint8Array(2);
        for (var c1 = 0xa1; c1 <= 0xfc; c1++) {
            buf[0] = c1;
            for (var c2 = 0xa1; c2 <= 0xfe; c2++) {
                buf[1] = c2;
                var s = decoder.decode(buf);
                if (s.length == 1 && s != '\uFFFD')
                    EucjpEncoder.table[s] = (c1 << 8) | c2;
            }
        }
    }
}

var xsystem35 = new XSystem35;
