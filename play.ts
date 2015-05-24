var $: (selector:string)=>Element = document.querySelector.bind(document);

interface PNaClElement extends Element {
    lastError: string;
    exitStatus: number;
    postMessage: (message:any)=>void;
}

class XSystem35 {
    private naclModule:PNaClElement;

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
        listener.addEventListener('message', (<any>window).handleMessage, true);
        listener.addEventListener('error', this.handleError.bind(this), true);
        listener.addEventListener('crash', this.handleCrash.bind(this), true);
        this.naclModule = <PNaClElement>$('#nacl_module');
    }

    private moduleDidLoad() {
        this.updateStatus('　');
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

    private updateStatus(status:string) {
        $('#contents .status').textContent = status;
    }
}

var xsystem35 = new XSystem35;
