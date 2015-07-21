interface PNaClElement extends HTMLElement {
    lastError: string;
    exitStatus: number;
    postMessage: (message:any)=>void;
}

class XSystem35 {
    private naclModule:PNaClElement;
    private audio:AudioPlayer;
    private zoom:ZoomManager;

    constructor() {
        isInstalled().then(this.init.bind(this), () => show($('.unsupported')));

        this.naclModule = <PNaClElement>$('#nacl_module');
        this.zoom = new ZoomManager();

        var naclArgs:string[] = [];
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
        listener.addEventListener('load', this.moduleDidLoad.bind(this), true);
        listener.addEventListener('message', this.handleMessage.bind(this), true);
        listener.addEventListener('error', this.handleError.bind(this), true);
        listener.addEventListener('crash', this.handleCrash.bind(this), true);
        setupTouchHandlers(this.naclModule);

        requestFileSystem().then(
            (fs) => this.audio = new AudioPlayer(fs.root.toURL()));
    }

    private moduleDidLoad() {
        this.updateStatus('　');
        this.zoom.init();
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

    private setCaption(buf:ArrayBuffer) {
        var decoder = new TextDecoder('euc-jp');
        var s = decoder.decode(new DataView(buf));
        $('title').textContent = s.slice(s.indexOf(':')+1) + ' - 鬼畜王 on Chrome';
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

class AudioPlayer {
    private elem:HTMLAudioElement;
    private currentTrack:number;
    private volume:number;
    private muted:boolean;

    constructor(private bgmDir:string) {
        this.volume = Number(localStorage.getItem('volume') || 1);
        this.muted = false;
    }

    play(track:number, loop:number) {
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
    }

    stop() {
        if (this.elem) {
            this.elem.pause();
            this.volume = this.elem.volume;
            this.muted = this.elem.muted;
            this.elem.parentNode.removeChild(this.elem);
            this.elem = null;
            this.currentTrack = 0;
            localStorage.setItem('volume', this.volume + '');
        }
    }

    getPosition(): number {
        if (!this.elem || this.elem.ended)
            return 0;

        var time = Math.round(this.elem.currentTime * 75);
        return this.currentTrack | time << 8;
    }
}

var xsystem35 = new XSystem35;
