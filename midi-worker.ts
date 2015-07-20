declare var self: WorkerGlobalScope;
importScripts('lib/smfplayer.min.js');

namespace SMF {
    export declare class Player {
        setLoop(loop:boolean): void;
        setMasterVolume(volume:number): void;
        setWebMidiLink(worker:any): void;
        loadMidiFile(smf:Uint8Array): void;
        play(): void;
        stop(): void;
    }
}

var smfPlayer = new SMF.Player();

addEventListener('message', function(evt: MessageEvent) {
    switch (evt.data.command) {
    case 'play':
        smfPlayer.loadMidiFile(new Uint8Array(evt.data.smf));
        smfPlayer.play();
        break;
    case 'stop':
        smfPlayer.stop();
        break;
    }
});

smfPlayer.setLoop(true);
smfPlayer.setMasterVolume(16383 * 0.3);  // TODO: add volume controller
smfPlayer.setWebMidiLink(self);
