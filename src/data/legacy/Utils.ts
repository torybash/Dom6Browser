// @ts-nocheck
// Ported from larzm42/dom6inspector scripts/DMI/Utils.js (GPLv3).
// Mechanical port: logic kept as close to upstream as possible; jQuery/DOM/SlickGrid removed.
import { $ } from './jq';
import { bitfields } from './bits';

export function install(DMI: any) {
// upstream relied on sloppy-mode implicit globals; declared here (shared, like globals) for strict mode
var k, v;
var Utils = DMI.Utils = DMI.Utils || {};
var Options = DMI.Options = DMI.Options || {};

Options['Show database keys'] = 0;
Options['Show ids'] = 0;
Options['Show popup refs'] = 1;
Options['Show internal keys'] = 1;
Options['Show descriptions'] = 1;

//loaded from query string
Options['Show mod cmds'] = null;
//loaded from query string
Options['Load events'] = null;

Options['Select mod columns'] = 4;


Utils.wikiLink = function(name, subname, cssclass) {
	if (subname)
		name += '_(' + subname + ')'

	name = (name || '').replace(/ /g, '_');

	var url = "http://dom3.servegame.com/wiki/"+name
	var linktext = '[wiki]';
	var cssclass = cssclass ? ' class="'+cssclass+'"' : '';
	var title = "..wiki/"+name;

	return '<a href="'+url+'" title="'+title+'"'+cssclass+'>'+linktext+'</a>';
}
//strips non basic-alphanumeric chars (including spaces)
Utils.descrFilename = function(name) {
	return name.replace(/[^a-zA-Z1-9]/g,'')+'.txt';
}

//display error on page
Utils.error = function(msg) {
	DMI.errors.push(String(msg));
	return msg;
}
Utils.clearErrors = function() {
	DMI.errors.length = 0;
}

//array utils
Utils.inArray = function(val, arr) {
	for (var i=0; i<arr.length; i++) {
		if (arr[i] == val) return true;
	}
	return false;
}
Utils.joinArray = function(val, arr) {
	for (var i=0; i<arr.length; i++) {
		if (arr[i] == val) return;
	}
	arr.push(val);
}

Utils.weedArray = function(weed, arr) {
	for (var i=arr.length-1; i>=0; i--) {
		if (arr[i] == weed) arr.splice(i,1);
	}
}

Utils.arrayDisect = function(arr, disectwith) {
	for (var weed, di=0; weed=disectwith[di]; di++) {
		for (var i=arr.length-1; i>=0; i--) {
			if (arr[i] == weed) arr.splice(i,1);
		}
	}
}
Utils.arrayIntersect = function(arr, intersectwith) {
	outerloop:
	for (var gem, di=0; gem=intersectwith[di]; di++) {
		for (var i=arr.length-1; i>=0; i--) {
			if (arr[i] == gem) continue outerloop;
		}
		arr.splice(i,1)
	}
}
Utils.arrayUnique = function(arr) {
	for (var i=arr.length-1; i>=1; i--) {
		var arri = arr[i];
		for (var j=i-1; j>=0; j--) {
			if (arr[j] == arri) {
				arr.splice(j,1)
				i--;
			}
		}
	}
}
Utils.objectKeys = function(obj) {
	var t = [];
	for (var k in obj)	t.push(k);
	return t;
}

//splits string to object keys
Utils.splitToLookup = function(str, delimiter) {
	var lookup = {};
	var arr = str.split(delimiter);
	for (var i=0; i<arr.length; i++) {
		if (arr[i]) lookup[arr[i]] = true;
	}
	return lookup;
}




Utils.paddedNum = function(v, len) {
	var str = '0000000000'+parseInt(v);
	return 	str.slice(str.length-len);
}
//converts numerically listed keys to array [parent.basekey1, parent.basekey2, parent.basekey3]
//if maxnum is provided then it skips null values.. otherwise it quits on first null
Utils.keyListToTable = function(parent, basekey, maxnum) {
	var t = [], v;
	for (var i=1; (i<=maxnum) || !maxnum; i++) {
		if (v=parent[basekey+i]) {
			t.push( v );
			delete parent[basekey+i];
		}
		else if (!maxnum) break;
	}
	return t;
}

//merges values from one object onto another
Utils.merge = function(o, vals) {
	for (k in vals) o[k] = vals[k];
	return o;
}

// Utils.sum = function() {
// 	var nt=0;
// 	for (var i=0; i<arguments.length; i++)
// 		nt += parseFloat(arguments[i] || '0');
// 	return String(nt);
// }
Utils.sum = function(n1,n2,_) {
	if (_) throw('too many sum args');
	return String(parseFloat(n1 || '0') + parseFloat(n2 || '0'));
}
Utils.negative = function(v) {
	return String(- parseFloat(v || '0'));
}
Utils.mult = function(n1,n2,_) {
	if (_) throw('too many mult args');
	return String(parseFloat(n1 || '1') * parseFloat(n2 || '1'));
}
Utils.normalise = function(v) {
	if (parseFloat(v || '0') <= 0) return '0';
	return v;
}
Utils.roundup = function(v) {
	return String( Math.ceil(parseFloat(v || '0')));
}


Utils.is = function(v) { return v && v!='0'; }

//derives a class from a baseclass. declare constructor inline. supports prototype chaining. eg:
//  var Mybase = Class(function(myargs){
//      this.id = myarg;
//  })
//  var MyDerived = Class(MyBase, function(myargs){
//      this.superClass.apply(this, arguments); //apply superclass constructor
//  })
//  alert(   (new MyDerived('hello')).id   );
//heavy
Utils.Class = function(basecl, constr) {
	if (!constr) return basecl; //is baseclass. do nothing
	constr.prototype.constructor = constr;
	constr.prototype.prototype = basecl;
	constr.prototype.superClass = basecl;
	return constr;
}

//strips non basic-alphanumeric chars (including spaces)
Utils.descrFilename = function(name) {
	return name.replace(/[^a-zA-Z0-9\-]/g,'')+'.txt';
}

//removes elements with a blank key attribute, used for array of properties for filtering
Utils.propertiesWithKeys = function(properties){
	var propsWithKeys = [];
	properties.forEach(function(prop){
		if (prop.key !== "")
			propsWithKeys.push(prop);
	});
	return(propsWithKeys);
}

///////////////////////////////////////////////////////////////////////////
// render helpers
///////////////////////////////////////////////////////////////////////////

Utils.renderFlag = function(f){
	return '<span class="flag">'+f+'</span>';
}

//list of flags enclosed in parenthesis
Utils.renderFlags = function(arr, noparen){
	var _arr = (typeof(arr) == 'string')  ?  arguments  :  arr;

	for (var i=0, f, h; f= _arr[i]; i++) {
		h = (h ? h+', ' : noparen ? ' ' : ' (') + f[0].trim();
		if (f[1] != "none") {
			h += '<span class="internal-inline"> ['+f[1]+']</span>';
		}
	}
	return h ? h + (noparen ? '' : ')') : '';
}

Utils.addFlags = function(o, arr, ignorekeys){
	var _arr = (typeof(arr) == 'string')  ?  arguments  :  arr;

	for (var i=0, f, h; f= _arr[i]; i++) {
		o[f[1]] = 1;
		ignorekeys[f[1]] = 1;
	}
}


///////////////////////////////////////////////////////////////////////////
// display lists (eccentric stuff)
///////////////////////////////////////////////////////////////////////////

Utils.cutDisplayOrder = function(aliases, formats, arr) {
	var keyorder = [];
	for (var i=0; i<arr.length; i+=2) {
		var k = arr[i], dk = arr[i+1];
		if ((!dk) || typeof(k) != 'string' || typeof(dk) != 'string')
			throw 'Cockup: misformed displayorder near key: '+arr[i];

		keyorder.push(k);

		if (aliases[k])
			throw 'Cockup: duplicate displayorder key: '+arr[i];
		aliases[k] = dk;

		var fm = arr[i+2];
		if (fm && typeof(fm) != 'string') {
			formats[k] = fm;
			i++;
		}
	}
	return keyorder;
}

Utils.renderDetailsRows = function(o, displayorder, aliases, formats, cssClass) {
	if (!cssClass) cssClass = '';
	var h='';
	for (var i=0; i<displayorder.length; i++) {
		var k = displayorder[i];
		var v = o[k];
		//if ((!v) || ignorekeys[k]) continue;
		if (!v) continue;

		if (formats[k] && typeof(formats[k])=='function')
			v = formats[k](v,o);
		else if ((k in formats) && formats[k][v])
			v = formats[k][v];

		var ak = aliases[k] || k;
		//if (DMI.Options['Show database keys'])
		ak+= '<span class="internal-inline"> ['+displayorder[i]+']</span>';

		if (v!='0') {
			var t = (o.titles && o.titles[k]) ?  (' title="'+o.titles[k]+'"') : '';
			h+=' <tr class="'+k+' '+cssClass+'" '+t+'> <th>'+ak+': </th> <td>'+v+'</td> </tr> ';
		}
	}
	return h;
}
Utils.renderDetailsRows2 = function(o, displayorder, aliases, formats, cssClass) {
	if (!cssClass) cssClass = '';
	var h='';
	for (var i=0; i<displayorder.length; i++) {
		var k = displayorder[i];
		var v = o[k];
		//if ((!v) || ignorekeys[k]) continue;
		if (!v) continue;

		if (formats[k] && typeof(formats[k])=='function')
			v = formats[k](v,o);
		else if ((k in formats) && formats[k][v])
			v = formats[k][v];

		var ak = aliases[k] || k;
		//if (DMI.Options['Show database keys'])
		//ak+= '<span class="internal-inline"> ['+displayorder[i]+']</span>';

		if (v!='0') {
			var t = (o.titles && o.titles[k]) ?  (' title="'+o.titles[k]+'"') : '';
			h+=' <tr class="'+k+' '+cssClass+'" '+t+'> <th>'+ak+': </th> <td>'+v+'</td> </tr> ';
			h+=' <tr> <th><span class="internal-inline"> ['+displayorder[i]+']</span></th> </tr> ';
		}
	}
	return h;
}


Utils.renderDetailsFlags = function(o, flagorder, aliases, formats, cssClass) {
	if (!cssClass) cssClass = '';
	var h='';
	var terms = [];
	for (var i=0;  i<flagorder.length; i++) {
		var k = flagorder[i];
		if (o[k] && o[k]!='0') {
			//upstream logged 'flag error' for non-1 flag values here
			//port fix: upstream also dashed spaces inside tags, breaking embedded ref links
			var ak = (aliases[k] || k).replace(/ (?![^<]*>)/g,'-');
			//if (DMI.Options['Show database keys'])
			ak += '<span class="internal-inline"> ['+flagorder[i]+']</span>';

			terms.push('<span class="flag '+cssClass+'" title="'+flagorder[i]+'">'+ak+'</span>');
		}
	}
	if (terms.length)
		h+= ' <tr><td colspan="2"> (' + terms.join(', ') + ') </td><tr> ';

	return h;
}

Utils.renderStrangeDetailsRows = function(o, ignorekeys, aliases, cssClass) {
	var displayorder = [];
	//populate lineorder (ensures no property is missed)
	for (var k in o) {
		if (!ignorekeys[k] && !aliases[k])
			displayorder.push(k);
	}
	return Utils.renderDetailsRows(o, displayorder, aliases, {}, cssClass)
}

Utils.renderModded = function(o) {
	var show = DMI.Options['Show mod cmds'];
	var modlines = o.modded.replace('ERROR:', '<span class="mod-error">ERROR:</span>');
	var h = '';
	h+='<details class="mod-cmds-block"'+(show ? ' open' : '')+'>';
	h+=	'<summary>Modded<span class="internal-inline"> [modded]</span></summary>';
	h+=	'<p class="mod-cmds">'+modlines+'</p>';
	h+='</details>';
	return h;
}

////////////////////////////////////////////////////////////
// Some parsing functions
////////////////////////////////////////////////////////////

	Utils.getScale = function(o) {
		if (!isNaN(parseInt(o))) {
			switch(parseInt(o)) {
				case 0:
					return 'Turmoil';
				case 1:
					return 'Sloth';
				case 2:
					return 'Cold';
				case 3:
					return 'Death';
				case 4:
					return 'Misfortune';
				case 5:
					return 'Drain';
			}
		}
		return o;
	}

	Utils.getScaleInverted = function(o) {
		if (!isNaN(parseInt(o))) {
			switch(parseInt(o)) {
				case 0:
					return 'Order';
				case 1:
					return 'Productivity';
				case 2:
					return 'Heat';
				case 3:
					return 'Growth';
				case 4:
					return 'Luck';
				case 5:
					return 'Magic';
			}
		}
		return o;
	}


////////////////////////////////////////////////////////////
// ref: link referencing a local data object
////////////////////////////////////////////////////////////

//ref links are resolved by the UI via event delegation on a.ref[data-ref]
Utils.ref = function(ref, text) {
	return '<a class="ref" data-ref="'+String(ref).replace(/"/g,'&quot;')+'">'+text+'</a>';
}

//make ref from object of type?
function objectRef(type, id, text, suffix) {
	var lookup = DMI.modctx[type+'lookup'] || {};

	if (typeof(id) == 'string') id = id.toLowerCase();
	var o = lookup[id]; if (!o) return id;

	if (typeof(text) != 'string') text = o.fullname || o.name;
	if (suffix) text += suffix;

	var suffix = parseInt(o.id) ? '<span class="modding-inline refid">#'+o.id+'&nbsp;</span>' : '';
	return suffix + Utils.ref(type+' '+o.id, text);//+'<span class="modding-inline refid">&nbsp;'+o.id+'</span>';
}
Utils.parseObjectRefs = function(html) {
	return html.replace(/\[(\w+) ([^,\]]+),?\s*([^,\]]*),?([^,\]]*)\]/g, function(_,$1,$2,$3,$4){ return objectRef($1,$2,null,$4); });
}

