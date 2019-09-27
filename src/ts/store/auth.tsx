import { observable, action, computed } from 'mobx';

export interface AccountInterface {
	id: string;
	name: string;
	color?: string;
	icon?: string;
};

class AuthStore {
	@observable public pin: string = '';
	@observable public accountItem: AccountInterface = null;
	@observable public accountList: AccountInterface[] = [];
	@observable public icon: string = '';
	@observable public name: string = '';
	@observable public phrase: string = '';
	@observable public index: number = 0;
	
	@computed
	get accounts(): AccountInterface[] {
		return this.accountList;
	};
	
	@computed
	get account(): AccountInterface {
		return this.accountItem;
	};
	
	@action
	pinSet (v: string) {
		this.pin = v;
	};
	
	@action
	phraseSet (v: string) {
		this.phrase = v;
	};
	
	@action
	indexSet (v: number) {
		this.index = v;
	};
	
	@action
	accountAdd (account: AccountInterface) {
		this.accountList.push(account);
	};
	
	@action
	accountSet (account: AccountInterface) {
		this.accountItem = account as AccountInterface;
	};
	
	@action
	iconSet (v: string) {
		this.icon = v;
	};
	
	@action
	nameSet (v: string) {
		this.name = v;
	};
	
};

export let authStore: AuthStore = new AuthStore();