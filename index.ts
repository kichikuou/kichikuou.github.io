isInstalled().then(function(installed) {
    if (installed)
        show($('.installed'));
    else
        show($('.notinstalled'));
}, function() {
    show($('.unsupported'));
});

$('#expand-history').addEventListener('click', expandHistory);
$('#collapse-history').addEventListener('click', collapseHistory);

function expandHistory(event:Event) {
    event.preventDefault();
    hide($('#history-collapsed'));
    show($('#history-expanded'));
}

function collapseHistory(event:Event) {
    event.preventDefault();
    show($('#history-collapsed'));
    hide($('#history-expanded'));
}
