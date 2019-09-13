import * as React from 'react';
import * as ReactDOM from 'react-dom';

const $ = require('jquery');

interface Props {
	id?: string;
	name?: string;
	type?: string;
	placeHolder?: string;
	value: string;
	autoComplete?: string;
	maxLength?: number;
	className?: string;
	multiple?: boolean;
	readOnly?: boolean;
	accept?: string;
	onChange?(e: any, value: string): void;
	onKeyUp?(e: any, value: string): void;
	onKeyDown?(e: any, value: string): void;
	onFocus?(e: any, value: string): void;
	onBlur?(e: any, value: string): void;
};

interface State {
	value: string;
	selected: boolean;
	type: string;
};

class Input extends React.Component<Props, State> {
	
	public static defaultProps = {
        type: 'text',
		value: ''
    };

	state = {
		value: '',
		selected: false,
		type: ''
	};
	
	constructor (props: any) {
        super(props);

		this.onChange = this.onChange.bind(this);
		this.onKeyUp = this.onKeyUp.bind(this);
		this.onKeyDown = this.onKeyDown.bind(this);
		this.onFocus = this.onFocus.bind(this);
		this.onBlur = this.onBlur.bind(this);
	};

	render () {
		const { id, name, placeHolder, className, autoComplete, readOnly, maxLength, multiple, accept } = this.props;
		
		let type: string = this.state.type || this.props.type;
		let cn = [ 'input', 'input-' + type ];
		if (className) {
			cn.push(className);
		};
		if (readOnly) {
			cn.push('readOnly');
		};
		
		return (
			<input
				type={type}
				name={name}
				id={id}
				placeholder={placeHolder}
				value={this.state.value}
				className={cn.join(' ')}
				autoComplete={autoComplete ? autoComplete : name}
				readOnly={readOnly}
				onChange={this.onChange}
				onKeyUp={this.onKeyUp}
				onKeyDown={this.onKeyDown}
				onFocus={this.onFocus}
				onBlur={this.onBlur}
				maxLength={maxLength ? maxLength : undefined}
				accept={accept ? accept : undefined}
				multiple={multiple}
			/>
		);
	};
	
	componentDidMount () {
		this.setValue(this.props.value);
		this.setState({ type: this.props.type });
	};
	
	componentDidUpdate () {
		let node = $(ReactDOM.findDOMNode(this));
		
		if (this.state.selected) {
			node.select();
		};
	};
	
	onChange (e: any) {
		this.setValue(e.target.value);
		
		if (this.props.onChange) {
			this.props.onChange(e, e.target.value);
		};
	};
	
	onKeyUp (e: any) {
		this.setValue(e.target.value);
		
		if (this.props.onKeyUp) {
			this.props.onKeyUp(e, this.state.value);
		};
	};
	
	onKeyDown (e: any) {
		if (this.props.onKeyDown) {
			this.props.onKeyDown(e, this.state.value);
		};
	};
	
	onFocus (e: any) {
		if (this.props.onFocus) {
			this.props.onFocus(e, this.state.value);
		};
	};
	
	onBlur (e: any) {
		if (this.props.onBlur) {
			this.props.onBlur(e, this.state.value);
		};
	};
	
	focus () {
		setTimeout(() => { $(ReactDOM.findDOMNode(this)).focus(); });
	};
	
	select () {
		this.setState({ selected: true });
	};
	
	setValue (v: string) {
		this.setState({ value: v });
	};
	
	getValue () {
		return this.state.value;
	};
	
	setType (v: string) {
		this.setState({ type: v });
	};
	
};

export default Input;