interface PNaClElement extends HTMLElement {
    lastError: string;
    exitStatus: number;
    postMessage: (message:any)=>void;
}

class XSystem35 {
    private naclModule:PNaClElement;
    private audio:AudioPlayer;
    private naclWidth:number;
    private naclHeight:number;

    constructor() {
        isInstalled().then(this.init.bind(this),
            () => $('.unsupported').classList.remove('hidden'));
    }

    postMessage(message:any) {
        this.naclModule.postMessage(message);
    }

    private init(installed:boolean) {
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
        $('#zoom').addEventListener('change', this.handleZoom.bind(this));

        this.naclModule = <PNaClElement>$('#nacl_module');
        this.naclWidth = Number(this.naclModule.getAttribute('width'));
        this.naclHeight = Number(this.naclModule.getAttribute('height'));

        requestFileSystem().then(
            (fs) => this.audio = new AudioPlayer(fs.root.toURL()));
    }

    private moduleDidLoad() {
        this.updateStatus('　');
        this.initZoom();
    }

    private handleMessage(message:any) {
      var data = message.data;
      if (data.command == 'set_window_size') {
        this.setWindowSize(data.width, data.height);
      } else if (data.command == 'cd_play') {
        this.audio.play(data.track, data.loop);
      } else if (data.command == 'cd_stop') {
        this.audio.stop();
      } else if (data.command == 'cd_getposition') {
        this.reply(data, this.audio.getPosition());
      } else if (typeof data === 'string') {
        console.log(data);  // debug message
      } else {
        console.log('unknown message');
        console.log(message);
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

    private handleZoom() {
        var ratio = Number((<HTMLInputElement>$('#zoom')).value) / 100;
        $('#contents').style.width = (640 * ratio) + 'px';
        this.naclModule.setAttribute('width', String(this.naclWidth * ratio));
        this.naclModule.setAttribute('height', String(this.naclHeight * ratio));
        localStorage.setItem('zoom', String(ratio));
    }

    private initZoom() {
        var zoomElement:HTMLInputElement = <HTMLInputElement>$('#zoom');
        zoomElement.classList.remove('hidden');
        var ratio = Number(localStorage.getItem('zoom') || 1.0);
        if (ratio != 1.0) {
            zoomElement.value = String(ratio * 100);
            this.handleZoom();
        }
    }

    private setWindowSize(width:number, height:number) {
        this.naclWidth = width;
        this.naclHeight = height;
        this.handleZoom();
    }

    private reply(data:any, value:any) {
        var result = { 'result': value,
                       'naclmsg_id': data['naclmsg_id'] };
        this.postMessage({'naclmsg':result});
    }

    private updateStatus(status:string) {
        $('#contents .status').textContent = status;
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
