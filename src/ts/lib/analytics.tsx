import * as amplitude from 'amplitude-js';
import { I, M, C, Mapper, Util, translate, Storage } from 'ts/lib';
import { authStore, commonStore, dbStore } from 'ts/store';

const Constant = require('json/constant.json');
const { app } = window.require('@electron/remote');
const isProduction = app.isPackaged;
const version = app.getVersion();
const os = window.require('os');

const KEYS = [ 
	'method', 'id', 'action', 'style', 'code', 'route',
	'type', 'objectType', 'layout', 'template', 'index',
	'tab', 'document', 'page', 'count', 'context', 'originalId', 'length'
];
const KEY_CONTEXT = 'analyticsContext';
const KEY_ORIGINAL_ID = 'analyticsOriginalId';

class Analytics {
	
	isInit: boolean =  false;
	instance: any = null;

	debug() {
		const { config } = commonStore;
		return config.debug.an;
	};
	
	init () {
		if (this.isInit) {
			return;
		};

		const platform = Util.getPlatform();
		const { account } = authStore;

		C.MetricsSetParameters(platform);

		this.instance = amplitude.getInstance();
		this.instance.init(Constant.amplitude, null, {
			batchEvents: true,
			saveEvents: true,
			includeUtm: true,
			includeReferrer: true,
			platform: platform,
		});

		this.instance.setVersionName(version);
		this.instance.setUserProperties({ 
			deviceType: 'Desktop',
			platform: Util.getPlatform(),
			osVersion: os.release(),
		});

		if (this.debug()) {
			console.log('[Analytics.init]', this.instance);
		};

		this.profile(account);
		this.isInit = true;
	};
	
	profile (account: I.Account) {
		if (!this.instance || (!isProduction && !this.debug())) {
			return;
		};
		if (this.debug()) {
			console.log('[Analytics.profile]', account.id);
		};
		this.instance.setUserId(account.id);
	};

	device (id: string) {
		if (!this.instance || (!isProduction && !this.debug())) {
			return;
		};

		this.instance.setDeviceId(id);
	};

	setContext (context: string, id: string) {
		Storage.set(KEY_CONTEXT, context);
		Storage.set(KEY_ORIGINAL_ID, id);

		if (this.debug()) {
			console.log('[Analytics.setContext]', context, id);
		};
	};

	event (code: string, data?: any) {
		if (!this.instance || (!isProduction && !this.debug()) || !code) {
			return;
		};

		const converted: any = {};
		data = data || {};

		let param: any = { 
			middleTime: Number(data.middleTime) || 0, 
			context: String(Storage.get(KEY_CONTEXT) || ''),
			originalId: String(Storage.get(KEY_ORIGINAL_ID) || ''),
		};

		for (let k of KEYS) {
			if (undefined !== data[k]) {
				converted[k] = data[k];
			};
		};

		if (converted.objectType) {
			const type = dbStore.getObjectType(converted.objectType);
			if (!type.id.match(/^_/)) {
				converted.objectType = 'custom';
			};
		};

		param = Object.assign(param, converted);

		switch (code) {
			case 'page':
				code = this.pageMapper(data.params);
				break;

			case 'popup':
				code = this.popupMapper(data.params);
				break;

			case 'menu':
				code = this.menuMapper(data.params);
				break;

			case 'settings':
				code = this.settingsMapper(data.params);
				break;

			case 'SettingsWallpaperSet':
				param.type = this.coverTypeMapper(data.type);
				param.id = param.id.replace(/^c([\d]+)/, '$1');

				if (data.type == I.CoverType.Upload) {
					delete(param.id);
				};
				break;

		};

		if (!code) {
			return;
		};

		if (this.debug()) {
			console.log('[Analytics.event]', code, param);
		};
		
		this.instance.logEvent(code, param);
	};
	
	getDictionary (type: string, style: number) {
		let data: any = {
			text: {},
			file: {},
			div: {},
		};
		
		data.text[I.TextStyle.Paragraph]	 = 'Paragraph';
		data.text[I.TextStyle.Header1]		 = 'Header1';
		data.text[I.TextStyle.Header2]		 = 'Header2';
		data.text[I.TextStyle.Header3]		 = 'Header3';
		data.text[I.TextStyle.Quote]		 = 'Quote';
		data.text[I.TextStyle.Code]			 = 'Code';
		data.text[I.TextStyle.Bulleted]		 = 'Bulleted';
		data.text[I.TextStyle.Numbered]		 = 'Numbered';
		data.text[I.TextStyle.Toggle]		 = 'Toggle';
		data.text[I.TextStyle.Checkbox]		 = 'Checkbox';
		
		data.file[I.FileType.None]			 = 'None';
		data.file[I.FileType.File]			 = 'File';
		data.file[I.FileType.Image]			 = 'Image';
		data.file[I.FileType.Video]			 = 'Video';
		data.file[I.FileType.Audio]			 = 'Audio';
		
		data.div[I.DivStyle.Line]			 = 'Line';
		data.div[I.DivStyle.Dot]			 = 'Dot';

		return data[type][style];
	};

	pageMapper (params: any): string {
		const { page, action } = params;
		const key = [ page, action ].join('/');
		const map = {
			'index/index':		 'ScreenIndex',
			'auth/notice':		 'ScreenDisclaimer',
			'auth/login':		 'ScreenLogin',
			'auth/register':	 'ScreenAuthRegistration',
			'auth/invite':		 'ScreenAuthInvitation',

			'main/index':		 'ScreenHome',
			'main/graph':		 'ScreenGraph',
			'main/navigation':	 'ScreenNavigation',
			'main/type':		 'ScreenType',
			'main/relation':	 'ScreenRelation',
			'main/set':			 'ScreenSet',
			'main/edit':		 'ScreenObject',
			'main/space':		 'ScreenSpace',
			'main/media':		 'ScreenMedia',
			'main/history':		 'ScreenHistory',
		};

		return map[key] || '';
	};

	popupMapper (params: any): string {
		const { id } = params;
		const map = {
			settings: 'ScreenSettings',
			search: 'ScreenSearch',
		};

		return map[id] || '';
	};

	menuMapper (params: any): string {
		const { id } = params;
		const map = {
			help: 'MenuHelp',
		};

		return map[id] || '';
	};

	settingsMapper (params: any): string {
		const { id } = params;
		const prefix = 'ScreenSettings';

		const map = {
			index: '',
			phrase: '',
			pinIndex: 'PinCode',
			importIndex: 'Import',
			importNotion: 'ImportNotion',
			exportMarkdown: 'Export',
		};

		const code = (undefined !== map[id]) ? map[id] : id;
		return code ? Util.toCamelCase([ prefix, code ].join('-')) : '';
	};

	coverTypeMapper (v: I.CoverType) {
		let r = '';
		switch (v) {
			default:
			case I.CoverType.None:		 r = 'none'; break;
			case I.CoverType.Upload:	 r = 'upload'; break;
			case I.CoverType.Color:		 r = 'color'; break;
			case I.CoverType.Gradient:	 r = 'gradient'; break;
			case I.CoverType.Image:		 r = 'image'; break;
		};
		return r;
	};
	
};

export let analytics: Analytics = new Analytics();