
(function() {
	var checkInterval = null,
		intervalLength = 5000;
	
	if (typeof(localStorage['interval_length']) != 'undefined') {
		intervalLength = localStorage['interval_length'];
	}
	
	var tempCurrentIcon = 'mspa_face.gif';
	var gotoMspa = function()
	{
		// does not currently go to mspa, instead changes button icon
		
		var currentIcon = tempCurrentIcon;
		switch (currentIcon) {
			case 'mspa_face.gif':
				tempCurrentIcon = 'mspa_reader.gif';
				break;
			case 'mspa_reader.gif':
				tempCurrentIcon = 'whatpumpkin.gif';
				break;
			case 'whatpumpkin.gif':
			default:
				tempCurrentIcon = 'mspa_face.gif';
				break;
		}
		
		chrome.browserAction.setIcon({path: tempCurrentIcon});
		
		return;
	};
	
	var checkForUpdates = function()
	{
		/* TODO:
		 *  check RSS
		 *  change icon
		 *  set count on button
		 */
	};
	
	checkInterval = setInterval(checkForUpdates, intervalLength);
	
	chrome.browserAction.onClicked.addListener(gotoMspa);
})();
