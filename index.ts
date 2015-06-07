isInstalled().then(function(installed) {
    if (installed)
        show($('.installed'));
    else
        show($('.notinstalled'));
}, function() {
    show($('.unsupported'));
});
