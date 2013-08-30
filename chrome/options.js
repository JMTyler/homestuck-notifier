
$(function() {
	var options = {
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
	
	var areNotificationsOn = true;
	if (typeof(localStorage['notifications_on']) != 'undefined') {
		areNotificationsOn = JSON.parse(localStorage['notifications_on']);
	}
	
	if (areNotificationsOn) {
		$('#radToastOn').prop('checked', true);
	} else {
		$('#radToastOff').prop('checked', true);
	}
	
	$('#radToast').buttonset();
	
	var doShowPageCount = true;
	if (typeof(localStorage['show_page_count']) != 'undefined') {
		doShowPageCount = JSON.parse(localStorage['show_page_count']);
	}
	
	if (doShowPageCount) {
		$('#radShowCountOn').prop('checked', true);
	} else {
		$('#radShowCountOff').prop('checked', true);
	}
	
	$('#radShowCount').buttonset();
	
	var checkFrequency = 3;
	if (typeof(localStorage['check_frequency']) != 'undefined') {
		checkFrequency = localStorage['check_frequency'];
	}
	
	$('#sldFrequency').slider({
		range: 'min',
		value: checkFrequency,
		min: 1,
		max: 10,
		slide: function(event, ui) {
			$('#lblFrequency').text("every " + options[ui.value].readable);
		}
	});
	$('#lblFrequency').text("every " + options[$('#sldFrequency').slider('value')].readable);
	
	$('#btnSave').button();
	$('#btnSave').on('click', function() {
		var areNotificationsOn = $('#radToast :radio:checked').val() == 'on',
			doShowPageCount    = $('#radShowCount :radio:checked').val() == 'on',
			checkFrequency     = $('#sldFrequency').slider('value');
		
		localStorage['notifications_on'] = areNotificationsOn;
		localStorage['show_page_count']  = doShowPageCount;
		localStorage['check_frequency']  = checkFrequency;
	});
});
