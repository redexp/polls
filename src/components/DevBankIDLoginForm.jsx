import {createSignal} from "solid-js";

export default function DevBankIDLoginForm() {
	const [error, setError] = createSignal({name: false, age: false});

	let state;
	let name;
	let age;

	const onSubmit = (e) => {
		const errors = {
			name: !name.value.trim(),
			age: !age.value.trim() || !Number(age.value) || Number(age.value) < 18,
		};

		if (Object.values(errors).some(v => !!v)) {
			e.preventDefault();
			setError(errors);
			return;
		}

		const url = new URL(location.href);

		state.value = url.searchParams.get('state');
	};

	return (
		<form
			action="http://localhost:8001/oauth2/callback"
			method="get"
			onSubmit={onSubmit}
		>
			<input type="hidden" name="state" ref={state}/>

			<div class="mb-3">
				<label class="form-label">Імʼя</label>

				<input
					name="name"
					classList={{
						"form-control": true,
						"is-invalid": error().name,
					}}
					autocomplete="name"
					ref={name}
				/>
			</div>

			<div class="mb-3">
				<label class="form-label">Вік</label>

				<input
					name="age"
					type="number"
					min={18}
					value={18}
					classList={{
						"form-control": true,
						"is-invalid": error().age,
					}}
					ref={age}
				/>
			</div>

			<div class="mb-3">
				<label class="form-label">Стать</label>

				<select
					name="sex"
					class="form-select"
				>
					<option value="M">Чоловік</option>
					<option value="F">Жінка</option>
				</select>
			</div>

			<div class="d-flex mt-5">
				<button
					type="submit"
					class="btn btn-primary me-2"
				>
					OK
				</button>

				<a
					href="/"
					class="btn btn-secondary"
				>
					Відмінити
				</a>
			</div>
		</form>
	);
}