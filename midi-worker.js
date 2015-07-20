importScripts('lib/smfplayer.min.js');
var SMF;
(function (SMF) {
})(SMF || (SMF = {}));
var smfPlayer = new SMF.Player();
addEventListener('message', function (evt) {
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
smfPlayer.setMasterVolume(16383 * 0.3);
smfPlayer.setWebMidiLink(self);