//type specific functions
Utils.itemRef  = function(id, text) { return objectRef('item',  id, text); }
Utils.unitRef  = function(id, text) {
	var ref;
	if (parseInt(id) < 0) {
		ref = DMI.modctx.monster_tags_lookup[parseInt(id)];
		if (ref) {
			ref = ref.name;
		} else {
			ref = '';
			for (var oi=0, o;  o= DMI.modctx.unitdata[oi];  oi++) {
				if (o.montag) {
					if (-parseInt(id) == parseInt(o.montag)) {
						if (o.id == parseInt(o.id)) {
							ref = ref + objectRef('unit', o.id, text) + ', <br />';
						}
					}
				}
			}
		}
	} else {
		ref = objectRef('unit', id, text);
	}
	return ref;
}
Utils.spellRef = function(id, text) { return objectRef('spell', id, text); }
Utils.wpnRef   = function(id, text) { return objectRef('wpn',   id, text); }
Utils.armorRef = function(id, text) { return objectRef('armor', id, text); }
Utils.nationRef = function(id, text) { return objectRef('nation', id, text); }
Utils.siteRef = function(id, text) { return objectRef('site', id, text); }
Utils.eventRef = function(id, text) { return objectRef('event', id, text); }
Utils.afflictionRef = function(name) { return Utils.ref('affliction '+name, name); }
Utils.planesRef = function(name) { 
	return DMI.modctx.other_planes_lookup[parseInt(name)].name
}

