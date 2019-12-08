isInstalled().then(function(installed:boolean) {
    if (installed)
        show($('.installed'));
    else
        show($('.notinstalled'));
}, function() {
    show($('.unsupported'));
});
