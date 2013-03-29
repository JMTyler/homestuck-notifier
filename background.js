
(function() {
	var checkInterval = null,
		intervalLength = 5000;
	
	if (typeof(localStorage['interval_length']) != 'undefined') {
		intervalLength = localStorage['interval_length'];
	}
	
	var tempCurrentIcon = 'mspa_face.gif';
	var gotoMspa = function()
	{
		// TODO: does not currently go to mspa, instead changes button icon
		
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
		
		// TODO: testing rss reading, this should be moved into the interval checker
		var lastPageRead = null;
		if (typeof(localStorage['last_page_read']) != 'undefined') {
			lastPageRead = localStorage['last_page_read'];
		}
		
		var checkRssFeed = function()
		{
			var feedUri = "http://mspaintadventures.com/rss/rss.xml",
				request = new XMLHttpRequest();
			
			request.onload = function()
			{
				var xml = request.responseXML;
				if (!xml) {
					console.log('invalid rss feed received.');
					return;
				}
				
				var pages = xml.getElementsByTagName('item');
				var count = Math.min(pages.length, 40);
				var item, guid;
				var unreadPagesCount = 0;
				for (var i = 0; i < count; i += 1) {
					item = pages.item(i);
					
					guid = item.getElementsByTagName('guid')[0];
					if (guid) {
						guid = guid.textContent;
					}
					
					if (guid == lastPageRead) {
						break;
					}
					
					unreadPagesCount++;
				}
				
				var unreadPagesText = unreadPagesCount + '';
				if (unreadPagesCount == 40) {
					unreadPagesText += '+';
				}
				
				chrome.browserAction.setBadgeBackgroundColor({color: '#00AA00'});
				chrome.browserAction.setBadgeText({text: unreadPagesText});
			};
			
			request.onerror = function()
			{
				console.log('something went wrong, brotha.')
				return;
			};
			
			request.open('GET', feedUri, true);
			request.send(null);
			
			return;
		};
		
		chrome.browserAction.getBadgeText({}, function(result) {
			if (result != '') {
				chrome.browserAction.setBadgeText({text: ''});
			} else {
				checkRssFeed();
			}
		});
		
		chrome.tabs.create({url: lastPageRead});
		
		return;
	};
	
	var checkForUpdates = function()
	{
		var lastPageRead = null;
		if (typeof(localStorage['last_page_read']) != 'undefined') {
			lastPageRead = localStorage['last_page_read'];
		}
		
		/* TODO:
		 *  check RSS
		 *  change icon
		 *  set count on button
		 */
	};
	
	checkInterval = setInterval(checkForUpdates, intervalLength);
	
	chrome.browserAction.onClicked.addListener(gotoMspa);
})();
