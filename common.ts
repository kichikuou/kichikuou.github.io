var $: (selector:string)=>HTMLElement = document.querySelector.bind(document);

function requestFileSystem(): Promise<FileSystem> {
    return new Promise(function(resolve, reject) {
        if (!window.webkitRequestFileSystem)
            reject();
        window.webkitRequestFileSystem(window.PERSISTENT, 0, resolve, () => resolve(false));
    });
}

function isInstalled(): Promise<boolean> {
    return requestFileSystem().then(function(fs) {
        return new Promise(function(resolve) {
            fs.root.getDirectory('save', {}, () => resolve(true), () => resolve(false));
        });
    });
}
