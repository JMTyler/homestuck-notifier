
(function() {
	var checkInterval = null,
		intervalLength = 5000;
	
	if (typeof(localStorage['interval_length']) != 'undefined') {
		intervalLength = localStorage['interval_length'];
	}
	
	var checkForUpdates = function()
	{
		/* TODO:
		 *  check RSS
		 *  change icon
		 *  set count on button
		 */
	};
	
	checkInterval = setInterval(checkForUpdates, intervalLength);
})();
