// @ts-nocheck
// Ported from larzm42/dom6inspector scripts/DMI/CGrid.js (GPLv3).
// Only the data-side pieces of the SlickGrid base class survive: property matching,
// the common search filter, custom js filter and the chained sort comparator.
import { $ } from './jq';

export function install(DMI: any) {

//shared filter for pages that only have a text search + property filters
DMI.basicSearchFilter = function(o, args) {
	//type in id to ignore filters
	if (args.str && args.str == String(o.id)) return true;

	//search string
	if (args.str && o.searchable.indexOf(args.str) == -1)
		return false;

	if (!DMI.propertySearchFilter(o, args)) return false;
	return DMI.customSearchFilter(o, args);
}

//property filters (each is comprised of key =~ val)
DMI.propertySearchFilter = function(o, args) {
	if (args.properties && args.properties.length) {
		//need to finalise stats now..
		DMI.MUnit.prepareForRender(o);
		for (var i = 0; i < args.properties.length; i++){
			var prop = args.properties[i];
			var r =  o.matchProperty(o, prop.key, prop.comp, prop.val);
			if (prop.not  ?  r  :  !r)
				return false;
		}
	}
	return true;
}

DMI.customSearchFilter = function(o, args) {
	if (args.customjs) {
		var res = DMI.customFilter(o, args.customjs);
		if (res == '#ERROR#')
			args.customjs = null;
		else if (!res)
			return false;
	}
	return true;
}

//converts property filter rows {key, not, comp, val} into matcher args (upstream getPropertyMatchArgs)
DMI.buildPropertyArgs = function(rows) {
	var args = [];
	(rows || []).forEach(function(row){
		var arg = {
			key: (row.key || '').toLowerCase().trim(),
			not: row.not ? 1 : 0,
			comp: row.comp || '=~',
			val: row.val == null ? '' : String(row.val)
		};
		if (!arg.key) return;
		var compstr = arg.comp;
		arg.comp = function(v,c){ return v; };

		switch (compstr) {
			case '=~':
				if (arg.val && arg.val!='.') {
					arg.comp = function(v,c){ return String(v).match(c); };
					try{
						arg.val = new RegExp(arg.val || '.', 'i');
					}catch(e){ arg.val = /./; }
				}
				break;

			case '==':
				arg.comp = function(v,c){ return v == c; };
				break;

			case '<=':
				if (arg.val = parseInt(arg.val))
					arg.comp = function(v,c){ return parseInt(v) <= c; };
				break;

			case '>=':
				if (arg.val = parseInt(arg.val))
					arg.comp = function(v,c){ return  parseInt(v) >= c; };
				break;
		}
		args.push(arg);
	});
	return args;
}

//match property name to regexp (also matches child ids)
DMI.matchProperty = function(o, key, comparitor, match) {
	var val = o[key];
	if (!val) {
		key = DMI.propertyAliases[key];
		val = o[key];

		if (!val)
			return;
	}
	if (typeof(val) == 'string' || typeof(val) == 'number') {
		if (comparitor(val, match)) return true;
	}
	else if ($.isArray(val)) {
		if(key === 'randompaths' && val.length){
			var foundPath = false;
			val.forEach(function(v){
				if (comparitor(v.paths, match)){
					foundPath=true;
				};
			});
			if(foundPath) return true;
		}
		for (var o, i=0; o=val[i]; i++) {
			if (o && comparitor(o, match)) return true;
			if (o.id && comparitor(o.id, match)) return true;
			if (o.name && comparitor(o.name, match)) return true;
		}
	}
	else if (typeof(val) == 'object') {
		var o = val;
		if (o.id && comparitor(o.id, match)) return true;
		if (o.name && comparitor(o.name, match)) return true;
	}

	return false;
}

DMI.customJsError = '';
DMI.customFilter = function(o, customjs) {
	try {
		var fn = DMI._customFnCache && DMI._customFnCache.src == customjs ? DMI._customFnCache.fn : null;
		if (!fn) {
			//eval keeps upstream semantics (statements allowed, last expression is the result)
			fn = new Function('o', 'num', 'return eval(' + JSON.stringify(customjs) + ');');
			DMI._customFnCache = { src: customjs, fn: fn };
		}
		var num = function(v){ return parseFloat(v) ? parseFloat(v) : 0; };
		DMI.customJsError = '';
		return fn(o, num);
	}
	catch(e) {
		DMI.customJsError = String(e);
		return '#ERROR#';
	}
}

//chained comparator: ties fall back to the previous sort (upstream grid.onSort)
DMI.makeSortCmp = function(column, asc, prevSortCmp) {
	var field = column.field;
	var defaultVal = column.sortCmp == 'text'?'':0;
	var numeric = column.sortCmp == 'num';
	var sign = asc ? 1 : -1;
	//new in this app: columns may compute their sort key (e.g. events read o.ev)
	var get = column.sortValue || function(o){ return o[field]; };
	return function (dataRow1, dataRow2) {
		var value1 = (get(dataRow1) || defaultVal), value2 = (get(dataRow2) || defaultVal);
		if (numeric) {
			//numeric columns: values may be strings ("40", "5F") or carry suffixes
			value1 = parseFloat(value1) || 0;
			value2 = parseFloat(value2) || 0;
		}

		//if equal then sort in previous scope (recurring)
		if (value1 == value2 && prevSortCmp)
			return prevSortCmp(dataRow1, dataRow2);

		return (value1 == value2 ? 0 : (value1 > value2 ? 1 : -1)) * sign;
	};
}

}
