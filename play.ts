interface PNaClElement extends Element {
    lastError: string;
    exitStatus: number;
    postMessage: (message:any)=>void;
}

class XSystem35 {
    private naclModule:PNaClElement;
    private audio:AudioPlayer;

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
        this.naclModule = <PNaClElement>$('#nacl_module');

        window.webkitRequestFileSystem(window.PERSISTENT, 0,
            (fs) => this.audio = new AudioPlayer(fs.root.toURL()));
    }

    private moduleDidLoad() {
        this.updateStatus('　');
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

    private setWindowSize(width:number, height:number) {
        this.naclModule.setAttribute('width', width + '');
        this.naclModule.setAttribute('height', height + '');
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
        this.volume = 1;
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
