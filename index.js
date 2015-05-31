isInstalled().then(function (installed) {
    if (installed)
        $('.installed').classList.remove('hidden');
    else
        $('.notinstalled').classList.remove('hidden');
}, function () {
    $('.unsupported').classList.remove('hidden');
});
