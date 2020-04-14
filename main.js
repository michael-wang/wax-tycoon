// https://waxtycoon.io/
//
// Before run this script, manually load jquery, by pasting code to console:
//	var jqry = document.createElement('script');
//	jqry.src = "https://code.jquery.com/jquery-3.4.1.min.js";
//	document.getElementsByTagName('head')[0].appendChild(jqry);
// Press enter, wait for 2 seconds, past another code:
//  jQuery.noConflict();
// Press enter, then we can use $$ in code.

var DEBUG = false;

function parse_money(str) {
	if (DEBUG) { console.log('parse_money str:', str); }
	const value_str = str.replace(/,| |M|B|T|Q/g, '');
	if (DEBUG) { console.log('parse_money value_str:', value_str); }
	const value_in_unit = parseFloat(value_str);
	if (DEBUG) { console.log('parse_money value_in_unit:', value_in_unit); }
	if (isNaN(value_in_unit)) {
		console.error("parse_money failed to get:", str);
		return NaN;
	}

	const last_char = str.slice(-1);
	if (DEBUG) { console.log('parse_money last_char:', last_char); }
	const multiplier = unit_multiplier(last_char);
	if (DEBUG) { console.log('parse_money multiplier:', multiplier); }

	const value = value_in_unit * multiplier;
	if (DEBUG) { console.log('parse_money:', value.toFixed(2)); }
	return value;
}

function unit_multiplier(unit) {
	switch (unit) {
		case 'M':
			return 10**6;
		case 'B':
			return 10**9;
		case 'T':
			return 10**12;
		case 'Q':
			return 10**15;
		default:
			return 1;
	}
}

// str: '1.23 sec'
function parse_time(str) {
	if (DEBUG) { console.log('parse_time str:', str); }
	const value_str = str.slice(0, str.lastIndexOf(' '));
	if (DEBUG) { console.log('parse_time value_str:', value_str); }
	const value_in_unit = parseFloat(value_str);
	if (DEBUG) { console.log('parse_time value_in_unit:', value_in_unit); }

	const unit_str = str.slice(str.lastIndexOf(' ') + 1);
	if (DEBUG) { console.log('parse_time unit_str:', unit_str); }
	const multiplier = time_multiplier(unit_str);
	if (DEBUG) { console.log('parse_time multiplier:', multiplier); }

	return value_in_unit * multiplier;
}

function time_multiplier(unit) {
	switch (unit) {
		case 'sec':
			return 1;
		case 'min':
			return 60;
		case 'hr':
			return 3600;
		default:
			return 1;
	}
}

// .company
//   .information
//   	.name
//   	.info
//   		.primary
//   			.animated-number [production]
//   		<small> [duration]
//   .actions
//   	.action
//   		.animated-number [cost]
//   		.detailed [duration-reduction]
function parse_companies() {
	var companies = [];
	$$('.box-list > .company').forEach(function(c, i) {
		// drop locked.
		if (c.querySelector('.disabled')) { return; }

		var company = {};
		company['name'] = c.querySelector('.information > .name').innerText;
		var info = c.querySelector('.information > .info');
		const prod = parse_money(info.querySelector('.info > .primary > .animated-number').innerText);
		company['prod'] = prod;
		const duration = parse_time(info.querySelector('small').innerText.replace(/^\/ /g, ''));
		company['duration'] = duration;

		const upgrade1 = c.querySelector('.actions > .action');
		company['up_duration'] = {
			cost: parse_money(upgrade1.querySelector('.animated-number').innerText),
			new_duration: duration + parse_time(upgrade1.querySelector('button[tooltip="Upgrade Speed"]').innerText)
		};

		const upgrade2 = upgrade1.nextElementSibling;
		company['upgrade_prod'] = {
			cost: parse_money(upgrade2.querySelector('.animated-number').innerText),
			new_prod: prod + (parse_money(upgrade2.querySelector('button[tooltip="Upgrade Production"]').innerText))
		};

		if (DEBUG) { console.log('company:', company); }
		companies.push(company);
	});
	if (DEBUG) { console.log('companies:', companies); }
	if (companies.length == 0) {
		alert('please unlock at least one company.');
	}
	return companies;
}

function evaluate_upgrades(balance, income, companies) {
	var upgrades = [];
	companies.forEach(function(cmp, idx) {
		const prod_per_sec = cmp.prod / cmp.duration;

		const up1 = cmp.up_duration;
		var prod_delta = (cmp.prod / up1.new_duration - prod_per_sec);
		var shortage = (up1.cost > balance) ? (up1.cost - balance) : 0;
		upgrades.push({
			cmp: cmp.name,
			name: 'Duration (Left side)',
			cost: up1.cost,
			prod_delta: prod_delta,
			eta: (shortage > 0) ? (shortage / income) : 0
		});

		const up2 = cmp.upgrade_prod;
		prod_delta = up2.new_prod / cmp.duration - prod_per_sec;
		var shortage = (up2.cost > balance) ? (up2.cost - balance) : 0;
		upgrades.push({
			cmp: cmp.name,
			name: 'Production (Right side)',
			cost: up2.cost,
			prod_delta: prod_delta,
			eta: (shortage > 0) ? (shortage / income) : 0
		});
	});
	if (DEBUG) { console.log(upgrades); }
	return upgrades;
}

function upgrades_sorter(a, b) {
	if (b.prod_delta == a.prod_delta) {
		return (a.cost - b.cost);
	}
	return (b.prod_delta - a.prod_delta);
}

function print_upgrade(prefix, up) {
	console.log("%s [prod_delta: %d] %s => %s %s", prefix, up.prod_delta, up.cmp, up.name, format_eta(up.eta));
}

function format_eta(eta) {
	if (eta == 0) { return ''; }
	const now = new Date();
	const done = new Date(now.getTime() + eta * 1000);
	return (' [Ready @ ' + done.getHours() + ':' + done.getMinutes() + ' (' + Math.ceil(eta) + ' sec)]');
}

function main() {
	const income = parse_money($$('#income .animated-number')[0].innerText);
	if (isNaN(income)) {
		return;
	}

	const balance = parse_money($$('.balance .animated-number')[0].innerText);
	if (isNaN(balance)) {
		return;
	}

	const companies = parse_companies();
	if (companies.length == 0) {
		return;
	}

	const upgrades = evaluate_upgrades(balance, income, companies);
	if (upgrades.length == 0) {
		console.warn('No upgrade available.');
		return;
	}

	upgrades.sort(upgrades_sorter);
	const best = upgrades[0];
	if (best) {
		print_upgrade('Best upgrade: ', best);
	}

	if (upgrades.length > 1) {
		const second = upgrades[1];
		print_upgrade('2nd  upgrade: ', second);
	}
}

main();
