var $: (selector:string)=>HTMLElement = document.querySelector.bind(document);

function show(elem:HTMLElement) {
    elem.classList.remove('hidden');
}

function hide(elem:HTMLElement) {
    elem.classList.add('hidden');
}

function requestFileSystem(): Promise<FileSystem> {
    return new Promise(function(resolve, reject) {
        if (!window.webkitRequestFileSystem)
            reject();
        window.webkitRequestFileSystem(window.PERSISTENT, 0, resolve, () => resolve(false));
    });
}

function isInstalled(): Promise<boolean> {
    if (!navigator.mimeTypes['application/x-pnacl'] || !window.fetch)
        return <Promise<any>>(Promise.reject('not supported'));
    return requestFileSystem().then(function(fs) {
        return new Promise(function(resolve) {
            fs.root.getDirectory('save', {}, () => resolve(true), () => resolve(false));
        });
    });
}
