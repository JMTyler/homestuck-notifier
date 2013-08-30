
(function() {
	var isDebugMode = false,
		checkInterval = null,
		intervalLength = 300000;  // defaults to 5 minutes
	
	var frequencyOptions = {
		1:  {
			seconds: 60,
			readable: "1 minute"
		},
		2:  {
			seconds: 120,
			readable: "2 minutes"
		},
		3:  {
			seconds: 300,
			readable: "5 minutes"
		},
		4:  {
			seconds: 600,
			readable: "10 minutes"
		},
		5:  {
			seconds: 1800,
			readable: "30 minutes"
		},
		6:  {
			seconds: 3600,
			readable: "1 hour"
		},
		7:  {
			seconds: 7200,
			readable: "2 hours"
		},
		8:  {
			seconds: 18000,
			readable: "5 hours"
		},
		9:  {
			seconds: 43200,
			readable: "12 hours"
		},
		10: {
			seconds: 86400,
			readable: "24 hours"
		}
	};
	
	var icons = {
		idle: 'mspa_face.gif',
		error: 'mspa_reader.gif',
		updates: 'whatpumpkin.gif'
	};
	
	if (typeof(localStorage['check_frequency']) != 'undefined') {
		intervalLength = frequencyOptions[localStorage['check_frequency']].seconds * 1000;
	}
	
	/**
	 * Set button icon as idle, open a new tab with the last page read,
	 * and set the new 'last page read' as the latest update available.
	 */
	var _gotoMspa = function()
	{
		var lastPageRead = "http://mspaintadventures.com";
		if (typeof(localStorage['last_page_read']) != 'undefined') {
			lastPageRead = localStorage['last_page_read'];
		}
		
		var latestUpdate = false;
		if (typeof(localStorage['latest_update']) != 'undefined') {
			latestUpdate = localStorage['latest_update'];
		}
		
		chrome.browserAction.setIcon({path: icons.idle});
		chrome.browserAction.setBadgeText({text: ''});
		chrome.tabs.create({url: lastPageRead});
		
		if (latestUpdate) {
			localStorage['last_page_read'] = latestUpdate;
			delete localStorage['latest_update'];
		}
		
		return;
	};
	
	/**
	 * Queries the MSPA RSS feed.  Changes the button icon if there is an error
	 * or if there are new updates available.  If there are updates, adds a count
	 * onto the button.
	 */
	var _checkForUpdates = function()
	{
		var newIntervalLength = 300000;
		if (typeof(localStorage['check_frequency']) != 'undefined') {
			newIntervalLength = frequencyOptions[localStorage['check_frequency']].seconds * 1000;
		}
		
		// Interval length setting has been changed, so reset the interval.
		if (newIntervalLength != intervalLength) {
			intervalLength = newIntervalLength;
			if (checkInterval != null) {
				clearInterval(checkInterval);
			}
			checkInterval = setInterval(_checkForUpdates, intervalLength);
		}
		
		var lastPageRead = null;
		if (typeof(localStorage['last_page_read']) != 'undefined') {
			lastPageRead = localStorage['last_page_read'];
		}
		
		var latestUpdate = null;
		if (typeof(localStorage['latest_update']) != 'undefined') {
			latestUpdate = localStorage['latest_update'];
		}
		
		var areNotificationsOn = true;
		if (typeof(localStorage['notifications_on']) != 'undefined') {
			areNotificationsOn = JSON.parse(localStorage['notifications_on']);
		}
		
		var doShowPageCount = true;
		if (typeof(localStorage['show_page_count']) != 'undefined') {
			doShowPageCount = JSON.parse(localStorage['show_page_count']);
		}
		
		var feedUri = "http://mspaintadventures.com/rss/rss.xml",
			request = new XMLHttpRequest();
		
		request.onload = function()
		{
			var xml = request.responseXML;
			if (!xml) {
				console.log('invalid rss feed received.');
				chrome.browserAction.setIcon({path: icons.error});
				return;
			}
			
			var pages = xml.getElementsByTagName('item');
			var count = Math.min(pages.length, 40);
			var item, guid, newLatestUpdate = null;
			var unreadPagesCount = 0;
			for (var i = 0; i < count; i += 1) {
				item = pages.item(i);
				
				guid = item.getElementsByTagName('guid')[0];
				if (guid) {
					guid = guid.textContent;
				}
				
				if (lastPageRead == null) {
					lastPageRead = guid;
					localStorage['last_page_read'] = guid;
				}
				
				if (guid == lastPageRead) {
					break;
				}
				
				if (newLatestUpdate == null) {
					newLatestUpdate = guid;
				}
				
				unreadPagesCount++;
			}
			
			if (unreadPagesCount < 1) {
				chrome.browserAction.setIcon({path: icons.idle});
				return;
			}
			
			// No need to pop up the notification more than once for the same update!
			if (newLatestUpdate == latestUpdate) {
				return;
			}
			
			var unreadPagesText = unreadPagesCount + (unreadPagesCount == 40 ? '+' : '');
			
			// Update button for new updates.
			localStorage['latest_update'] = newLatestUpdate;
			chrome.browserAction.setIcon({path: icons.updates});
			if (doShowPageCount) {
				chrome.browserAction.setBadgeBackgroundColor({color: '#00AA00'});
				chrome.browserAction.setBadgeText({text: unreadPagesText});
			}
			
			if (areNotificationsOn) {
				// Show notification for new updates.
				var notification = window.webkitNotifications.createNotification(
					'48.png',
					"New MSPA Update!",
					"Click here to start reading!" + (doShowPageCount ? ("\n" + unreadPagesText + " pages") : "")
				);
				notification.onclick = function()
				{
					this.close();
					_gotoMspa();
					return;
				};
				notification.show();
				setTimeout(function() {
					notification.close();
				}, 10000);
			}
			
			return;
		};
		
		request.onerror = function()
		{
			console.log('something went wrong, brotha.')
			chrome.browserAction.setIcon({path: icons.error});
			return;
		};
		
		request.open('GET', feedUri, true);
		request.send(null);
		
		return;
	};
	
	var _clearData = function()
	{
		chrome.browserAction.setIcon({path: icons.idle});
		chrome.browserAction.setBadgeText({text: ''});
		delete localStorage['last_page_read'];
		delete localStorage['latest_update'];
		delete localStorage['notifications_on'];
		delete localStorage['show_page_count'];
		delete localStorage['check_frequency'];
	};
	
	if (isDebugMode) {
		window.gotoMspa = function(){ _gotoMspa(); };
		window.checkForUpdates = function(){ _checkForUpdate(); };
		window.clearData = function(){ _clearData(); };
	}
	
	_checkForUpdates();
	checkInterval = setInterval(_checkForUpdates, intervalLength);
	chrome.browserAction.onClicked.addListener(_gotoMspa);
})();
