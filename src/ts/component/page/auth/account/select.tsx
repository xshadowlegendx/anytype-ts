import * as React from 'react';
import { RouteComponentProps } from 'react-router';
import { Frame, Icon, Cover, Title, IconUser, HeaderAuth as Header, FooterAuth as Footer } from 'ts/component';
import { observer, inject } from 'mobx-react';
import { dispatcher, Storage } from 'ts/lib';
import { AccountInterface } from 'ts/store/auth';

interface Props extends RouteComponentProps<any> {
	authStore?: any;
};
interface State {};

@inject('authStore')
@observer
class PageAccountSelect extends React.Component<Props, State> {

	constructor (props: any) {
        super(props);

		this.onSelect = this.onSelect.bind(this);
		this.onAdd = this.onAdd.bind(this);
	};
	
	render () {
		const { authStore } = this.props;
		
		const Item = (item: any) => (
			<div className="item" onClick={(e) => { this.onSelect(e, item.index); }}>
				<IconUser {...item} />
				<div className="name">{item.name}</div>
			</div>
		);
		
        return (
			<div>
				<Cover num={3} />
				<Header />
				<Footer />
				
				<Frame>
					<Title text="Choose profile" />
					
					<div className="list">
						{authStore.accounts.map((item: AccountInterface, i: number) => (
							<Item key={i} {...item} index={i} />	
						))}
						<div className="item add" onMouseDown={this.onAdd}>
							<Icon className="plus" />
							<div className="name">Add profile</div>
						</div>
					</div>
				</Frame>
			</div>
		);
    };

	onSelect (e: any, index: number) {
		const { authStore } = this.props;
		
		e.preventDefault();
		
		Storage.set('account', index);
		authStore.indexSet(index);
		this.props.history.push('/auth/pin-select/select');
	};
	
	onAdd (e: any) {
		e.preventDefault();
		
		this.props.history.push('/auth/register/add');
	};
	
};

export default PageAccountSelect;