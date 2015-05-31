var $: (selector:string)=>Element = document.querySelector.bind(document);

function isInstalled(): Promise<boolean> {
    return new Promise(function(resolve, reject) {
        if (!window.webkitRequestFileSystem)
            reject();
        window.webkitRequestFileSystem(window.PERSISTENT, 0,
            (fs) => fs.root.getDirectory('save', {}, () => resolve(true), () => resolve(false)),
            () => resolve(false))
    });
}