Utils.unitOfTypeRef = function(id, utype) {
	var o = DMI.modctx.unitlookup[id];
	if (!o) return v;
	var suffix = '<span class="modding-inline refid">#'+o.id+'&nbsp;</span>';
	return suffix + Utils.ref(utype+' '+o.id, o.linkname);
}
Utils.rndMagicRef = function(id, text) {
	var o = DMI.modctx.unitlookup[id];
	if (!o) return v;
	return Utils.ref('rndmagic '+o.id, text);
}

//resolves ref to a data object (upstream PaneManager.renderPane)
DMI.resolveRef = function(ref) {
	var args = ref.split(/ (.+)/);
	var o = null;
	switch(args[0]) {
		case 'item':  	o = DMI.modctx.itemlookup[args[1]]; break;
		case 'spell': 	o = DMI.modctx.spelllookup[args[1]]; break;
		case 'wpn': 	o = DMI.modctx.wpnlookup[args[1]]; break;
		case 'armor': 	o = DMI.modctx.armorlookup[args[1]]; break;
		case 'nation': 	o = DMI.modctx.nationlookup[args[1]]; break;
		case 'site': 	o = DMI.modctx.sitelookup[args[1]]; break;
		case 'merc': 	o = DMI.modctx.merclookup[args[1]]; break;
		case 'event': 	o = DMI.modctx.eventlookup[args[1]]; break;
		case 'affliction': o = DMI.MAffliction.lookup[args[1]]; break;

		case 'rndmagic':
			o = DMI.modctx.unitlookup[args[1]];
			if (!o) return;
			return { kind: 'rndmagic', o: o };

		//unit types
		// case 'unit':
		// case 'cmdr':
		// case 'commander':
		// case 'pretender':
		// case 'special':
		// case 'combat':
		// case 'assassin':
		// case 'infiltrator':

		//assume type unit
		default:
			//match "[unit type] [id]"
			var args2 = /^(.+?) (\d+)$/.exec(ref);
			if (args2) {
				if (o = DMI.modctx.getUnitOfType(DMI.modctx.unitlookup[args2[2]], args2[1]))
					break;
				args[1] = args2[2]; //fallback to default lookup on id
			}
			//get correct duplicate
			o = DMI.modctx.getExactUnit(args[1]);
			break;
	}
	if (!o) return;
	return { kind: args[0], o: o };
}
//resolves ref and renders popup content
DMI.renderPane = function(ref, isPopup) {
	var r = DMI.resolveRef(ref);
	if (!r) return;
	if (r.kind == 'rndmagic') return DMI.MUnit.renderRandomMagic(r.o);
	return r.o.renderOverlay(r.o, isPopup);
}


////////////////////////////////////////////////////////////
// load dynamic content
//   upstream fetched descriptions with $.get and injected them after a timeout.
//   Here render functions queue jobs; the UI drains them after inserting the html
//   (see DMI.takeContentJobs) and fills the matching elements.
////////////////////////////////////////////////////////////

DMI.contentJobs = [];
DMI.takeContentJobs = function() {
	var jobs = DMI.contentJobs;
	DMI.contentJobs = [];
	return jobs;
}
Utils.loadContent = function(url, domsel) {
	DMI.contentJobs.push({ sel: domsel, url: url });
}
Utils.loadContentWithHtml = function(url, html, domsel, domsel2) {
	DMI.contentJobs.push({ sel: domsel, url: url });
	DMI.contentJobs.push({ sel: domsel2, html: html, afterUrl: url });
}
Utils.insertContent = function(html, domsel) {
	DMI.contentJobs.push({ sel: domsel, html: html });
}

}
