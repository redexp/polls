import {Show} from 'solid-js/web';
import {Transition} from 'solid-transition-group';

export default function Modal(props) {
	return (
		<Transition
			onEnter={(el, done) => {
				requestAnimationFrame(() => {
					el.classList.add('show');
					done();
				});
			}}
			onExit={(el) => {
				el.classList.remove('show');
			}}
		>
			<Show when={props.open}>
				<div class="modal fade" style={{display: 'block', "background-color": "rgba(0, 0, 0, 0.2)"}}>
					<div class="modal-dialog modal-dialog-centered">
						<div class="modal-content">
							{props.children}
						</div>
					</div>
				</div>
			</Show>
		</Transition>
	);
}

export function Header({children}) {
	return (
		<div class="modal-header">
			<h1 class="modal-title fs-5">{children}</h1>
		</div>
	);
}

export function Body({children}) {
	return (
		<div class="modal-body">
			{children}
		</div>
	);
}

export function Footer({children}) {
	return (
		<div class="modal-footer flex-nowrap">
			{children}
		</div>
	);
}