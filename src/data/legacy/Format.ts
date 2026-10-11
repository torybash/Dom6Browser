// @ts-nocheck
// Ported from larzm42/dom6inspector scripts/DMI/Format.js (GPLv3).
// Mechanical port: logic kept as close to upstream as possible; jQuery/DOM/SlickGrid removed.
import { $ } from './jq';
import { bitfields } from './bits';

export function install(DMI: any) {
//namespace children
var Format = DMI.Format = DMI.Format || {};
var GridFormat = DMI.GridFormat = DMI.GridFormat || {};


//path icons
Format.Paths = function(value) {
	if (!value) return '';
	return value.replace(/([A-W])/g, '<span class="pathicon Path_$1">$1</span>');
}
GridFormat.Paths = function(row, cell, value, columnDef, dataContext) {
	if (!value) return '';
	return value.replace(/([A-W])/g, '<span class="pathicon Path_$1">$1</span>');
}
Format.Booster = function(value) {
	if (!value) return '';
	return value.replace(/\d/,'+').replace(/([A-W])/g, '<span class="pathicon Path_$1">$1</span>');
}
GridFormat.Booster = function(row, cell, value, columnDef, dataContext) {
	if (!value || value =='0') return '';
	return value.replace(/\d/,'+').replace(/([A-W])/g, '<span class="pathicon Path_$1">$1</span>');
}
GridFormat.OrderedPaths = function(row, cell, value, columnDef, dataContext) {
	if (!value) return '';
	value = value.replace(/U\d*/, function(s){return DMI.Utils.rndMagicRef(Math.floor(dataContext.id), s);})
	// return value.replace(/([A-W])/g, '<img alt="$1" class="pathicon Path_$1" src="images/magicicons/Path_$1.png" />').slice(1);
	return value.replace(/([A-W])/g, '<span class="pathicon Path_$1">$1</span>').slice(1);
}


//gem icons
Format.Gems = function(value) {
	if (!value) return '';
	return value.replace(/([A-W])/g, '<span class="gemicon Gem_$1">$1</span>');
}
GridFormat.Gems = function(row, cell, value, columnDef, dataContext) {
	if (!value) return '';
	return value.replace(/([A-W])/g, '<span class="gemicon Gem_$1">$1</span>');
}
GridFormat.OrderedGems = function(row, cell, value, columnDef, dataContext) {
	if (!value) return '';
	value = value.replace(/U\d*/, function(s){return DMI.Utils.rndMagicRef(Math.floor(dataContext.id), s);})
	// return value.replace(/([A-W])/g, '<img alt="$1" class="pathicon Path_$1" src="images/magicicons/Path_$1.png" />').slice(1);
	return value.replace(/([A-W])/g, '<span class="gemicon Gem_$1">$1</span>').slice(1);
}

//render a named ability icon
Format.AbilityIcon = function(name, title) {
	return '<span class="abilityicon '+name+'" title="'+title+'">&nbsp;</span>';
}

//simple functions for formatting values
Format.Percent = function(v) {
	v = String(v);
	if (v=='0') return v;

	if (v.indexOf('%') == -1) {
		return v+ '%';
	}
	return v;
};
Format.Signed = function(v) {
	v = String(v);
	if (v=='0') return v;
	if (v.charAt(0)=='-') return v;
	return '+'+v;
};
Format.SignedZero = function(v) {
	v = String(v);
	if (v.charAt(0)=='-') return v;
	return '+'+v;
};
Format.SignedPercent = function(v) {
	v = String(v);
	if (v=='0') return v;
	if (v.charAt(0)=='-') return v+ '%';
	return '+' +v+ '%';
};
Format.SignedPercentDiv = function(v) {
	v = String(v);
	if (v=='0') return v;
	if (v.charAt(0)=='-') return parseInt(v)/100 + '%';
	return '+' +parseInt(v)/100+ '%';
};
Format.PerTurn = function(v) {
	v = String(v);
	if (v=='0') return v;
	return v+ ' per month';
};
Format.SignedPerTurn = function(v) {
	v = String(v);
	if (v=='0') return v;
	if (v.charAt(0)=='-') return v+ ' per month';
	return '+' +v+ ' per month';
};
Format.PerBattle = function(v) {
	v = String(v);
	if (v=='0') return v;
	return v+ ' per battle';
};

}
