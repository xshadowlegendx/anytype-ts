import * as React from 'react';
import $ from 'jquery';
import raf from 'raf';
import { observer } from 'mobx-react';
import { getRange } from 'selection-ranges';
import { I, M, focus, keyboard, scrollOnMove, UtilCommon } from 'Lib';
import { blockStore, menuStore, popupStore } from 'Store';

interface Props {
	children?: React.ReactNode;
};

const THRESHOLD = 10;

const SelectionProvider = observer(class SelectionProvider extends React.Component<Props> {

	_isMounted = false;
	x = 0;
	y = 0;
	dir = 0;
	focused = '';
	range: any = null;
	nodes: any[] = [];
	top = 0;
	startTop = 0;
	containerOffset = null;
	frame = 0;
	hasMoved = false;
	isSelecting = false;
	isPopup = false;
	rootId = '';
	rect: any = null;

	cacheNodeMap: Map<string, any> = new Map();
	cacheChildrenMap: Map<string, string[]> = new Map();

	ids: Map<string, string[]> = new Map();
	idsOnStart: Map<string, string[]> = new Map();
	
	constructor (props: Props) {
		super(props);
		
		this.onMouseDown = this.onMouseDown.bind(this);
		this.onMouseMove = this.onMouseMove.bind(this);
		this.onMouseUp = this.onMouseUp.bind(this);
	};

	render () {
		const { list } = popupStore;
		const children = this.injectProps(this.props.children);
		const length = list.length;

		return (
			<div 
				id="selection" 
				className="selection" 
				onMouseDown={this.onMouseDown}
			>
				<div id="selection-rect" />
				{children}
			</div>
		);
	};
	
	componentDidMount () {
		this._isMounted = true;
		this.rect = $('#selection-rect');
		this.rebind();
	};

	componentDidUpdate (): void {
		this.rebind();
	};
	
	componentWillUnmount () {
		this._isMounted = false;
		this.unbind();
	};

	rebind () {
		this.unbind();
		UtilCommon.getScrollContainer(keyboard.isPopup()).on('scroll.selection', e => this.onScroll(e));
	};

	unbind () {
		this.unbindMouse();
		this.unbindKeyboard();
	};
	
	unbindMouse () {
		$(window).off('mousemove.selection mouseup.selection');
	};
	
	unbindKeyboard () {
		const isPopup = keyboard.isPopup();

		$(window).off('keydown.selection keyup.selection');
		UtilCommon.getScrollContainer(isPopup).off('scroll.selection');
	};

	scrollToElement (id: string, dir: number) {
		const isPopup = keyboard.isPopup();

		if (dir > 0) {
			focus.scroll(isPopup, id);
		} else {
			const node = $('.focusable.c' + id);
			if (!node.length) {
				return;
			};

			const container = UtilCommon.getScrollContainer(isPopup);
			const no = node.offset().top;
			const nh = node.outerHeight();
			const st = container.scrollTop();
			const hh = UtilCommon.sizeHeader();
			const y = isPopup ? (no - container.offset().top + st) : no;

			if (y <= st + hh) {
				container.scrollTop(y - nh - hh);
			};
		};
	};
	
	onMouseDown (e: any) {
		const isPopup = keyboard.isPopup();

		if (e.button || !this._isMounted || menuStore.isOpen('', '', [ 'onboarding' ]) || popupStore.isOpen('', [ 'page' ])) {
			return;
		};
		
		if (keyboard.isSelectionDisabled) {
			this.hide();
			return;
		};
		
		const { focused } = focus.state;
		const win = $(window);
		const container = UtilCommon.getScrollContainer(isPopup);

		isPopup ? this.rect.addClass('fromPopup') : this.rect.removeClass('fromPopup');
		
		this.rootId = keyboard.getRootId();
		this.isPopup = isPopup;
		this.x = e.pageX;
		this.y = e.pageY;
		this.hasMoved = false;
		this.focused = focused;
		this.top = this.startTop = container.scrollTop();
		this.idsOnStart = new Map(this.ids);
		this.clearCache();
		this.setIsSelecting(true);

		keyboard.disablePreview(true);

		if (isPopup && container.length) {
			this.containerOffset = container.offset();
			this.x -= this.containerOffset.left;
			this.y -= this.containerOffset.top - this.top;
		};

		this.initNodes();

		if (e.shiftKey) {
			const target = $(e.target).closest('.selectable');
			const type = target.attr('data-type') as I.SelectType;
			const id = target.attr('data-id');
			const ids = this.get(type);

			if (!ids.length && (id != focused)) {
				this.set(type, ids.concat([ focused ]));
			};
		};
		
		scrollOnMove.onMouseDown(e, isPopup);
		this.unbindMouse();

		win.on(`mousemove.selection`, e => this.onMouseMove(e));
		win.on(`blur.selection mouseup.selection`, e => this.onMouseUp(e));
	};

	initNodes () {
		const nodes = this.getPageContainer().find('.selectable');

		nodes.each((i: number, item: any) => {
			item = $(item);

			const id = item.attr('data-id');
			if (!id) {
				return;
			};

			const node = {
				id,
				type: item.attr('data-type'),
				obj: item,
			};

			this.nodes.push(node);
			this.cacheNode(node);
			this.cacheChildrenIds(id);
		});
	};
	
	onMouseMove (e: any) {
		if (!this._isMounted) {
			return;
		};
		
		if (keyboard.isSelectionDisabled) {
			this.hide();
			return;
		};

		const rect = this.getRect(this.x, this.y, e.pageX, e.pageY);

		if ((rect.width < THRESHOLD) && (rect.height < THRESHOLD)) {
			return;
		};
		
		this.top = UtilCommon.getScrollContainer(this.isPopup).scrollTop();
		this.checkNodes(e);
		this.drawRect(e.pageX, e.pageY);
		this.hasMoved = true;

		scrollOnMove.onMouseMove(e.clientX, e.clientY);
	};

	onScroll (e: any) {
		if (!this.isSelecting || !this.hasMoved) {
			return;
		};

		const container = UtilCommon.getScrollContainer(this.isPopup);
		const top = container.scrollTop();
		const d = top > this.top ? 1 : -1;
		const x = keyboard.mouse.page.x;
		const y = keyboard.mouse.page.y + (!this.isPopup ? Math.abs(top - this.top) * d : 0);
		const rect = this.getRect(this.x, this.y, x, y);
		const wh = container.height();

		if ((rect.width < THRESHOLD) && (rect.height < THRESHOLD)) {
			return;
		};

		if (Math.abs(top - this.startTop) >= wh / 2) {
			this.initNodes();
			this.startTop = top;
		} else {
			this.nodes.forEach(it => this.cacheNode(it));
		};

		this.checkNodes({ ...e, pageX: x, pageY: y });
		this.drawRect(x, y);

		scrollOnMove.onMouseMove(keyboard.mouse.client.x, keyboard.mouse.client.y);
		this.hasMoved = true;
	};
	
	onMouseUp (e: any) {
		if (!this._isMounted) {
			return;
		};

		if (!this.hasMoved) {
			if (!e.shiftKey && !e.altKey && !(e.ctrlKey || e.metaKey)) {
				if (!keyboard.isSelectionClearDisabled) {
					this.initIds();
					this.renderSelection();

					$(window).trigger('selectionClear');
				};
			} else {
				let needCheck = false;
				if (e.ctrlKey || e.metaKey) {
					for (const i in I.SelectType) {
						const idsOnStart = this.idsOnStart.get(I.SelectType[i]) || [];
						needCheck = needCheck || Boolean(idsOnStart.length);
					};
				};

				if (needCheck) {
					this.checkNodes(e);
				};
				
				const ids = this.get(I.SelectType.Block, true);
				const target = $(e.target).closest('.selectable');
				const id = target.attr('data-id');
				const type = target.attr('data-type');
				
				if (target.length && e.shiftKey && ids.length && (type == I.SelectType.Block)) {
					const first = ids.length ? ids[0] : this.focused;
					const tree = blockStore.getTree(this.rootId, blockStore.getBlocks(this.rootId));
					const list = blockStore.unwrapTree(tree);
					const idxStart = list.findIndex(it => it.id == first);
					const idxEnd = list.findIndex(it => it.id == id);
					const start = idxStart < idxEnd ? idxStart : idxEnd;
					const end = idxStart < idxEnd ? idxEnd : idxStart;
					const slice = list.slice(start, end + 1).
						map(it => new M.Block(it)).
						filter(it => it.isSelectable()).
						map(it => it.id);

					this.set(type, ids.concat(slice));
				};
			};
		} else {
			$(window).trigger('selectionEnd');
		};
		
		scrollOnMove.onMouseUp(e);

		const ids = this.ids.get(I.SelectType.Block) || [];
		
		if (ids.length) {
			focus.clear(true);
			menuStore.close('blockContext');
		};

		this.clearState();
	};

	initIds () {
		for (const i in I.SelectType) {
			this.ids.set(I.SelectType[i], []);
		};
	};

	drawRect (x: number, y: number) {
		if (!this.nodes.length) {
			return;
		};

		if (UtilCommon.getSelectionRange()) {
			this.rect.hide();
		} else {
			const x1 = this.x + (this.containerOffset ? this.containerOffset.left : 0);
			const y1 = this.y + (this.containerOffset ? this.containerOffset.top - this.top : 0);
			const rect = this.getRect(x1, y1, x, y);

			this.rect.show().css({ transform: `translate3d(${rect.x}px, ${rect.y}px, 0px)`, width: rect.width, height: rect.height });
		};
	};
	
	getRect (x1: number, y1: number, x2: number, y2: number) {
		return {
			x: Math.min(x1, x2),
			y: Math.min(y1, y2),
			width: Math.abs(x2 - x1),
			height: Math.abs(y2 - y1),
		};
	};
	
	cacheNode (node: any): { x: number; y: number; width: number; height: number; } {
		if (!node.id) {
			return { x: 0, y: 0, width: 0, height: 0 };
		};

		let cache = this.cacheNodeMap.get(node.id);
		if (cache) {
			return cache;
		};

		const offset = node.obj.offset();
		const rect = node.obj.get(0).getBoundingClientRect() as DOMRect;
		const { x, y } = this.recalcCoords(offset.left, offset.top);

		cache = { x, y, width: rect.width, height: rect.height };

		this.cacheNodeMap.set(node.id, cache);
		return cache;
	};
	
	checkEachNode (e: any, type: I.SelectType, rect: any, node: any, ids: string[]) {
		const cache = this.cacheNode(node);
		if (!cache || !UtilCommon.rectsCollide(rect, cache)) {
			return;
		};

		if (e.ctrlKey || e.metaKey) {
			ids = (this.idsOnStart.get(type) || []).includes(node.id) ? ids.filter(it => it != node.id) : ids.concat(node.id);
		} else
		if (e.altKey) {
			ids = ids.filter(it => it != node.id);
		} else {
			ids.push(node.id);
		};
	};
	
	checkNodes (e: any) {
		if (!this._isMounted) {
			return;
		};
		
		const { focused, range } = focus.state;
		const { x, y } = this.recalcCoords(e.pageX, e.pageY);
		const rect = UtilCommon.objectCopy(this.getRect(this.x, this.y, x, y));

		if (!e.shiftKey && !e.altKey && !e.ctrlKey || e.metaKey) {
			this.initIds();
		};

		const ids = {};
		for (const i in I.SelectType) {
			const type = I.SelectType[i];
			
			ids[type] = this.get(type, false);
			this.nodes.filter(it => it.type == type).forEach(item => this.checkEachNode(e, type, rect, item, ids[type]));
			this.ids.set(type, ids[type]);
		};
		
		const length = ids[I.SelectType.Block].length;

		if (length > 0) {
			if ((length == 1) && !(e.ctrlKey || e.metaKey)) {
				const selected = $(`#block-${ids[I.SelectType.Block][0]}`);
				const value = selected.find('#value');

				if (!value.length) {
					return;
				};

				const el = value.get(0) as Element;
				const range = getRange(el); 
				
				if (!this.range) {
					this.focused = selected.attr('data-id');
					this.range = range;
				};

				if (this.range) {
					if (this.range.end) {
						this.initIds();
					};
					
					if (!range) {
						focus.set(this.focused, { from: this.range.start, to: this.range.end });
						focus.apply();
					};
				};
			} else {
				if (focused && range.to) {
					focus.clear(false);
				};
				
				keyboard.setFocus(false);
				window.getSelection().empty();
				window.focus();
			};
		};

		this.renderSelection();		
	};

	hide () {
		this.rect.hide();
		this.unbindMouse();
	};
	
	clear () {
		if (!this._isMounted) {
			return;
		};

		this.initIds();
		this.renderSelection();
		this.clearState();

		$(window).trigger('selectionClear');
	};

	clearState () {
		keyboard.disablePreview(false);
		
		this.hide();
		this.setIsSelecting(false);
		this.clearCache();
		this.focused = '';
		this.range = null;
		this.containerOffset = null;
		this.isPopup = false;
		this.rootId = '';
		this.nodes = [];
	};

	clearCache () {
		this.cacheNodeMap.clear();
		this.cacheChildrenMap.clear();
	};
	
	set (type: I.SelectType, ids: string[]) {
		this.ids.set(type, UtilCommon.arrayUnique(ids || []));
		this.renderSelection();
	};
	
	get (type: I.SelectType, withChildren?: boolean): string[] {
		let ids = [ ...new Set(this.ids.get(type) || []) ];

		if (!ids.length) {
			return [];
		};

		if (type != I.SelectType.Block) {
			return ids;
		};

		if (withChildren) {
			ids.forEach(id => this.getChildrenIds(id, ids));
		} else {
			const childrenIds = [];
			ids.forEach(id => this.getChildrenIds(id, childrenIds));

			if (childrenIds.length) {
				ids = ids.filter(it => !childrenIds.includes(it));
			};
		};

		return ids;
	};

	cacheChildrenIds (id: string): string[] {
		const block = blockStore.getLeaf(this.rootId, id);
		if (!block) {
			return [];
		};

		let ids = [];

		if (!block.isTable()) {
			const childrenIds = blockStore.getChildrenIds(this.rootId, id);

			for (const childId of childrenIds) {
				ids.push(childId);
				ids = ids.concat(this.cacheChildrenIds(childId));
			};
		};

		this.cacheChildrenMap.set(id, [ ...ids ]);
		return ids;
	};

	getChildrenIds (id: string, ids: string[]) {
		const cache = this.cacheChildrenMap.get(id);
		if (cache && cache.length) {
			ids = ids.concat(cache);
		};
		return ids;
	};

	getPageContainer () {
		return $(UtilCommon.getCellContainer(keyboard.isPopup() ? 'popup' : 'page'));
	};

	renderSelection () {
		if (!this._isMounted) {
			return;
		};

		if (this.frame) {
			raf.cancel(this.frame);
		};

		raf(() => {
			$('.isSelectionSelected').removeClass('isSelectionSelected');

			for (const i in I.SelectType) {
				const type = I.SelectType[i];
				const ids = this.get(type, true);

				for (const id of ids) {
					$(`#selectable-${id}`).addClass('isSelectionSelected');

					if (type == I.SelectType.Block) {
						$(`#block-${id}`).addClass('isSelectionSelected');

						const childrenIds = this.getChildrenIds(id, []);
						if (childrenIds.length) {
							childrenIds.forEach(childId => $(`#block-${childId}`).addClass('isSelectionSelected'));
						};
					};
				};
			};
		});
	};

	recalcCoords (x: number, y: number): { x: number, y: number } {
		if (this.containerOffset) {
			const top = UtilCommon.getScrollContainer(this.isPopup).scrollTop();

			x -= this.containerOffset.left;
			y -= this.containerOffset.top - top;
		};

		return { x, y };
	};
	
	injectProps (children: any) {
		keyboard.setSelection(this);

		return React.Children.map(children, (child: any) => {
			if (!child) {
				return;
			};

			const props = child.props || {};
			const children = props.children;
			const dataset = props.dataset || {};
			
			if (children) {
				child = React.cloneElement(child, { children: this.injectProps(children) });
			};
			
			dataset.selection = this;
			return React.cloneElement(child, { dataset: dataset });
		});
	};

	setIsSelecting (v: boolean) {
		this.isSelecting = v;

		const html = $('html');
		v ? html.addClass('isSelecting') : html.removeClass('isSelecting');
	};
	
});

export default SelectionProvider;